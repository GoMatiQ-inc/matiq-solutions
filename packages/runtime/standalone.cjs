const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const fs = require("node:fs/promises"),
  path = require("node:path");
const { validateManifest } = require("@matiq-solutions/sdk");
async function launch({ root, profile }) {
  const manifest = validateManifest(
    JSON.parse(await fs.readFile(path.join(root, "matiq-tool.json"), "utf8")),
  );
  app.setName(manifest.name);
  if (profile) app.setPath("userData", profile);
  if (!app.requestSingleInstanceLock()) {
    app.quit();
    return;
  }
  await app.whenReady();
  const dataDir = app.getPath("userData");
  await fs.mkdir(dataDir, { recursive: true, mode: 0o700 });
  const window = new BrowserWindow({
      width: 1120,
      height: 820,
      title: manifest.name,
      backgroundColor: "#fff",
      webPreferences: {
        preload: path.join(root, manifest.preload),
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
      },
    }),
    contents = window.webContents,
    channels = [];
  contents.setWindowOpenHandler(() => ({ action: "deny" }));
  contents.on("will-navigate", (e) => e.preventDefault());
  contents.session.setPermissionRequestHandler((_c, _p, cb) => cb(false));
  const requireFrame=require('./trusted-frame.cjs').frameGuard(contents,path.join(root,manifest.workspace));
  const host = {
    window,
    view: { webContents: contents },
    session: contents.session,
    dataDir,
    resourceDir: root,
    manifest,
    protectedRoots: [root, dataDir],
    handle: (channel, fn) => {
      ipcMain.handle(channel, async (event, ...args) => {
        await requireFrame(event);
        return fn(...args);
      });
      channels.push(channel);
    },
    emit: (channel, event) => contents.send(channel, event),
  };
  const instance = await require(path.join(root, manifest.adapter)).activate(
    host,
  );
  await contents.insertCSS(
    await fs.readFile(require("@matiq-solutions/shell").stylesheet, "utf8"),
  );
  let quitting = false;
  window.on("close", (event) => {
    if (quitting) return;
    event.preventDefault();
    app.quit();
  });
  app.on("before-quit", (event) => {
    if (quitting) return;
    event.preventDefault();
    (async () => {
      const state = await instance.status();
      if (state.busy)
        throw Error(state.reason || "Finish your work before quitting.");
      await instance.dispose();
      for (const c of channels) ipcMain.removeHandler(c);
      quitting = true;
      app.quit();
    })().catch((e) => dialog.showErrorBox("Tool is busy", e.message));
  });
  app.on("window-all-closed", () => app.quit());
  return { window, instance };
}
module.exports = { launch };
