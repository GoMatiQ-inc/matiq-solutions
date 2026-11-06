const fs = require("node:fs/promises");
const path = require("node:path");
const crypto = require("node:crypto");
const AdmZip = require("adm-zip");
const MAX_FILES = 50000,
  MAX_BYTES = 2 * 1024 ** 3,
  MAX_ARCHIVE = 768 * 1024 ** 2;
function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object")
    return (
      "{" +
      Object.keys(value)
        .sort()
        .map((k) => JSON.stringify(k) + ":" + canonical(value[k]))
        .join(",") +
      "}"
    );
  return JSON.stringify(value);
}
const hash = (data) => crypto.createHash("sha256").update(data).digest("hex");
function safePath(name) {
  if (
    typeof name !== "string" ||
    name.length > 400 ||
    /[\\\x00-\x1f:]/.test(name) ||
    name.startsWith("/") ||
    name
      .split("/")
      .some(
        (p) =>
          !p ||
          p === "." ||
          p === ".." ||
          /[. ]$/.test(p) ||
          /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p),
      )
  )
    throw Error("Package contains an unsafe path. Rebuild the tool package.");
  return name;
}
function validateManifest(m) {
  if (
    !m ||
    m.schema !== 1 ||
    !/^[a-z][a-z0-9]*(?:[.-][a-z0-9]+)+$/.test(m.id) ||
    !/^\d+\.\d+\.\d+$/.test(m.version) ||
    typeof m.name !== "string" ||
    !m.name.trim() ||
    m.name.length > 100 ||
    m.sdk !== 1 ||
    !Number.isSafeInteger(m.dataVersion) ||
    m.dataVersion < 1
  )
    throw Error(
      "Invalid tool manifest: require schema/id/name/version/sdk/dataVersion.",
    );
  for (const field of ["adapter", "workspace", "preload"]) safePath(m[field]);
  if (
    !Array.isArray(m.targets) ||
    !m.targets.length ||
    m.targets.some((t) => !/^(darwin|win32|linux)-(arm64|x64)$/.test(t))
  )
    throw Error("Declare supported OS/architecture targets.");
  if (
    !Array.isArray(m.capabilities) ||
    m.capabilities.some(
      (c) =>
        ![
          "microphone",
          "system-audio",
          "keyboard",
          "clipboard",
          "files",
          "network",
          "computer",
        ].includes(c),
    )
  )
    throw Error("Declare supported tool capabilities.");
  if (m.runtime !== "electron-45.2.3")
    throw Error(
      "This SDK supports the qualified Electron 45.2.3 runtime only.",
    );
  return m;
}
function sign(value, privateKey) {
  return crypto
    .sign(null, Buffer.from(canonical(value)), privateKey)
    .toString("base64");
}
function verify(value, signature, publicKey) {
  try {
    return crypto.verify(
      null,
      Buffer.from(canonical(value)),
      publicKey,
      Buffer.from(signature, "base64"),
    );
  } catch {
    return false;
  }
}
async function pack({
  root,
  manifest,
  publisher,
  privateKey,
  include,
  output,
}) {
  validateManifest(manifest);
  const zip = new AdmZip(),
    files = {},
    names = new Set();
  async function walk(relative) {
    safePath(relative);
    if (relative.split("/").includes(".bin")) return;
    const full = path.join(root, relative),
      info = await fs.lstat(full);
    if (info.isSymbolicLink())
      throw Error(
        `Package symlink ${relative}: supply actual release files instead.`,
      );
    if (info.isDirectory()) {
      for (const name of (await fs.readdir(full)).sort())
        await walk(relative + "/" + name);
      return;
    }
    if (!info.isFile()) throw Error(`Unsupported package file: ${relative}`);
    const folded = relative.toLowerCase();
    if (names.has(folded) || ["tool.json", "verified.json"].includes(folded))
      throw Error("Package paths collide on a supported filesystem.");
    names.add(folded);
    if (names.size > MAX_FILES)
      throw Error("Tool package contains too many files.");
    const data = await fs.readFile(full);
    files[relative] = {
      bytes: data.length,
      sha256: hash(data),
      executable: Boolean(info.mode & 0o111),
    };
    zip.addFile(relative, data);
  }
  for (const name of include) await walk(name);
  for (const name of [manifest.adapter, manifest.workspace, manifest.preload])
    if (!files[name]) throw Error(`Tool entry is not packaged: ${name}`);
  if (Object.values(files).reduce((n, f) => n + f.bytes, 0) > MAX_BYTES)
    throw Error("Tool package exceeds the installed size limit.");
  const signed = { manifest, files, publisher };
  zip.addFile(
    "tool.json",
    Buffer.from(
      JSON.stringify({ signed, signature: sign(signed, privateKey) }),
    ),
  );
  const bytes = zip.toBuffer();
  if (bytes.length > MAX_ARCHIVE)
    throw Error("Tool archive exceeds the download size limit.");
  await fs.writeFile(output, bytes, { mode: 0o600 });
  return {
    id: manifest.id,
    version: manifest.version,
    bytes: bytes.length,
    sha256: hash(bytes),
    publisher,
  };
}
function inspect(
  bytes,
  publishers,
  target = process.platform + "-" + process.arch,
) {
  if (!Buffer.isBuffer(bytes) || bytes.length > MAX_ARCHIVE)
    throw Error("Tool download exceeds the package size limit.");
  const zip = new AdmZip(bytes),
    entries = zip.getEntries();
  if (entries.length > MAX_FILES + 1)
    throw Error("Tool package contains too many entries.");
  const seen = new Set();
  for (const e of entries) {
    safePath(e.entryName);
    if (e.isDirectory || ((e.attr >>> 16) & 0o170000) === 0o120000)
      throw Error(
        "Directories and symlinks are not accepted in tool archives.",
      );
    const name = e.entryName.toLowerCase();
    if (name === "verified.json") throw Error("Reserved tool path.");
    if (seen.has(name)) throw Error("Tool archive contains duplicate paths.");
    seen.add(name);
  }
  const header = entries.find((e) => e.entryName === "tool.json");
  if (!header || header.header.size > 4 * 1024 ** 2)
    throw Error("Tool package has no bounded signed manifest.");
  const envelope = JSON.parse(header.getData().toString("utf8"));
  const { signed, signature } = envelope;
  if (
    !signed ||
    !publishers[signed.publisher] ||
    !verify(signed, signature, publishers[signed.publisher])
  )
    throw Error(
      "Tool publisher signature is not trusted. Do not install this package.",
    );
  validateManifest(signed.manifest);
  if (!signed.manifest.targets.includes(target))
    throw Error(`This tool does not support ${target}.`);
  if (!signed.files || Object.keys(signed.files).length !== entries.length - 1)
    throw Error("Package inventory does not match its signed contents.");
  let total = 0;
  for (const e of entries) {
    if (e === header) continue;
    const expected = signed.files[e.entryName];
    if (
      !expected ||
      !Number.isSafeInteger(expected.bytes) ||
      expected.bytes < 0 ||
      expected.bytes !== e.header.size ||
      !/^[a-f0-9]{64}$/.test(expected.sha256)
    )
      throw Error("Package file size/inventory verification failed.");
    total += expected.bytes;
  }
  if (total > MAX_BYTES)
    throw Error("Tool package exceeds the installed size limit.");
  for (const e of entries)
    if (e !== header) {
      const data = e.getData();
      if (
        data.length !== signed.files[e.entryName].bytes ||
        hash(data) !== signed.files[e.entryName].sha256
      )
        throw Error("Package file hash verification failed.");
    }
  for (const field of ["adapter", "workspace", "preload"])
    if (!Object.hasOwn(signed.files, signed.manifest[field]))
      throw Error("Tool entry is missing from signed inventory.");
  return {
    envelope,
    manifest: signed.manifest,
    files: signed.files,
    publisher: signed.publisher,
    entries: entries.filter((e) => e !== header),
    sha256: hash(bytes),
  };
}
async function unpack(verified, destination) {
  await fs.mkdir(destination, { recursive: false, mode: 0o700 });
  try {
    for (const entry of verified.entries) {
      const file = path.join(destination, safePath(entry.entryName));
      await fs.mkdir(path.dirname(file), { recursive: true, mode: 0o700 });
      await fs.writeFile(file, entry.getData(), {
        flag: "wx",
        mode: verified.files[entry.entryName].executable ? 0o700 : 0o600,
      });
    }
    await fs.writeFile(
      path.join(destination, "verified.json"),
      JSON.stringify({ envelope: verified.envelope, sha256: verified.sha256 }),
      { flag: "wx", mode: 0o600 },
    );
  } catch (error) {
    await fs.rm(destination, { recursive: true, force: true });
    throw error;
  }
}
module.exports = {
  canonical,
  hash,
  safePath,
  validateManifest,
  sign,
  verify,
  pack,
  inspect,
  unpack,
  MAX_ARCHIVE,
};
