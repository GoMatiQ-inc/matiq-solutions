const { WebContentsView, session, ipcMain } = require("electron");
const fs = require("node:fs/promises"),
  path = require("node:path");
const { frameGuard } = require("./trusted-frame.cjs");
class ToolHost {
  constructor({ window, store, dataRoot, emit, sharedModelRoot }) {
    this.window = window;
    this.store = store;
    this.dataRoot = dataRoot;
    this.sharedModelRoot = sharedModelRoot;
    this.emit = emit;
    this.running = new Map();
    this.opening = new Map();
    this.selected = null;
    this.window.on("resize", () => this.layout());
  }
  layout() {
    const [width, height] = this.window.getContentSize();
    const x = width < 850 ? 190 : 220;
    for (const [id, t] of this.running) {
      t.view.setVisible(id === this.selected);
      t.instance.onVisibility?.(id === this.selected);
      t.view.setBounds({
        x,
        y: 84,
        width: Math.max(1, width - x),
        height: Math.max(1, height - 120),
      });
    }
  }
  hide() {
    this.selected = null;
    this.layout();
  }
  async open(id) {
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
    this.selected = id;
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
    const cleanup = () => {
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
      protectedRoots: [this.dataRoot, this.store.root, record.directory],
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
      await contents.insertCSS(
        await fs.readFile(
          require("@matiq-solutions/shell").suiteStylesheet,
          "utf8",
        ),
      );
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
      });
    } catch (error) {
      try {
        await instance?.dispose?.();
      } finally {
        cleanup();
      }
      throw error;
    }
  }
  async status() {
    const rows = [];
    for (const t of this.running.values())
      rows.push({ id: t.id, name: t.name, ...(await t.instance.status()) });
    return rows;
  }
  async assertIdle(id) {
    if ([...this.opening.keys()].some((key) => !id || key === id))
      throw Error(
        "Wait for tools to finish opening before closing or restarting.",
      );
    for (const t of this.running.values())
      if (!id || id === t.id) {
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
  async prepareClose(id) {
    await this.assertIdle(id);
    const t = this.running.get(id);
    if (t?.requests.size)
      throw Error(
        `Wait for ${t.name}'s current request to finish or cancel it.`,
      );
    t?.setClosing(true);
    return t;
  }
  async close(id) {
    const t = await this.prepareClose(id);
    if (!t) return;
    try {
      await t.instance.dispose();
      t.cleanup();
      this.running.delete(id);
      if (this.selected === id) this.selected = null;
      this.layout();
    } catch (error) {
      t.setClosing(false);
      throw error;
    }
  }
  async dispose() {
    const prepared = [];
    try {
      for (const id of this.running.keys()) {
        const tool = await this.prepareClose(id);
        if (tool) prepared.push(tool);
      }
      for (const tool of prepared) {
        await tool.instance.dispose();
        tool.cleanup();
        this.running.delete(tool.id);
      }
    } catch (error) {
      for (const t of this.running.values()) t.setClosing(false);
      throw error;
    }
  }
}
module.exports = { ToolHost };
