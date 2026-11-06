const {
  app,
  BrowserWindow,
  ipcMain,
  dialog,
  session,
  Menu,
} = require("electron");
const fs = require("node:fs/promises"),
  path = require("node:path");
const { pathToFileURL } = require("node:url");
const {
  validateConsent,
  ToolStore,
  atomicJSON,
  download,
  verifyCatalog,
  updatesFor,
} = require("@matiq-solutions/runtime");
const { ToolHost } = require("@matiq-solutions/runtime/tool-host.cjs");
const CATALOG_URL =
  "https://github.com/GoMatiQ-inc/matiq-solutions/releases/latest/download/catalog.signed.json";
async function launch(options = {}) {
  if (options.profile) app.setPath("userData", path.resolve(options.profile));
  app.setName("MatiQ Solutions");
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  await app.whenReady();
  const root = app.getPath("userData");
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  const publishers =
    options.publishers || require("../catalog/trust.json").publishers;
  const store = new ToolStore({
    root: path.join(root, "tool-store"),
    publishers,
  });
  await store.activatePending();
  const settingsFile = path.join(root, "settings.json"),
    catalogFile = path.join(root, "catalog.json");
  let settings = { autoUpdates: true };
  try {
    settings = {
      ...settings,
      ...JSON.parse(await fs.readFile(settingsFile, "utf8")),
    };
  } catch (e) {
    if (e.code !== "ENOENT")
      throw Error("Suite settings are damaged. Restore your settings backup.");
  }
  let catalog = options.catalog || require("../catalog/catalog.json"),
    catalogStatus = "Bundled marketplace catalog. Refresh when connected.",
    activity = "",
    downloadController = null,
    quitting = false;
  try {
    const envelope = JSON.parse(await fs.readFile(catalogFile, "utf8"));
    catalog = verifyCatalog(
      envelope,
      publishers,
      Math.max(catalog.sequence, settings.catalogSequence || 0),
    );
    catalogStatus = "Verified cached marketplace.";
  } catch (e) {
    if (e.code !== "ENOENT")
      catalogStatus = "Cached marketplace unavailable: " + e.message;
  }
  const window = new BrowserWindow({
    width: 1220,
    height: 860,
    minWidth: 840,
    minHeight: 650,
    title: "MatiQ Solutions",
    backgroundColor: "#ffffff",
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.setMenuBarVisibility(false);
  if (process.platform === "darwin")
    Menu.setApplicationMenu(
      Menu.buildFromTemplate([
        {
          label: "MatiQ Solutions",
          submenu: [{ role: "about" }, { role: "quit" }],
        },
        { role: "editMenu" },
        { role: "windowMenu" },
      ]),
    );
  const send = (event = { type: "changed" }) => {
    if (!window.isDestroyed())
      window.webContents.send("solutions:event", event);
  };
  const host = new ToolHost({
    window,
    store,
    dataRoot: root,
    emit: () => send(),
  });
  const uiURL = pathToFileURL(path.join(__dirname, "ui/index.html")).href;
  window.webContents.setWindowOpenHandler(() => ({ action: "deny" }));
  window.webContents.on("will-navigate", (e) => e.preventDefault());
  session.defaultSession.setPermissionRequestHandler((_wc, _p, cb) =>
    cb(false),
  );
  function announce(message) {
    activity = message;
    send({ type: "activity", message });
  }
  async function refreshCatalog() {
    const response = await fetch(CATALOG_URL, {
      signal: AbortSignal.timeout(30000),
    });
    if (!response.ok)
      throw Error(
        `Marketplace refresh failed (${response.status}). Installed tools remain available.`,
      );
    const chunks = [];
    let length = 0;
    for await (const chunk of response.body) {
      length += chunk.length;
      if (length > 4 * 1024 ** 2)
        throw Error("Marketplace metadata exceeds its size limit.");
      chunks.push(Buffer.from(chunk));
    }
    const bytes = Buffer.concat(chunks);
    const envelope = JSON.parse(bytes.toString("utf8")),
      verified = verifyCatalog(
        envelope,
        publishers,
        Math.max(catalog.sequence, settings.catalogSequence || 0),
      );
    settings.catalogSequence = verified.sequence;
    await atomicJSON(settingsFile, settings);
    await atomicJSON(catalogFile, envelope);
    catalog = verified;
    catalogStatus = "Verified marketplace refreshed.";
    return catalog;
  }
  async function install({
    id,
    update = false,
    approveCapabilities = false,
    reviewedVersion,
    reviewedCapabilities,
  }) {
    if (downloadController)
      throw Error("Wait for the current tool download or cancel it.");
    const installed = await store.state();
    if (update && !installed.tools[id])
      throw Error("Updates apply only to installed tools.");
    const tool = catalog.tools.find((t) => t.id === id);
    if (!tool)
      throw Error("Refresh the marketplace and choose an available tool.");
    if (approveCapabilities)
      validateConsent(tool, { reviewedVersion, reviewedCapabilities });
    else if (!update)
      throw Error("Review the tool requirements before installing.");
    const release = tool.packages[store.target];
    if (!release) throw Error("This tool is not available for your device.");
    downloadController = new AbortController();
    announce(`Downloading ${tool.name}…`);
    try {
      const bytes = await (options.download || download)(release.url, {
        ...release,
        signal: downloadController.signal,
        progress: (p) =>
          announce(`Downloading ${tool.name} · ${Math.round(p * 100)}%`),
      });
      await store.install(bytes, {
        update,
        approveCapabilities,
        expectedId: id,
        expectedVersion: tool.version,
        expectedCapabilities: tool.capabilities || [],
      });
      announce(
        update
          ? `${tool.name} update downloaded. Restart when ready.`
          : `${tool.name} installed. Choose Open.`,
      );
    } finally {
      downloadController = null;
      send();
    }
  }
  async function checkUpdates() {
    if (!options.catalog) await refreshCatalog();
    const available = updatesFor(await store.state(), catalog, store.target);
    if (settings.autoUpdates)
      for (const t of available) {
        try {
          await install({ id: t.id, update: true });
        } catch (e) {
          announce(`${t.name}: ${e.message}`);
        }
      }
    return available;
  }
  ipcMain.handle("solutions:request", async (event, name, args = {}) => {
    if (
      event.sender !== window.webContents ||
      event.senderFrame !== window.webContents.mainFrame ||
      event.senderFrame.url !== uiURL
    )
      throw Error("Suite operations are restricted to the suite window.");
    if (typeof name !== "string" || JSON.stringify(args).length > 10000)
      throw Error("Invalid suite request.");
    switch (name) {
      case "state": {
        const installed = await store.state();
        return {
          version: app.getVersion(),
          target: store.target,
          installed,
          catalog,
          catalogStatus,
          settings,
          installing: Boolean(downloadController) || store.busy,
          activity,
          running: await host.status(),
          selected: host.selected,
          updates: updatesFor(installed, catalog, store.target),
        };
      }
      case "catalog.refresh":
        return refreshCatalog();
      case "install":
        return install(args);
      case "download.cancel":
        downloadController?.abort();
        return true;
      case "open":
        return host.open(args.id);
      case "hide":
        host.hide();
        return true;
      case "uninstall":
        await host.close(args.id);
        await store.uninstall(args.id);
        return true;
      case "enable":
        await host.close(args.id);
        await store.enable(args.id, args.enabled);
        return true;
      case "updates.check":
        return checkUpdates();
      case "settings":
        if (typeof args.autoUpdates !== "boolean")
          throw Error("Choose whether automatic downloads are enabled.");
        settings.autoUpdates = args.autoUpdates;
        await atomicJSON(settingsFile, settings);
        return true;
      case "restart":
        if (downloadController || store.busy)
          throw Error("Finish tool downloads before restarting.");
        await host.assertIdle();
        app.relaunch();
        app.quit();
        return true;
      case "app.update.check":
        if (!app.isPackaged)
          throw Error(
            "App updates are available in the installed signed release.",
          );
        await require("electron-updater").autoUpdater.checkForUpdates();
        return true;
      default:
        throw Error("Unknown suite operation.");
    }
  });
  app.on("second-instance", () => {
    window.show();
    window.focus();
  });
  app.on("activate", () => {
    window.show();
    window.focus();
  });
  window.on("close", (event) => {
    if (quitting) return;
    event.preventDefault();
    app.quit();
  });
  app.on("window-all-closed", () => app.quit());
  app.on("before-quit", (event) => {
    if (quitting) return;
    event.preventDefault();
    (async () => {
      if (downloadController || store.busy)
        throw Error("Finish or cancel tool downloads before quitting.");
      await host.dispose();
      quitting = true;
      app.quit();
    })().catch((e) => {
      announce(e.message);
      if (!window.isDestroyed()) window.show();
    });
  });
  await window.loadURL(uiURL);
  let timer;
  if (!options.catalog) {
    timer = setInterval(
      () => checkUpdates().catch((e) => announce(e.message)),
      6 * 60 * 60 * 1000,
    );
    timer.unref();
  }
  app.once("will-quit", () => {
    clearInterval(timer);
    ipcMain.removeHandler("solutions:request");
  });
  return { window, store, host };
}
if (app.getAppPath() === path.resolve(__dirname, '..'))
  launch().catch((e) => {
    dialog.showErrorBox("MatiQ Solutions could not start", e.message);
    app.quit();
  });
module.exports = { launch };
