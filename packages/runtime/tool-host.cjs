const { app, WebContentsView, session, ipcMain } = require("electron");
const fs = require("node:fs/promises"),
  path = require("node:path");
const { frameGuard } = require("./trusted-frame.cjs");
class ToolHost {
  constructor({ window, store, dataRoot, emit, sharedModelRoot }) {
    this.leaseRoot = path.join(
      app.getPath("appData"),
      "MatiQ Solutions",
      "tool-locks",
    );
    this.window = window;
    this.store = store;
    this.dataRoot = dataRoot;
    this.sharedModelRoot = sharedModelRoot;
    this.emit = emit;
    this.running = new Map();
    this.opening = new Map();
    this.closing = new Map();
    this.disposing = false;
    this.selected = null;
    this.viewMode = "workspace";
    this.overlay = false;
    this.window.on("resize", () => this.layout());
  }
  layout() {
    const [width, height] = this.window.getContentSize();
    const y = this.viewMode === "settings" ? 108 : 48;
    for (const [id, t] of this.running) {
      t.view.setVisible(id === this.selected && !this.overlay);
      t.instance.onVisibility?.(id === this.selected && !this.overlay);
      t.view.setBounds({
        x: 0,
        y,
        width: Math.max(1, width),
        height: Math.max(1, height - y - 36),
      });
    }
  }
  hide() {
    this.selected = null;
    this.layout();
  }
  setOverlay(open) {
    this.overlay = open;
    this.layout();
  }
  async navigate(id, index) {
    if (id !== this.selected || this.closing.has(id))
      throw Error("Open the tool before navigating.");
    const tool = this.running.get(id);
    if (!tool || tool.activationFailed)
      throw Error("Reopen the tool before navigating.");
    await require("@matiq-solutions/shell/navigation.cjs").navigate(
      tool.view.webContents,
      index,
    );
    if (Number.isInteger(index)) tool.workspaceIndex = index;
  }
  async navigation() {
    const tool = this.running.get(this.selected);
    if (!tool || tool.activationFailed || this.closing.has(tool.id) || tool.isClosing?.()) return { items: [], settings: false };
    return require("@matiq-solutions/shell/navigation.cjs").describe(
      tool.view.webContents,
    );
  }
  async open(id, { settings = false } = {}) {
    if (this.disposing || this.closing.has(id))
      throw Error("Wait for tool shutdown to finish before opening it again.");
    if (!this.running.has(id)) {
      let opening = this.opening.get(id);
      if (!opening) {
        opening = this.activate(id);
        this.opening.set(id, opening);
      }
      try {
        await opening;
      } finally {
        if (this.opening.get(id) === opening) this.opening.delete(id);
      }
    }
    if (this.running.get(id)?.activationFailed)
      throw Error(
        "Tool startup cleanup is incomplete. Close the tool to retry cleanup before reopening.",
      );
    this.selected = id;
    this.viewMode = settings ? "settings" : "workspace";
    const tool = this.running.get(id);
    if (settings) await this.navigate(id, "settings");
    else if (tool.pageMode === "settings") {
      const navigation = await this.navigation();
      if (navigation.items.length)
        await this.navigate(
          id,
          tool.workspaceIndex ?? navigation.items[0].index,
        );
    }
    tool.pageMode = this.viewMode;
    this.layout();
    return { id };
  }
  async activate(id) {
    const record = await this.store.loadRecord(id),
      m = record.manifest;
    const ownSession = session.fromPartition("persist:solutions-" + m.id);
    ownSession.setPermissionRequestHandler((_c, _p, callback) =>
      callback(false),
    );
    const view = new WebContentsView({
      webPreferences: {
        preload: path.join(record.directory, m.preload),
        session: ownSession,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: true,
        backgroundThrottling: false,
      },
    });
    const contents = view.webContents,
      handlers = [],
      listeners = [];
    const requests = new Set();
    let closing = false;
    contents.setWindowOpenHandler(() => ({ action: "deny" }));
    contents.on("will-navigate", (e) => e.preventDefault());
    this.window.contentView.addChildView(view);
    view.setVisible(false);
    const dataDir = path.join(this.dataRoot, "tools", id);
    const requireFrame = frameGuard(
      contents,
      path.join(record.directory, m.workspace),
    );
    const handle = (channel, fn) => {
      if (
        typeof channel !== "string" ||
        channel.startsWith("solutions:") ||
        handlers.includes(channel)
      )
        throw Error("Choose a unique tool command channel.");
      ipcMain.handle(channel, async (event, ...args) => {
        if (closing)
          throw Error(
            "This tool is closing. Reopen it before starting more work.",
          );
        const request = (async () => {
          await requireFrame(event);
          if (closing)
            throw Error("This tool is closing. Retry after reopening.");
          return fn(...args);
        })();
        requests.add(request);
        try {
          return await request;
        } finally {
          requests.delete(request);
        }
      });
      handlers.push(channel);
    };
    let lease;
    const cleanup = async () => {
      for (const channel of handlers) ipcMain.removeHandler(channel);
      for (const [emitter, event, fn] of listeners)
        emitter.removeListener(event, fn);
      ownSession.setPermissionRequestHandler((_c, _p, callback) =>
        callback(false),
      );
      ownSession.setPermissionCheckHandler(() => false);
      ownSession.setDisplayMediaRequestHandler(null);
      if (!contents.isDestroyed()) contents.close();
      this.window.contentView.removeChildView(view);
      await lease?.release();
    };
    const context = {
      window: this.window,
      view,
      session: ownSession,
      dataDir,
      sharedModelRoot: this.sharedModelRoot,
      resourceDir: record.directory,
      manifest: m,
      close: async () => {
        setImmediate(() =>
          this.close(id)
            .then(() => this.emit())
            .catch((error) =>
              this.emit({ type: "activity", message: error.message }),
            ),
        );
        return { requested: true };
      },
      protectedRoots: [
        this.dataRoot,
        this.store.root,
        record.directory,
        this.leaseRoot,
      ],
      handle,
      emit: (channel, event) => {
        if (!contents.isDestroyed()) contents.send(channel, event);
      },
      on: (emitter, event, fn) => {
        emitter.on(event, fn);
        listeners.push([emitter, event, fn]);
      },
      show: () => {
        this.selected = id;
        this.layout();
        this.window.show();
        this.window.focus();
        this.emit();
      },
    };
    let instance;
    try {
      lease = await require("./tool-lease.cjs").acquireToolLease({
        root: this.leaseRoot,
        id,
        owner: app.getName(),
      });
      await fs.mkdir(dataDir, { recursive: true, mode: 0o700 });
      const adapter = require(path.join(record.directory, m.adapter));
      if (typeof adapter.activate !== "function")
        throw Error("This tool does not implement SDK activate(context).");
      instance = await adapter.activate(context);
      if (
        !instance ||
        typeof instance.status !== "function" ||
        typeof instance.dispose !== "function"
      )
        throw Error("Tool must provide status() and dispose().");
      await require("@matiq-solutions/shell").apply(contents, { suite: true });
      await require("@matiq-solutions/shell/navigation.cjs").prepare(contents);
      this.running.set(id, {
        id,
        name: m.name,
        view,
        instance,
        cleanup,
        requests,
        isClosing: () => closing,
        setClosing: (value) => {
          closing = value;
        },
      });
    } catch (error) {
      try {
        await instance?.dispose?.();
      } catch (shutdownError) {
        // Keep the instance and ownership: another host must not acquire its
        // native hooks while failed cleanup may still have live helpers.
        closing = true;
        this.running.set(id, {
          id,
          name: m.name,
          view,
          instance,
          cleanup,
          requests,
          setClosing: (value) => {
            closing = value;
          },
          isClosing: () => closing,
          activationFailed: true,
          failureReason: `Startup failed: ${error.message}. Close this tool to retry cleanup: ${shutdownError.message}`,
        });
        throw Error(
          `Tool startup failed (${error.message}) and cleanup needs retry (${shutdownError.message}). Close this tool to retry cleanup before reopening.`,
        );
      }
      await cleanup();
      throw error;
    }
  }
  async status() {
    const rows = [];
    for (const tool of this.running.values()) {
      let state;
      const closing = () => this.closing.has(tool.id) || tool.isClosing?.();
      if (tool.activationFailed)
        state = { busy: true, recovery: true, reason: tool.failureReason };
      else if (closing())
        state = {
          busy: true,
          closing: true,
          reason: "Finishing tool shutdown",
        };
      else {
        try {
          state = await tool.instance.status();
        } catch (error) {
          if (!closing()) throw error;
          state = {
            busy: true,
            closing: true,
            reason: "Finishing tool shutdown",
          };
        }
      }
      rows.push({ id: tool.id, name: tool.name, ...state });
    }
    return rows;
  }
  async assertIdle(id) {
    if ([...this.opening.keys()].some((key) => !id || key === id))
      throw Error(
        "Wait for tools to finish opening before closing or restarting.",
      );
    for (const t of this.running.values())
      if (!id || id === t.id) {
        if (t.activationFailed) continue;
        let timer;
        try {
          await Promise.race([
            Promise.allSettled([...t.requests]),
            new Promise((resolve) => {
              timer = setTimeout(resolve, 1000);
              timer.unref();
            }),
          ]);
        } finally {
          clearTimeout(timer);
        }
        if (t.requests.size)
          throw Error(
            `Wait for ${t.name}'s current request to finish or cancel it.`,
          );
        const state = await t.instance.status();
        if (state.busy)
          throw Error(
            `Finish ${t.name}'s active work before closing or restarting: ${state.reason || "tool is busy"}`,
          );
      }
  }
  async freeze(tool) {
    if (tool.activationFailed || tool.frozen !== undefined) return;
    tool.frozen = await tool.view.webContents.executeJavaScript(
      "(()=>{const previous=document.documentElement.inert;document.documentElement.inert=true;return previous;})()",
    );
  }
  async unfreeze(tool) {
    if (tool.frozen === undefined) return;
    if (!tool.view.webContents.isDestroyed())
      await tool.view.webContents.executeJavaScript(
        `document.documentElement.inert=${Boolean(tool.frozen)}`,
      );
    delete tool.frozen;
  }
  async prepareClose(id) {
    await this.assertIdle(id);
    const tool = this.running.get(id);
    if (!tool) return;
    try {
      await this.freeze(tool);
      await this.assertIdle(id);
      if (!tool.activationFailed && tool.requests.size)
        throw Error(`Wait for ${tool.name}'s current request to finish.`);
      tool.setClosing(true);
      return tool;
    } catch (error) {
      await this.unfreeze(tool);
      throw error;
    }
  }
  async close(id) {
    if (this.disposing) throw Error("Wait for suite shutdown to finish.");
    let operation = this.closing.get(id);
    if (!operation) {
      operation = this.closeOne(id).finally(() => this.closing.delete(id));
      this.closing.set(id, operation);
    }
    return operation;
  }
  async closeOne(id) {
    const t = await this.prepareClose(id);
    if (!t) return;
    try {
      await t.instance.dispose();
      await t.cleanup();
      this.running.delete(id);
      if (this.selected === id) this.selected = null;
      this.layout();
    } catch (error) {
      t.setClosing(Boolean(t.activationFailed));
      await this.unfreeze(t);
      throw error;
    }
  }
  async dispose() {
    if (this.disposing || this.closing.size)
      throw Error(
        "Wait for tool shutdown to finish before restarting or quitting.",
      );
    this.disposing = true;
    const prepared = [];
    try {
      // Check every tool before gating any IPC: a later busy recording must
      // not interrupt commands or dirty-state notifications in earlier tools.
      await this.assertIdle();
      for (const tool of this.running.values()) await this.freeze(tool);
      // Once every workspace acknowledges inert, no later DOM-only edit can
      // invalidate an earlier tool's final status snapshot.
      await this.assertIdle();
      for (const tool of this.running.values()) {
        if (!tool.activationFailed && tool.requests.size)
          throw Error(`Wait for ${tool.name}'s current request to finish.`);
      }
      for (const tool of this.running.values()) {
        tool.setClosing(true);
        prepared.push(tool);
      }
      for (const tool of prepared) {
        await tool.instance.dispose();
        await tool.cleanup();
        this.running.delete(tool.id);
      }
      this.selected = null;
      this.layout();
      this.emit();
    } catch (error) {
      for (const t of this.running.values()) {
        t.setClosing(Boolean(t.activationFailed));
        await this.unfreeze(t);
      }
      throw error;
    } finally {
      this.disposing = false;
    }
  }
}
module.exports = { ToolHost };
