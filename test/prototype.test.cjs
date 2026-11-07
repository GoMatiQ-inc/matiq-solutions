const test = require("node:test"),
  assert = require("node:assert/strict"),
  fs = require("node:fs/promises"),
  os = require("node:os"),
  path = require("node:path");
const p = require("../packages/sdk/prototype.cjs");
async function fixture(t) {
  const root = await fs.mkdtemp(
    path.join(os.tmpdir(), "matiq-prototype-test-"),
  );
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  const tool = path.join(root, "tool"),
    suite = path.join(root, "suite"),
    shell = path.join(root, "shell");
  for (const dir of [tool, suite, shell]) await fs.mkdir(dir);
  await fs.mkdir(path.join(tool, "src"));
  await fs.writeFile(
    path.join(tool, "matiq-tool.json"),
    JSON.stringify({
      id: "com.matiq.test",
      name: "Test tool",
      version: "0.1.0",
      workspace: "src/index.html",
    }),
  );
  await fs.writeFile(
    path.join(tool, "src/index.html"),
    '<html><head><link rel="stylesheet" href="style.css"></head><body><h1>Original renderer</h1></body></html>',
  );
  await fs.writeFile(path.join(tool, "src/style.css"), "body{color:#14458f}");
  await fs.writeFile(path.join(shell, "shell.css"), "body{color:#14458f}");
  await fs.writeFile(
    path.join(shell, "suite-tool.css"),
    ".sidebar{display:none}",
  );
  await fs.mkdir(path.join(suite, "prototype"));
  for (const [file, value] of [
    ["shell.js", "// suite source"],
    ["index.html", "<html>suite</html>"],
    ["tools.json", '{"schema":1,"tools":[]}'],
  ])
    await fs.writeFile(path.join(suite, "prototype", file), value);
  return { root, tool, suite, shell };
}
test("initialization preserves edited prototype bridges; registration stores metadata without tool source", async (t) => {
  const f = await fixture(t);
  await p.init(f.tool, { suite: f.suite });
  await fs.writeFile(
    path.join(f.tool, "prototype/bridge.js"),
    "// owner-edited mock",
  );
  await p.init(f.tool, { suite: f.suite });
  assert.equal(
    await fs.readFile(path.join(f.tool, "prototype/bridge.js"), "utf8"),
    "// owner-edited mock",
  );
  const catalog = JSON.parse(
    await fs.readFile(path.join(f.suite, "prototype/tools.json")),
  );
  assert.equal(catalog.tools[0].id, "com.matiq.test");
  assert.equal(catalog.tools[0].manifest, "prototype/manifest.json");
  assert.equal(
    await fs.access(path.join(f.suite, "src")).then(
      () => true,
      () => false,
    ),
    false,
  );
});
test("exports the original renderer and exact shell; hosted/standalone modes share one payload", async (t) => {
  const f = await fixture(t);
  await p.init(f.tool, { suite: f.suite });
  const source = await fs.readFile(path.join(f.tool, "src/index.html"), "utf8");
  const result = await p.buildSuite(f.suite, { shell: f.shell });
  assert.deepEqual(result.tools, ["com.matiq.test"]);
  const out = path.join(f.suite, ".prototype/tools/com.matiq.test");
  assert.equal(
    await fs.readFile(path.join(out, "src/style.css"), "utf8"),
    "body{color:#14458f}",
  );
  assert.equal(
    await fs.readFile(path.join(out, ".matiq-shell/shell.css"), "utf8"),
    await fs.readFile(path.join(f.shell, "shell.css"), "utf8"),
  );
  const html = await fs.readFile(path.join(out, "src/index.html"), "utf8");
  assert.match(html, /Original renderer/);
  assert.match(html, /prototype\/bridge.js/);
  assert.equal(
    await fs.readFile(path.join(f.tool, "src/index.html"), "utf8"),
    source,
  );
});
test("missing approval blocks packaging; renderer or shared-shell edits invalidate actual recorded approval", async (t) => {
  const f = await fixture(t);
  await p.init(f.tool, { suite: f.suite });
  await assert.rejects(
    p.approval(f.tool, { shell: f.shell }),
    /missing or stale/,
  );
  await assert.rejects(
    p.approve(f.tool, { shell: f.shell }),
    /actual approver/,
  );
  await assert.rejects(
    p.approve(f.tool, {
      shell: f.shell,
      by: "Fixture owner",
      text: "Fixture-only explicit approval",
    }),
    /Build the current/,
  );
  await p.build(f.tool, { shell: f.shell });
  await p.approve(f.tool, {
    shell: f.shell,
    by: "Fixture owner",
    text: "Fixture-only explicit approval",
  });
  await p.approval(f.tool, { shell: f.shell });
  await fs.appendFile(path.join(f.tool, "src/style.css"), "/* changed */");
  await assert.rejects(
    p.approval(f.tool, { shell: f.shell }),
    /missing or stale/,
  );
  await p.build(f.tool, { shell: f.shell });
  await p.approve(f.tool, {
    shell: f.shell,
    by: "Fixture owner",
    text: "Fixture review of changed design",
  });
  await fs.appendFile(path.join(f.shell, "shell.css"), "/* shell changed */");
  await assert.rejects(
    p.approval(f.tool, { shell: f.shell }),
    /missing or stale/,
  );
});
test("a registered tool must have a local source checkout and exports cannot overwrite renderer source", async (t) => {
  const f = await fixture(t);
  await p.init(f.tool, { suite: f.suite });
  await assert.rejects(
    p.build(f.tool, {
      shell: f.shell,
      output: path.join(f.tool, "src/generated"),
    }),
    /outside renderer source/,
  );
  await fs.rm(path.join(f.suite, "prototype/tools.local.json"));
  await assert.rejects(
    p.buildSuite(f.suite, { shell: f.shell }),
    /Register the local checkout/,
  );
});
test("explicit capture override changes only generated preview output, never production source", async (t) => {
  const f = await fixture(t);
  await p.init(f.tool);
  await fs.writeFile(path.join(f.tool, "src/capture.mjs"), "native capture");
  await fs.writeFile(
    path.join(f.tool, "prototype/capture.mjs"),
    "simulated capture",
  );
  const file = path.join(f.tool, "prototype/manifest.json"),
    c = JSON.parse(await fs.readFile(file));
  c.overrides = { "src/capture.mjs": "prototype/capture.mjs" };
  await fs.writeFile(file, JSON.stringify(c));
  await p.build(f.tool, { shell: f.shell });
  assert.equal(
    await fs.readFile(path.join(f.tool, ".prototype/src/capture.mjs"), "utf8"),
    "simulated capture",
  );
  assert.equal(
    await fs.readFile(path.join(f.tool, "src/capture.mjs"), "utf8"),
    "native capture",
  );
});

test('changing the reviewed Solutions shell invalidates a tool approval', async t=>{
 const f=await fixture(t);await p.init(f.tool,{suite:f.suite});await p.build(f.tool,{shell:f.shell});await p.approve(f.tool,{shell:f.shell,by:'Fixture owner',text:'Fixture-only suite design approval'});await fs.appendFile(path.join(f.suite,'prototype/shell.js'),'\n// revised suite shell');await assert.rejects(p.approval(f.tool,{shell:f.shell}),/missing or stale/);
});
test('new-tool packaging commands fail at the draft gate before signing',async t=>{
 const f=await fixture(t),root=path.join(f.root,'fresh-tool');await require('../packages/sdk/cli.cjs').create(root,{id:'com.matiq.fresh',name:'Fresh prototype'});const cp=require('node:child_process');for(const command of ['pack','pack-app']){const result=cp.spawnSync(process.execPath,[path.resolve(__dirname,'../packages/sdk/cli.cjs'),command],{cwd:root,encoding:'utf8'});assert.equal(result.status,1);assert.match(result.stderr,/Prototype approval is missing or stale/);}const pkg=JSON.parse(await fs.readFile(path.join(root,'package.json')));assert.equal(pkg.scripts.prestart,'matiq-tool prototype check');assert.equal(pkg.scripts.prepackage,'matiq-tool prototype check');
});
