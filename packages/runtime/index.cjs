const fs = require("node:fs/promises");
const path = require("node:path");
const { randomUUID } = require("node:crypto");
const {
  inspect,
  unpack,
  hash,
  verify,
  MAX_ARCHIVE,
} = require("@matiq-solutions/sdk");
async function atomicJSON(file, value) {
  await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
  const tmp = file + "." + randomUUID() + ".tmp";
  try {
    await fs.writeFile(tmp, JSON.stringify(value, null, 2), {
      mode: 0o600,
      flag: "wx",
    });
    await fs.rename(tmp, file);
  } finally {
    await fs.rm(tmp, { force: true });
  }
}
function newer(a, b) {
  const x = a.split(".").map(Number),
    y = b.split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    if (x[i] !== y[i]) return x[i] > y[i];
  }
  return false;
}
class ToolStore {
  constructor({
    root,
    publishers,
    target = process.platform + "-" + process.arch,
  }) {
    this.root = root;
    this.publishers = publishers;
    this.target = target;
    this.file = path.join(root, "installed.json");
    this.busy = false;
  }
  async state() {
    try {
      const x = JSON.parse(await fs.readFile(this.file, "utf8"));
      if (x.schema !== 1 || !x.tools || typeof x.tools !== "object")
        throw Error("Installed tool registry is damaged. Restore its backup.");
      return x;
    } catch (e) {
      if (e.code === "ENOENT") return { schema: 1, tools: {} };
      throw e;
    }
  }
  async exclusive(fn) {
    if (this.busy)
      throw Error("Wait for the current tool installation to finish.");
    this.busy = true;
    try {
      return await fn();
    } finally {
      this.busy = false;
    }
  }
  async install(
    bytes,
    {
      update = false,
      approveCapabilities = false,
      expectedId,
      expectedVersion,
      expectedCapabilities,
    } = {},
  ) {
    return this.exclusive(async () => {
      const v = inspect(bytes, this.publishers, this.target);
      if (
        (expectedId && v.manifest.id !== expectedId) ||
        (expectedVersion && v.manifest.version !== expectedVersion)
      )
        throw Error(
          "Package identity does not match the selected catalog release.",
        );
      if (
        expectedCapabilities &&
        JSON.stringify([...expectedCapabilities].sort()) !==
          JSON.stringify([...v.manifest.capabilities].sort())
      )
        throw Error(
          "Package capabilities differ from the marketplace permissions you reviewed. Refresh the catalog.",
        );
      const state = await this.state(),
        old = state.tools[v.manifest.id];
      if (update && !old)
        throw Error(
          "Updates apply only to installed tools. Choose Install first.",
        );
      if (old && !update)
        throw Error("This tool is already installed. Use its update action.");
      if (old && !newer(v.manifest.version, old.version))
        throw Error("Only a newer release can be staged as an update.");
      if (old && v.manifest.dataVersion !== old.manifest.dataVersion)
        throw Error(
          "This update changes the data schema. An explicitly qualified migration is required.",
        );
      if (
        old &&
        !approveCapabilities &&
        v.manifest.capabilities.some(
          (c) => !old.manifest.capabilities.includes(c),
        )
      )
        throw Error(
          "Review and approve the new tool permissions before updating.",
        );
      const packages = path.join(this.root, "packages");
      await fs.mkdir(packages, { recursive: true, mode: 0o700 });
      const location = path.join(packages, v.sha256);
      const staging = path.join(packages, ".staging-" + randomUUID());
      const record = {
        id: v.manifest.id,
        version: v.manifest.version,
        manifest: v.manifest,
        directory: location,
        sha256: v.sha256,
        enabled: true,
      };
      let promoted = false;
      try {
        await unpack(v, staging);
        let reusable = false;
        try {
          await this.verifyDirectory(record);
          reusable = true;
        } catch (error) {
          if (error.code !== "ENOENT" && error.code !== "INTEGRITY")
            throw error;
        }
        if (!reusable) {
          await fs.rm(location, { recursive: true, force: true });
          await fs.rename(staging, location);
          promoted = true;
        }
        if (old) old.pending = record;
        else state.tools[record.id] = record;
        await atomicJSON(this.file, state);
        return record;
      } catch (error) {
        if (promoted) await fs.rm(location, { recursive: true, force: true });
        throw error;
      } finally {
        await fs.rm(staging, { recursive: true, force: true });
      }
    });
  }
  async activatePending() {
    return this.exclusive(async () => {
      const state = await this.state();
      for (const [id, t] of Object.entries(state.tools))
        if (t.pending)
          state.tools[id] = {
            ...t.pending,
            previous: { ...t, pending: undefined, previous: undefined },
            enabled: t.enabled,
          };
      await atomicJSON(this.file, state);
      return state;
    });
  }
  async rollback(id) {
    return this.exclusive(async () => {
      const s = await this.state(),
        t = s.tools[id];
      if (!t?.previous)
        throw Error("No previous compatible release is available.");
      if (t.previous.manifest.dataVersion !== t.manifest.dataVersion)
        throw Error("Restore a data backup before rolling back.");
      s.tools[id] = { ...t.previous };
      await atomicJSON(this.file, s);
    });
  }
  async enable(id, enabled) {
    return this.exclusive(async () => {
      const s = await this.state();
      if (!s.tools[id] || typeof enabled !== "boolean")
        throw Error("Choose an installed tool and an enabled state.");
      s.tools[id].enabled = enabled;
      await atomicJSON(this.file, s);
    });
  }
  async uninstall(id) {
    return this.exclusive(async () => {
      const s = await this.state();
      if (!s.tools[id]) throw Error("This tool is not installed.");
      delete s.tools[id];
      await atomicJSON(this.file, s);
    });
  }
  async loadRecord(id) {
    const t = (await this.state()).tools[id];
    if (!t?.enabled)
      throw Error("Install and enable the tool before opening it.");
    await this.verifyDirectory(t);

    return t;
  }
  async verifyDirectory(t) {
    const fail = (message) =>
      Object.assign(Error(message + " Reinstall the verified tool."), {
        code: "INTEGRITY",
      });
    if (
      !/^[a-f0-9]{64}$/.test(t.sha256) ||
      t.directory !== path.join(this.root, "packages", t.sha256)
    )
      throw fail("Installed tool location is invalid.");
    const metadata = path.join(t.directory, "verified.json");
    let v;
    try {
      const info = await fs.lstat(metadata);
      if (!info.isFile() || info.isSymbolicLink() || info.size > 4 * 1024 ** 2)
        throw fail("Installed tool metadata is invalid.");
      v = JSON.parse(await fs.readFile(metadata, "utf8"));
    } catch (error) {
      if (error instanceof SyntaxError)
        throw fail("Installed tool metadata is damaged.");
      throw error;
    }
    const signed = v.envelope?.signed;
    if (
      !signed ||
      !this.publishers[signed.publisher] ||
      !verify(
        signed,
        v.envelope.signature,
        this.publishers[signed.publisher],
      ) ||
      v.sha256 !== t.sha256 ||
      JSON.stringify(signed.manifest) !== JSON.stringify(t.manifest)
    )
      throw fail("Installed tool metadata signature changed.");
    const found = new Set();
    async function walk(directory, relative = "") {
      for (const entry of await fs.readdir(directory, {
        withFileTypes: true,
      })) {
        const name = relative ? relative + "/" + entry.name : entry.name;
        if (entry.isSymbolicLink())
          throw fail("Installed tool contains a symbolic link.");
        if (entry.isDirectory()) {
          await walk(path.join(directory, entry.name), name);
          continue;
        }
        if (name === "verified.json") continue;
        const f = signed.files[name];
        if (!entry.isFile() || !f)
          throw fail("Installed tool contains unexpected files.");
        found.add(name);
        const full = path.join(directory, entry.name),
          info = await fs.lstat(full);
        if (info.size !== f.bytes || hash(await fs.readFile(full)) !== f.sha256)
          throw fail("Installed tool files changed.");
      }
    }
    await walk(t.directory);
    if (found.size !== Object.keys(signed.files).length)
      throw fail("Installed tool files are incomplete.");
  }
}
async function download(
  url,
  { sha256, bytes, signal, progress = () => {}, fetchImpl = fetch } = {},
) {
  const parsed = new URL(url);
  if (parsed.protocol !== "https:") throw Error("Tool releases require HTTPS.");
  if (
    !Number.isSafeInteger(bytes) ||
    bytes < 1 ||
    bytes > MAX_ARCHIVE ||
    !/^[a-f0-9]{64}$/.test(sha256)
  )
    throw Error("Invalid bounded release metadata.");
  const response = await fetchImpl(url, { signal, redirect: "follow" });
  if (!response.ok)
    throw Error(`Download failed (${response.status}). Retry when connected.`);
  if (response.url && new URL(response.url).protocol !== "https:")
    throw Error("Download redirected away from HTTPS.");
  const chunks = [];
  let size = 0;
  for await (const chunk of response.body) {
    size += chunk.length;
    if (size > bytes) throw Error("Download exceeds its declared size.");
    chunks.push(Buffer.from(chunk));
    progress(size / bytes);
  }
  const data = Buffer.concat(chunks);
  if (size !== bytes || hash(data) !== sha256)
    throw Error(
      "Downloaded package does not match the release hash/size. Retry the official release.",
    );
  return data;
}
function verifyCatalog(envelope, publishers, previousSequence = 0) {
  const { signed, signature, publisher } = envelope || {};
  if (
    !signed ||
    !publishers[publisher] ||
    !verify(signed, signature, publishers[publisher])
  )
    throw Error("Marketplace publisher signature is not trusted.");
  if (
    signed.schema !== 1 ||
    !Number.isSafeInteger(signed.sequence) ||
    signed.sequence < previousSequence ||
    !Array.isArray(signed.tools) ||
    !Number.isFinite(Date.parse(signed.expires)) ||
    Date.parse(signed.expires) < Date.now()
  )
    throw Error(
      "Marketplace is expired or older than the accepted catalog. Reconnect for an official refresh.",
    );
  const ids = new Set();
  for (const t of signed.tools) {
    if (
      !t ||
      typeof t.id !== "string" ||
      ids.has(t.id) ||
      !/^\d+\.\d+\.\d+$/.test(t.version) ||
      !Array.isArray(t.targets) ||
      !t.packages
    )
      throw Error("Invalid marketplace entry.");
    ids.add(t.id);
  }
  return signed;
}
function updatesFor(state, catalog, target) {
  return catalog.tools.filter(
    (t) =>
      state.tools[t.id] &&
      t.targets.includes(target) &&
      newer(
        t.version,
        state.tools[t.id].pending?.version || state.tools[t.id].version,
      ),
  );
}
function validateConsent(tool, { reviewedVersion, reviewedCapabilities }) {
  if (
    reviewedVersion !== tool.version ||
    !Array.isArray(reviewedCapabilities) ||
    JSON.stringify([...reviewedCapabilities].sort()) !==
      JSON.stringify([...(tool.capabilities || [])].sort())
  )
    throw Error(
      "This release changed while you were reviewing it. Review the new version and permissions before installing.",
    );
}

module.exports = {
  validateConsent,
  ToolStore,
  atomicJSON,
  newer,
  download,
  verifyCatalog,
  updatesFor,
};
