const fs = require("node:fs/promises"),
  os = require("node:os"),
  path = require("node:path"),
  crypto = require("node:crypto"),
  assert = require("node:assert/strict");
const { _electron: electron } = require("playwright");
const { create } = require("@matiq-solutions/sdk/cli.cjs"),
  { pack, hash } = require("@matiq-solutions/sdk");
const {
  capture,
  captureTree,
  verifyStopped,
} = require("@matiq-solutions/sdk/fixture-lifecycle.cjs");
(async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "matiq-suite-desktop-")),
    source = path.join(root, "independent-tool-repository");
  let app,
    owned = [],
    expired = false;
  const watchdog = setTimeout(() => {
    expired = true;
    app?.process().kill("SIGTERM");
  }, 150000);
  try {
    const manifest = await create(source, {
      id: "com.matiq.fixture",
      name: "Local document",
    });
    const adapterFile = path.join(source, "src/tool.cjs");
    let adapter = await fs.readFile(adapterFile, "utf8");
    adapter = adapter.replace(
      "let savedText='',saving=false;",
      "let savedText='',saving=false,recording=false,chunks=0;",
    );
    adapter = adapter.replace(
      "if(name==='load')",
      "if(name==='fixture.record'){recording=true;return true;}if(name==='fixture.chunk'){if(!recording)throw Error('Fixture is not recording');return ++chunks;}if(name==='fixture.stop'){recording=false;return chunks;}if(name==='fixture.close')return host.close();if(name==='load')",
    );
    adapter = adapter.replace(
      "status:async()=>{const current=",
      "status:async()=>{if(recording)return {busy:true,reason:'recording fixture audio'};const current=",
    );
    await fs.writeFile(adapterFile, adapter);
    const keys = crypto.generateKeyPairSync("ed25519");
    const publicKey = keys.publicKey.export({ type: "spki", format: "pem" });
    const packages = {},
      entries = [];
    for (const version of ["0.1.0", "0.1.1"]) {
      const file = path.join(root, version + ".mqt"),
        meta = await pack({
          root: source,
          manifest: { ...manifest, version },
          publisher: "fixture",
          privateKey: keys.privateKey,
          include: ["src"],
          output: file,
        });
      const url = "https://fixture.invalid/" + version;
      packages[url] = file;
      entries.push({
        ...manifest,
        version,
        packages: { [process.platform + "-" + process.arch]: { url, ...meta } },
      });
    }
    const configFile = path.join(root, "fixture.json");
    const config = {
      profile: path.join(root, "profile"),
      publishers: { fixture: publicKey },
      catalog: { schema: 1, sequence: 1, tools: [entries[0]] },
      packages,
    };
    async function launch() {
      await fs.writeFile(configFile, JSON.stringify(config));
      app = await electron.launch({
        args: [path.join(__dirname, "desktop-entry.cjs")],
        env: { ...process.env, MATIQ_FIXTURE_CONFIG: configFile },
        timeout: 30000,
      });
      owned = captureTree(capture(app.process()));
      app
        .context()
        .on("page", (p) =>
          p.on("pageerror", (error) =>
            console.error("Fixture renderer error:", error.message),
          ),
        );
      const page = await app.firstWindow();
      page.setDefaultTimeout(15000);
      return page;
    }
    async function close() {
      if (!app) return;
      owned = captureTree(capture(app.process()));
      await app.close();
      app = null;
      for (const process of owned) await verifyStopped(process);
      owned = [];
    }
    let page = await launch();
    await page
      .getByText(
        "No tools installed. Browse the marketplace to choose your first tool.",
        { exact: true },
      )
      .waitFor();
    assert.equal((await fs.readdir(config.profile)).includes("tools"), false);
    await page
      .getByRole("button", { name: "Browse marketplace", exact: true })
      .click();
    await page.getByRole("button", { name: "Install", exact: true }).click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Install", exact: true })
      .click();
    await page
      .getByText("Local document installed. Choose Open.", { exact: true })
      .waitFor();
    await page.getByRole("button", { name: "Open", exact: true }).click();
    await page.evaluate(() =>
      Promise.all([
        window.solutions.request("open", { id: "com.matiq.fixture" }),
        window.solutions.request("open", { id: "com.matiq.fixture" }),
      ]),
    );
    let tool;
    for (let i = 0; i < 100; i++) {
      tool = app
        .context()
        .pages()
        .find((p) => p.url().includes("/src/index.html"));
      if (tool) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    assert.ok(tool, "Installed tool workspace must be a live isolated page.");
    await tool
      .getByLabel("Document", { exact: true })
      .fill("Saved through installed tool, outside the suite source.");
    await assert.rejects(
      page.evaluate(() =>
        window.solutions.request("uninstall", { id: "com.matiq.fixture" }),
      ),
      /save your document/,
    );
    await app.evaluate(({ BrowserWindow }) =>
      BrowserWindow.getAllWindows()[0].close(),
    );
    await page.getByText(/Finish Local document.*save your document/).waitFor();
    assert.equal(
      await tool.getByLabel("Document", { exact: true }).inputValue(),
      "Saved through installed tool, outside the suite source.",
    );
    await tool.getByRole("button", { name: "Save document" }).click();
    await tool.getByText("Saved on this device.", { exact: true }).waitFor();
    assert.equal(
      await fs.readFile(
        path.join(config.profile, "tools", manifest.id, "document.txt"),
        "utf8",
      ),
      "Saved through installed tool, outside the suite source.",
    );
    await tool.evaluate(() => window.tool.request("fixture.record"));
    const chunks = tool.evaluate(async () => {
      let sent = 0;
      const end = Date.now() + 400;
      while (Date.now() < end) {
        await window.tool.request("fixture.chunk");
        sent++;
        await new Promise((r) => setTimeout(r, 5));
      }
      return sent;
    });
    await assert.rejects(
      page.evaluate(() =>
        window.solutions.request("uninstall", { id: "com.matiq.fixture" }),
      ),
      /recording|current request/,
    );
    assert.ok(
      (await chunks) > 0,
      "A rejected close must not reject recording chunks.",
    );
    await tool.evaluate(() => window.tool.request("fixture.stop"));
    const closed = tool.waitForEvent("close");
    const request = tool
      .evaluate(() => window.tool.request("fixture.close"))
      .catch((error) => {
        if (!/closed/i.test(error.message)) throw error;
      });
    await closed;
    await request;
    assert.equal(
      (await page.evaluate(() => window.solutions.request("state"))).running
        .length,
      0,
    );
    await close();
    config.catalog.tools = [entries[1]];
    page = await launch();
    await page
      .getByRole("button", { name: "Downloads & updates", exact: true })
      .click();
    await page
      .getByRole("button", { name: "Download update", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByRole("button", { name: "Download update", exact: true })
      .click();
    await page
      .getByText("Local document update downloaded. Restart when ready.", {
        exact: true,
      })
      .waitFor();
    const registry = JSON.parse(
      await fs.readFile(
        path.join(config.profile, "tool-store/installed.json"),
        "utf8",
      ),
    );
    assert.equal(registry.tools[manifest.id].version, "0.1.0");
    assert.equal(registry.tools[manifest.id].pending.version, "0.1.1");
    await close();
    page = await launch();
    await page.getByText("Version 0.1.1", { exact: true }).waitFor();
    await page.getByRole("button", { name: "Open", exact: true }).click();
    for (let i = 0; i < 100; i++) {
      tool = app
        .context()
        .pages()
        .find((p) => p.url().includes("/src/index.html"));
      if (tool) break;
      await new Promise((r) => setTimeout(r, 50));
    }
    await tool.getByLabel("Document", { exact: true }).waitFor();
    assert.equal(
      await tool.getByLabel("Document", { exact: true }).inputValue(),
      "Saved through installed tool, outside the suite source.",
    );
    await page
      .getByRole("button", { name: "Back to my tools", exact: true })
      .click();
    page.once("dialog", (d) => d.accept());
    await page.getByRole("button", { name: "Uninstall", exact: true }).click();
    await page
      .getByText(
        "No tools installed. Browse the marketplace to choose your first tool.",
        { exact: true },
      )
      .waitFor();
    assert.equal(
      await fs.readFile(
        path.join(config.profile, "tools", manifest.id, "document.txt"),
        "utf8",
      ),
      "Saved through installed tool, outside the suite source.",
    );
    assert.equal(expired, false);
    console.log(
      "PASS: separate SDK tool, empty suite, explicit install, local document, staged update, restart persistence, uninstall preservation.",
    );
    await close();
  } catch (error) {
    if (app) {
      try {
        const pages = [];
        for (const page of app.context().pages())
          pages.push({
            url: page.url(),
            text: (await page.locator("body").innerText()).slice(-6000),
          });
        console.error("Fixture page diagnostics:", JSON.stringify(pages));
      } catch (diagnostic) {
        console.error("Fixture diagnostics unavailable:", diagnostic.message);
      }
    }
    throw error;
  } finally {
    clearTimeout(watchdog);
    if (app) {
      owned = captureTree(capture(app.process()));
      try {
        await app.close();
      } finally {
        for (const process of owned) await verifyStopped(process);
      }
    }
    await fs.rm(root, { recursive: true, force: true });
  }
})().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
