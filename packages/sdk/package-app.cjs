const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const asar = require("@electron/asar");
const { pack, validateManifest, sign, hash, safePath, canonical } = require("./index.cjs");

// Consume the already packaged app, including its signed unpacked native files.
// Build/sign the standalone first; this step never recompiles or modifies it.
async function packApp({ resources, manifest, target, extra = [], output, privateKey, publisher = "matiq-solutions-release-v1", url }) {
  validateManifest(manifest);
  if (!manifest.targets.includes(target)) throw Error("Choose a target declared by this tool.");
  if (!url || !url.startsWith("https://")) throw Error("Supply the immutable HTTPS release asset URL.");
  for (const file of [output, output + ".release.json"]) {
    try { await fs.lstat(file); throw Error("Release output already exists. Use a new output path; published artifacts are immutable."); }
    catch (error) { if (error.code !== "ENOENT") throw error; }
  }
  const stage = await fs.mkdtemp(path.join(os.tmpdir(), "matiq-package-app-"));
  try {
    asar.extractAll(path.join(resources, "app.asar"), stage);
    const pkg = JSON.parse(await fs.readFile(path.join(stage, "package.json"), "utf8"));
    if (pkg.version !== manifest.version) throw Error("The packaged app version differs from the tool manifest. Rebuild the same release.");
    const bundled = validateManifest(JSON.parse(await fs.readFile(path.join(stage, "matiq-tool.json"), "utf8")));
    if (canonical(bundled) !== canonical(manifest)) throw Error("The packaged app manifest differs from the release manifest. Rebuild the exact tool source.");
    for (const name of extra) {
      safePath(name);
      if (name.includes("/") || name === "app.asar" || name === "app.asar.unpacked") throw Error("Extra resources must be named top-level resource directories.");
      try { await fs.lstat(path.join(stage, name)); throw Error("An extra resource would overwrite packaged app content."); }
      catch (error) { if (error.code !== "ENOENT") throw error; }
      await fs.cp(path.join(resources, name), path.join(stage, name), { recursive: true, dereference: false, errorOnExist: true, force: false });
    }
    const include = await fs.readdir(stage);
    const narrowed = { ...manifest, targets: [target] };
    const archive = path.join(stage, ".output.mqt");
    await pack({ root: stage, manifest: narrowed, publisher, privateKey, include, output: archive });
    const bytes = await fs.readFile(archive);
    const signed = {
      schema: 1, id: manifest.id, name: manifest.name,
      description: manifest.description || "", version: manifest.version,
      capabilities: manifest.capabilities, sdk: manifest.sdk,
      dataVersion: manifest.dataVersion, runtime: manifest.runtime,
      targets: [target],
      packages: { [target]: { url, bytes: bytes.length, sha256: hash(bytes) } },
    };
    const release = { signed, publisher, signature: sign(signed, privateKey) };
    const descriptor = path.join(stage, ".release.json");
    await fs.writeFile(descriptor, JSON.stringify(release, null, 2) + "\n", { flag: "wx" });
    // Exclusive creation prevents a retry or concurrent publisher from changing
    // either existing artifact. Roll back only the archive this call created.
    await fs.copyFile(archive, output, require("node:fs").constants.COPYFILE_EXCL);
    try { await fs.copyFile(descriptor, output + ".release.json", require("node:fs").constants.COPYFILE_EXCL); }
    catch (error) { await fs.unlink(output); throw error; }
    return release;
  } finally { await fs.rm(stage, { recursive: true, force: true }); }
}
module.exports = { packApp };
