const fs = require("node:fs/promises"), path = require("node:path"), crypto = require("node:crypto");
function alive(pid) {
  if (!Number.isSafeInteger(pid) || pid < 1) throw Error("Tool ownership record is damaged. Inspect the tool-locks directory before retrying.");
  try { process.kill(pid, 0); return true; }
  catch (error) { if (error.code === "ESRCH") return false; if (error.code === "EPERM") return true; throw error; }
}
async function acquireToolLease({ root, id, owner }) {
  if (!require("@matiq-solutions/sdk").validToolId(id)) throw Error("Use the manifest tool ID for its ownership lock.");
  await fs.mkdir(root, { recursive: true, mode: 0o700 });
  const file = path.join(root, id + ".json"), recovery = file + ".recovery";
  const record = { pid: process.pid, owner, nonce: crypto.randomUUID() };
  async function claim() { await fs.writeFile(file, JSON.stringify(record), { flag: "wx", mode: 0o600 }); }
  try { await claim(); }
  catch (error) {
    if (error.code !== "EEXIST") throw error;
    // Only one recovery may inspect/remove a dead owner's record. Without this
    // mutex, simultaneous startup could accidentally remove a fresh claimant.
    let gate;
    try { gate = await fs.open(recovery, "wx", 0o600); }
    catch (e) {
      if (e.code === "EEXIST") throw Error("Another tool startup is recovering ownership. Retry shortly; if no startup is running, inspect the stale recovery file in tool-locks.");
      throw e;
    }
    try {
      let previous;
      try { previous = JSON.parse(await fs.readFile(file, "utf8")); }
      catch (e) { if (e.code !== "ENOENT") throw Error("Tool ownership record is damaged. Inspect tool-locks before retrying."); }
      if (previous) {
        if (alive(previous.pid)) throw Error(`This tool is already open in ${previous.owner || "another app"}. Close it there before opening it here.`);
        await fs.unlink(file);
      }
      try { await claim(); }
      catch (e) { if (e.code === "EEXIST") throw Error("This tool was opened by another app. Close it there before retrying."); throw e; }
    } finally { await gate.close(); await fs.unlink(recovery); }
  }
  let released = false;
  return { async release() {
    if (released) return;
    const current = JSON.parse(await fs.readFile(file, "utf8"));
    if (current.nonce !== record.nonce) throw Error("Tool ownership changed unexpectedly. Keep the tool closed and inspect tool-locks.");
    await fs.unlink(file); released = true;
  } };
}
module.exports = { acquireToolLease };
