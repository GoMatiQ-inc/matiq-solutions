const config=JSON.parse(require("node:fs").readFileSync(process.env.MATIQ_FIXTURE_CONFIG,"utf8"));
require("electron").dialog.showErrorBox=(_title,message)=>{globalThis.fixtureCloseError=message;};
require("@matiq-solutions/runtime/standalone.cjs").launch({root:config.root,profile:config.profile}).then(result=>{globalThis.fixtureStandalone=result;}).catch(error=>{console.error(error);require("electron").app.exit(1);});
