globalThis.fixtureShell = require("@matiq-solutions/shell");
const fs = require("node:fs/promises");
const config = JSON.parse(
  require("node:fs").readFileSync(process.env.MATIQ_FIXTURE_CONFIG, "utf8"),
);
require("../app/main.cjs")
  .launch({
    ...config,
    download: async (url) => fs.readFile(config.packages[url]),
  })
  .then(async ({store}) => {
    const path=require("node:path"),marker=path.join(config.profile,"restart-probe.json");
    let probe;
    try { probe=JSON.parse(await fs.readFile(marker,"utf8")); }
    catch(error) { if(error.code==="ENOENT")return;throw error; }
    if(probe.previousPid===process.pid)return;
    const record=(await store.state()).tools[probe.id];
    await fs.writeFile(marker+".ready",JSON.stringify({pid:process.pid,version:record.version,pending:Boolean(record.pending)}));
    const {app}=require("electron");
    const watchdog=setTimeout(()=>{console.error("Restart probe stop acknowledgement timed out");app.exit(1);},30000);
    const poll=setInterval(async()=>{try{await fs.access(marker+".stop");clearInterval(poll);clearTimeout(watchdog);app.quit();}catch(error){if(error.code!=="ENOENT"){console.error(error.message);app.exit(1);}}},100);
    poll.unref();
  })
  .catch((e) => {
    console.error(e);
    require("electron").app.exit(1);
  });
