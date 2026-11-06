const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const root = path.join(__dirname, "..");
const names = ["sdk", "runtime", "shell"];
function assetURL(name, version) {
  return `https://github.com/GoMatiQ-inc/matiq-solutions/releases/download/sdk-v${version}/matiq-solutions-${name}-${version}.tgz`;
}
async function packageSDK(output) {
  await fs.mkdir(output, { recursive: true });
  const stage = await fs.mkdtemp(path.join(os.tmpdir(), "matiq-sdk-release-"));
  try {
    for (const name of names) {
      const source = path.join(root, "packages", name);
      const pkg = JSON.parse(await fs.readFile(path.join(source, "package.json"), "utf8"));
      const destination = path.join(stage, name);
      await fs.mkdir(destination);
      // Use npm's own packlist. Never copy workspace node_modules or ignored files.
      const listing = JSON.parse(execFileSync("npm", ["pack", "--dry-run", "--json", "--ignore-scripts"], { cwd: source, encoding: "utf8" }))[0];
      for (const file of listing.files) {
        const to = path.join(destination, file.path);
        await fs.mkdir(path.dirname(to), { recursive: true });
        await fs.copyFile(path.join(source, file.path), to);
      }
      for (const [dependency, version] of Object.entries(pkg.dependencies || {}))
        if (dependency.startsWith("@matiq-solutions/"))
          pkg.dependencies[dependency] = assetURL(dependency.split("/")[1], version);
      await fs.writeFile(path.join(destination, "package.json"), JSON.stringify(pkg, null, 2) + "\n");
      execFileSync("npm", ["pack", "--ignore-scripts", "--pack-destination", path.resolve(output)], { cwd: destination, stdio: "pipe" });
    }
  } finally { await fs.rm(stage, { recursive: true, force: true }); }
}
if (require.main === module) packageSDK(path.resolve(process.argv[2] || "dist/sdk")).catch(e => { console.error(e.message); process.exitCode = 1; });
module.exports = { packageSDK, assetURL };
