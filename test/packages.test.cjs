const test = require("node:test"),
  assert = require("node:assert/strict");
const fs = require("node:fs/promises"),
  os = require("node:os"),
  path = require("node:path"),
  crypto = require("node:crypto");
const AdmZip = require("adm-zip");
const sdk = require("@matiq-solutions/sdk");
const {
  ToolStore,
  updatesFor,
  verifyCatalog,
  download,
} = require("@matiq-solutions/runtime");
const key = crypto.generateKeyPairSync("ed25519"),
  trust = { test: key.publicKey.export({ type: "spki", format: "pem" }) };
const manifest = {
  schema: 1,
  id: "com.matiq.example",
  name: "Example",
  version: "1.0.0",
  sdk: 1,
  dataVersion: 1,
  runtime: "electron-45.2.3",
  targets: ["linux-x64"],
  capabilities: [],
  adapter: "src/tool.cjs",
  workspace: "src/index.html",
  preload: "src/preload.cjs",
};
async function fixture(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "matiq-sdk-"));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  await fs.mkdir(path.join(root, "src"));
  for (const [n, v] of Object.entries({
    "tool.cjs": "module.exports={activate(){}}",
    "index.html": "<h1>Example</h1>",
    "preload.cjs": "// sandbox preload",
  }))
    await fs.writeFile(path.join(root, "src", n), v);
  return root;
}
async function packed(root, changes = {}) {
  const output = path.join(root, "tool.mqt");
  await sdk.pack({
    root,
    manifest: { ...manifest, ...changes },
    publisher: "test",
    privateKey: key.privateKey,
    include: ["src"],
    output,
  });
  return fs.readFile(output);
}
function store(root) {
  return new ToolStore({
    root: path.join(root, "store"),
    publishers: trust,
    target: "linux-x64",
  });
}
test("verified package round-trips into a separate installed directory", async (t) => {
  const root = await fixture(t),
    s = store(root);
  assert.deepEqual((await s.state()).tools, {});
  const b = await packed(root);
  await s.install(b);
  const r = await s.loadRecord(manifest.id);
  assert.equal(r.version, "1.0.0");
  assert.equal(
    await fs.readFile(path.join(r.directory, "src/index.html"), "utf8"),
    "<h1>Example</h1>",
  );
});
test("untrusted signer, altered payload and unsupported target never install", async (t) => {
  const root = await fixture(t),
    b = await packed(root);
  assert.throws(() => sdk.inspect(b, {}), /signature/);
  assert.throws(() => sdk.inspect(b, trust, "win32-x64"), /support/);
  const z = new AdmZip(b);
  z.updateFile("src/index.html", Buffer.from("<h1>Changed</h1>"));
  await assert.rejects(store(root).install(z.toBuffer()), /verification/);
  assert.deepEqual((await store(root).state()).tools, {});
});
test("signed manifest cannot escape the installation directory", () => {
  for (const f of [
    "../secret",
    "/tmp/file",
    "src/../file",
    "src\\file",
    "C:/file",
    "src/NUL.txt",
    "src/file.",
    "src//file",
  ])
    assert.throws(() => sdk.safePath(f), /unsafe/);
});
test('packaging rejects symbolic links and archives reject case collisions',async t=>{
 const root=await fixture(t);const link=path.join(root,'src/link');
 await fs.symlink(process.platform==='win32'?path.join(root,'src'):'index.html',link,process.platform==='win32'?'junction':'file');
 await assert.rejects(packed(root),/symlink/);await fs.rm(link,{recursive:true});
 const zip=new AdmZip(await packed(root));zip.addFile('SRC/INDEX.HTML',Buffer.from('collision'));assert.throws(()=>sdk.inspect(zip.toBuffer(),trust,'linux-x64'),/duplicate paths/);
});

test("updates target installed IDs only and activate on restart", async (t) => {
  const root = await fixture(t),
    s = store(root);
  const update = await packed(root, { version: "1.1.0" });
  await assert.rejects(s.install(update, { update: true }), /installed/);
  await s.install(await packed(root));
  await s.install(update, { update: true });
  assert.equal((await s.loadRecord(manifest.id)).version, "1.0.0");
  const c = {
    tools: [
      { ...manifest, version: "1.1.0" },
      { ...manifest, id: "com.matiq.other", version: "2.0.0" },
    ],
  };
  assert.deepEqual(updatesFor(await s.state(), c, "linux-x64"), []);
  const next = {
    tools: [
      { ...manifest, version: "1.2.0" },
      { ...manifest, id: "com.matiq.other", version: "2.0.0" },
    ],
  };
  assert.deepEqual(
    updatesFor(await s.state(), next, "linux-x64").map((x) => x.id),
    [manifest.id],
  );
  await s.activatePending();
  assert.equal((await s.loadRecord(manifest.id)).version, "1.1.0");
  await s.rollback(manifest.id);
  assert.equal((await s.loadRecord(manifest.id)).version, "1.0.0");
});
test("schema changes and unapproved capability growth preserve current release", async (t) => {
  const root = await fixture(t),
    s = store(root);
  await s.install(await packed(root));
  await assert.rejects(
    s.install(await packed(root, { version: "1.1.0", dataVersion: 2 }), {
      update: true,
    }),
    /schema/,
  );
  const b = await packed(root, { version: "1.1.0", capabilities: ["network"] });
  await assert.rejects(s.install(b, { update: true }), /permissions/);
  assert.equal((await s.loadRecord(manifest.id)).version, "1.0.0");
  await s.install(b, { update: true, approveCapabilities: true });
  assert.ok((await s.state()).tools[manifest.id].pending);
});
test("uninstall stops eligibility and preserves tool data", async (t) => {
  const root = await fixture(t),
    s = store(root);
  await s.install(await packed(root));
  const data = path.join(root, "projects");
  await fs.mkdir(data);
  await fs.writeFile(path.join(data, "drawing.json"), "saved");
  await s.uninstall(manifest.id);
  assert.deepEqual(
    updatesFor(
      await s.state(),
      { tools: [{ ...manifest, version: "2.0.0" }] },
      "linux-x64",
    ),
    [],
  );
  assert.equal(
    await fs.readFile(path.join(data, "drawing.json"), "utf8"),
    "saved",
  );
});
test("installed file or signed inventory changes are rejected before code load", async (t) => {
  const root = await fixture(t),
    s = store(root);
  await s.install(await packed(root));
  const r = await s.loadRecord(manifest.id);
  await fs.writeFile(path.join(r.directory, "src/tool.cjs"), "malicious");
  await assert.rejects(s.loadRecord(manifest.id), /files changed/);
  const f = path.join(r.directory, "verified.json"),
    v = JSON.parse(await fs.readFile(f));
  v.envelope.signed.files["src/tool.cjs"].sha256 = sdk.hash(
    Buffer.from("malicious"),
  );
  await fs.writeFile(f, JSON.stringify(v));
  await assert.rejects(s.loadRecord(manifest.id), /signature changed/);
});
test('a failed registry commit preserves the active release and cleans staging',async t=>{
 const root=await fixture(t),s=store(root);await s.install(await packed(root));const bytes=await packed(root,{version:'1.1.0'}),rename=fs.rename;
 fs.rename=async(from,to)=>{if(to===s.file)throw Object.assign(Error('Filesystem has no space for the registry transaction'),{code:'ENOSPC'});return rename(from,to);};
 try{await assert.rejects(s.install(bytes,{update:true}),/no space/);}finally{fs.rename=rename;}
 assert.equal((await s.loadRecord(manifest.id)).version,'1.0.0');assert.equal((await s.state()).tools[manifest.id].pending,undefined);assert.equal((await fs.readdir(path.join(s.root,'packages'))).some(n=>n.startsWith('.staging-')),false);
});

test("catalog authentication, expiry and replay protections", () => {
  const signed = {
    schema: 1,
    sequence: 4,
    expires: new Date(Date.now() + 60000).toISOString(),
    tools: [],
  };
  const e = {
    signed,
    publisher: "test",
    signature: sdk.sign(signed, key.privateKey),
  };
  assert.equal(verifyCatalog(e, trust, 3).sequence, 4);
  assert.throws(() => verifyCatalog(e, trust, 5), /older/);
  assert.throws(
    () => verifyCatalog({ ...e, signature: "changed" }, trust),
    /signature/,
  );
  const old = { ...signed, expires: "2020-01-01" };
  assert.throws(
    () =>
      verifyCatalog(
        {
          signed: old,
          publisher: "test",
          signature: sdk.sign(old, key.privateKey),
        },
        trust,
      ),
    /expired/,
  );
});
test("download enforces HTTPS, exact length, hash and bounded streaming", async () => {
  const b = Buffer.from("release"),
    metadata = { bytes: b.length, sha256: sdk.hash(b) };
  const fetchImpl = async () => ({
    ok: true,
    url: "https://example.com/tool",
    body: [b],
  });
  assert.deepEqual(
    await download("https://example.com/tool", { ...metadata, fetchImpl }),
    b,
  );
  await assert.rejects(
    download("http://example.com/tool", { ...metadata, fetchImpl }),
    /HTTPS/,
  );
  await assert.rejects(
    download("https://example.com/tool", { ...metadata, bytes: 2, fetchImpl }),
    /exceeds/,
  );
  await assert.rejects(
    download("https://example.com/tool", {
      ...metadata,
      sha256: "0".repeat(64),
      fetchImpl,
    }),
    /hash/,
  );
});

test("catalog identity mismatch cannot change the installed registry", async (t) => {
  const root = await fixture(t),
    s = store(root);
  await assert.rejects(
    s.install(await packed(root), { expectedId: "com.matiq.other" }),
    /identity/,
  );
  assert.deepEqual((await s.state()).tools, {});
});

test("an interrupted extraction is repaired before registration", async (t) => {
  const root = await fixture(t),
    s = store(root),
    bytes = await packed(root),
    partial = path.join(s.root, "packages", sdk.hash(bytes));
  await fs.mkdir(path.join(partial, "src"), { recursive: true });
  await fs.writeFile(path.join(partial, "src/index.html"), "incomplete");
  await s.install(bytes);
  assert.equal((await s.loadRecord(manifest.id)).version, "1.0.0");
});
test("uninstall then reinstall repairs corrupt retained package bytes", async (t) => {
  const root = await fixture(t),
    s = store(root),
    bytes = await packed(root);
  await s.install(bytes);
  const record = await s.loadRecord(manifest.id);
  await s.uninstall(manifest.id);
  await fs.writeFile(path.join(record.directory, "src/index.html"), "changed");
  await s.install(bytes);
  await s.loadRecord(manifest.id);
});
test("reviewed capabilities must exactly match the signed package", async (t) => {
  const root = await fixture(t),
    s = store(root);
  await assert.rejects(
    s.install(await packed(root, { capabilities: ["network"] }), {
      approveCapabilities: true,
      expectedCapabilities: [],
    }),
    /capabilities differ/,
  );
  assert.deepEqual((await s.state()).tools, {});
});
test("unexpected files cannot shadow signed module resolution", async (t) => {
  const root = await fixture(t),
    s = store(root);
  await s.install(await packed(root));
  const record = await s.loadRecord(manifest.id);
  await fs.writeFile(path.join(record.directory, "src/unlisted.js"), "changed");
  await assert.rejects(s.loadRecord(manifest.id), /unexpected files/);
});

test("a refreshed release cannot inherit consent from an older review dialog", () => {
  const { validateConsent } = require("@matiq-solutions/runtime");
  const tool = { version: "1.1.0", capabilities: ["computer"] };
  assert.throws(
    () =>
      validateConsent(tool, {
        reviewedVersion: "1.0.0",
        reviewedCapabilities: [],
      }),
    /changed while/,
  );
  assert.throws(
    () =>
      validateConsent(tool, {
        reviewedVersion: "1.1.0",
        reviewedCapabilities: [],
      }),
    /changed while/,
  );
  assert.doesNotThrow(() =>
    validateConsent(tool, {
      reviewedVersion: "1.1.0",
      reviewedCapabilities: ["computer"],
    }),
  );
});
