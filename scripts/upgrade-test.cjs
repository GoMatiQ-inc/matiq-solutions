const fs=require("node:fs/promises"),{createReadStream,realpathSync}=require("node:fs"),path=require("node:path"),os=require("node:os"),http=require("node:http"),net=require("node:net"),assert=require("node:assert/strict"),{execFileSync}=require("node:child_process"),{createHash,randomUUID,createPrivateKey,createPublicKey}=require("node:crypto");
const {_electron:electron}=require("playwright"),{expect}=require("playwright/test"),sdk=require("@matiq-solutions/sdk"),{create}=require("@matiq-solutions/sdk/cli.cjs"),{ToolStore}=require("@matiq-solutions/runtime"),lifecycle=require("@matiq-solutions/sdk/fixture-lifecycle.cjs");
const root=path.resolve(__dirname,".."),baseVersion=require("../package.json").version,targetVersion=baseVersion.split(".").map((n,i)=>Number(n)+(i===2?1:0)).join(".");
const run=(file,args)=>execFileSync(file,args,{encoding:"utf8",timeout:120000});
async function waitFor(test,label,timeout=60000){const end=Date.now()+timeout;while(Date.now()<end){const result=await test();if(result)return result;await new Promise(resolve=>setTimeout(resolve,200));}throw Error(label+" timed out. Inspect upgrade-diagnostic.json before retrying.");}
function processesIn(directory){return run("/bin/ps",["-axww","-o","pid=,uid=,comm="]).split("\n").flatMap(line=>{const m=/^\s*(\d+)\s+(\d+)\s+(.+)$/.exec(line);return m&&m[3].startsWith(directory+path.sep)?[{pid:Number(m[1]),uid:Number(m[2]),executable:m[3]}]:[];});}
function applicationInfo(pid){return JSON.parse(run("/usr/bin/osascript",["-l","JavaScript","-e",`ObjC.import('AppKit');var apps=$.NSRunningApplication.runningApplicationsWithBundleIdentifier('com.matiq.solutions');var result={found:false};for(var i=0;i<apps.count;i++){var app=apps.objectAtIndex(i);if(app.processIdentifier===${Number(pid)})result={found:true,finished:app.isFinishedLaunching,terminated:app.isTerminated,bundle:ObjC.unwrap(app.bundleURL.path)};}JSON.stringify(result);`]));}
async function stopOwned(directories){
 const snapshots=directories.flatMap(processesIn).map(child=>lifecycle.capture({pid:child.pid}));
 for(const child of snapshots){try{process.kill(child.pid,"SIGTERM");}catch(error){if(error.code!=="ESRCH")throw error;}}
 for(const child of snapshots){try{await lifecycle.verifyStopped(child);}catch(error){const current=directories.flatMap(processesIn).find(item=>item.pid===child.pid);if(current){assert.equal(current.uid,process.getuid());process.kill(child.pid,"SIGKILL");}await lifecycle.verifyStopped(child);}}
}
async function hash(file){const digest=createHash("sha256");for await(const chunk of createReadStream(file))digest.update(chunk);return digest.digest("hex");}
(async()=>{
 if(process.platform!=="darwin"||process.env.GITHUB_ACTIONS!=="true"||process.env.RUNNER_ENVIRONMENT!=="github-hosted")throw Error("Run signed suite upgrade qualification only on a disposable native GitHub-hosted Mac.");
 const {publishers}=require("../catalog/trust.json"),privateKey=createPrivateKey(process.env.MATIQ_TOOL_SIGNING_KEY||"");
 assert.equal(createPublicKey(privateKey).export({type:"spki",format:"pem"}),publishers["matiq-solutions-release-v1"],"Use the existing protected tool publisher for the qualification fixture.");
 const profile=path.join(os.homedir(),"Library/Application Support/MatiQ Solutions"),cache=path.join(os.homedir(),"Library/Caches/matiq-solutions-updater"),shipIt=path.join(os.homedir(),"Library/Caches/com.matiq.solutions.ShipIt");
 let existingProfile=false,existingShipIt=false;
 try{const entries=await fs.readdir(profile);existingProfile=true;assert.deepEqual(entries,["tool-locks"],"Refuse to adopt existing user data.");assert.deepEqual(await fs.readdir(path.join(profile,"tool-locks")),[],"Existing tool owners must not be adopted.");}catch(error){if(error.code!=="ENOENT")throw error;}
 for(const directory of [cache,shipIt]){try{await fs.lstat(directory);if(directory===shipIt)existingShipIt=true;else throw Error("Refuse to adopt an existing suite update cache.");}catch(error){if(error.code!=="ENOENT")throw error;}}
 assert.equal(processesIn(shipIt).length,0,"Refuse an existing updater process.");
 const temporary=await fs.realpath(await fs.mkdtemp(path.join(os.tmpdir(),"matiq-suite-upgrade-"))),apps=path.join(temporary,"apps"),bundle=path.join(apps,"MatiQ Solutions.app"),executable=path.join(bundle,"Contents/MacOS/MatiQ Solutions"),marker=randomUUID();
 let app,owned,server,port,success=false,runtimeLog="",failure;
 const watchdog=setTimeout(()=>{for(const child of [...processesIn(bundle),...processesIn(shipIt)]){try{process.kill(child.pid,"SIGKILL");}catch(error){if(error.code!=="ESRCH")console.error(error.message);}}server?.closeAllConnections();server?.close();},240000);
 try{
  await fs.mkdir(profile,{recursive:true});await fs.writeFile(path.join(profile,".upgrade-owner"),marker,{flag:"wx",mode:0o600});
  await fs.mkdir(apps);run("/usr/bin/ditto",["-x","-k",path.join(root,"dist",`MatiQ-Solutions-${baseVersion}-mac-${process.arch}.zip`),apps]);
  // Install a real SDK-generated tool through the verified store, not a fabricated registry row.
  const source=path.join(temporary,"independent-tool-repository"),manifest=await create(source,{id:"com.matiq.upgrade-fixture",name:"Upgrade document"});
  await fs.mkdir(path.join(source,"node_modules/@matiq-solutions"),{recursive:true});await fs.cp(path.join(root,"packages/shell"),path.join(source,"node_modules/@matiq-solutions/shell"),{recursive:true});
  const archive=path.join(temporary,"document.mqt");await sdk.pack({root:source,manifest,publisher:"matiq-solutions-release-v1",privateKey,include:["src","node_modules","LICENSE"],output:archive});
  const store=new ToolStore({root:path.join(profile,"tool-store"),publishers});await store.install(await fs.readFile(archive),{expectedId:manifest.id,expectedVersion:manifest.version,expectedCapabilities:[]});
  const targetDirectory=path.join(root,"upgrade-target"),zip=`MatiQ-Solutions-${targetVersion}-mac-${process.arch}.zip`,allowed=new Set(["latest-mac.yml",zip,zip+".blockmap"]);
  server=http.createServer(async(req,res)=>{try{const name=decodeURIComponent(new URL(req.url,"http://localhost").pathname).slice(1);if(!allowed.has(name)){res.writeHead(404);res.end();return;}const file=path.join(targetDirectory,name),size=(await fs.stat(file)).size;let start=0,end=size-1,status=200;if(req.headers.range){const range=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range);if(!range){res.writeHead(416);res.end();return;}start=Number(range[1]);end=range[2]?Number(range[2]):end;if(start>end||end>=size){res.writeHead(416);res.end();return;}status=206;}res.writeHead(status,{"Content-Length":end-start+1,"Accept-Ranges":"bytes",...(status===206?{"Content-Range":`bytes ${start}-${end}/${size}`}:{})});if(req.method==="HEAD")res.end();else createReadStream(file,{start,end}).on("error",error=>res.destroy(error)).pipe(res);}catch(error){res.writeHead(error.code==="ENOENT"?404:500);res.end("Inspect the owned update fixture artifact.");}});server.requestTimeout=30000;
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));port=server.address().port;
  const env={...process.env};for(const name of Object.keys(env))if(/^(CSC_|APPLE_)|^(MATIQ_TOOL_SIGNING_KEY|GH_TOKEN|GITHUB_TOKEN)$/.test(name))delete env[name];
  app=await electron.launch({executablePath:executable,args:[],env});owned=lifecycle.capture(app.process());for(const stream of [app.process().stdout,app.process().stderr])stream?.on("data",chunk=>{runtimeLog=(runtimeLog+chunk).slice(-20000);});
  assert.equal(await fs.realpath(await app.evaluate(({app})=>app.getPath("userData"))),await fs.realpath(profile));
  const page=await app.firstWindow();page.setDefaultTimeout(15000);await page.getByRole("button",{name:"Upgrade document",exact:true}).click();
  const tool=await waitFor(()=>app.context().pages().find(p=>p.url().includes("/src/index.html")),"Installed SDK workspace");await tool.getByLabel("Document",{exact:true}).fill(marker);await tool.getByRole("button",{name:"Save document",exact:true}).click();await expect(tool.getByRole("status")).toHaveText("Saved on this device.");
  await page.getByRole("button",{name:"MatiQ Solutions home",exact:true}).click();await page.evaluate(()=>window.solutions.request("settings",{autoUpdates:false}));
  const document=path.join(profile,"tools",manifest.id,"document.txt"),registry=path.join(profile,"tool-store/installed.json"),before={document:await hash(document),registry:await hash(registry),package:await hash(archive)};
  await app.evaluate((_,url)=>{const updater=process.mainModule.require("electron-updater").autoUpdater;updater.setFeedURL({provider:"generic",url});updater.disableDifferentialDownload=true;},`http://127.0.0.1:${port}/`);
  await page.getByRole("button",{name:"Open app launcher",exact:true}).click();await page.getByRole("dialog",{name:"Installed apps"}).getByRole("button",{name:"Settings",exact:true}).click();await page.getByRole("button",{name:"Check for app updates",exact:true}).click();
  await waitFor(()=>page.evaluate(async version=>{const s=(await window.solutions.request("state")).appUpdate;if(s.status==="error")throw Error(s.message);return s.status==="available"&&s.version===version;},targetVersion),"Signed update availability",30000);
  await page.getByRole("button",{name:"Download app update",exact:true}).click();await waitFor(()=>page.evaluate(async()=>{const s=(await window.solutions.request("state")).appUpdate;if(s.status==="error")throw Error(s.message);return s.status==="ready";}),"Signed update download",120000);
  await page.getByRole("button",{name:"Restart to update app",exact:true}).click();
  const launch=await waitFor(async()=>{const version=run("/usr/libexec/PlistBuddy",["-c","Print :CFBundleShortVersionString",path.join(bundle,"Contents/Info.plist")]).trim();if(version!==targetVersion)return false;const child=processesIn(bundle).find(child=>child.executable===realpathSync(executable)&&child.pid!==owned.pid);if(!child)return false;assert.equal(child.uid,process.getuid());const info=applicationInfo(child.pid);return info.found&&info.finished&&!info.terminated?child:false;},"Native signed replacement and automatic relaunch");
  assert.equal(await fs.realpath(applicationInfo(launch.pid).bundle),await fs.realpath(bundle));assert.equal(run("/usr/bin/lipo",["-archs",executable]).trim(),process.arch==="arm64"?"arm64":"x86_64");run("/usr/bin/codesign",["--verify","--deep","--strict",bundle]);
  assert.equal(await hash(document),before.document);assert.equal(await hash(registry),before.registry);assert.equal((await store.state()).tools[manifest.id].manifest.version,manifest.version);assert.equal(JSON.parse(await fs.readFile(path.join(profile,"settings.json"))).autoUpdates,false);await store.verifyDirectory((await store.state()).tools[manifest.id]);
  // Observe the automatic native launch first, then qualify retained work through
  // a fresh controlled launch of the replacement bytes; ShipIt exposes no CDP endpoint.
  await stopOwned([bundle]);
  app=await electron.launch({executablePath:executable,args:[],env});owned=lifecycle.capture(app.process());
  const replacement=await app.firstWindow();replacement.setDefaultTimeout(15000);
  assert.equal(await app.evaluate(({app})=>app.getVersion()),targetVersion);
  await replacement.getByRole("button",{name:"Upgrade document",exact:true}).click();
  const retained=await waitFor(()=>app.context().pages().find(p=>p.url().includes("/src/index.html")),"Retained SDK workspace after replacement");
  await expect(retained.getByLabel("Document",{exact:true})).toHaveValue(marker);
  assert.equal((await replacement.evaluate(()=>window.solutions.request("state"))).settings.autoUpdates,false);
  const proof={schema:1,baseVersion,targetVersion,arch:process.arch,source:run("git",["rev-parse","HEAD"]).trim(),signedDownloadRestart:true,automaticRelaunch:true,nativeArchitectureVerified:true,replacementWorkspaceReloaded:true,reloadObservation:"controlled launch after observing the automatic native relaunch",retained:{installedSDKTool:true,documentSha256:before.document,registrySha256:before.registry,automaticDownloadPreference:false},feed:"owned-loopback-fixture",targetZipSha256:await hash(path.join(targetDirectory,zip)),at:new Date().toISOString()};await fs.writeFile(path.join(root,"dist/upgrade-proof.json"),JSON.stringify(proof,null,2)+"\n");success=true;console.log("PASS: signed suite replacement automatically relaunched and preserved the installed SDK tool, document and preference.");
 }catch(error){failure=error;throw error;}
 finally{
  const cleanupErrors=[];
  async function cleanup(label,operation){try{await operation();}catch(error){cleanupErrors.push(new Error(label+": "+error.message,{cause:error}));console.error("Cleanup failed — "+label+": "+error.message);}}
  try{
   await cleanup("write diagnostics",async()=>{const diagnostic={success,error:failure?.message,runtimeLog,processes:[...processesIn(bundle),...processesIn(shipIt)]};await fs.mkdir(path.join(root,".validation"),{recursive:true});await fs.writeFile(path.join(root,".validation/upgrade-diagnostic.json"),JSON.stringify(diagnostic,null,2)+"\n");});
   await cleanup("close controlled app",async()=>{if(app&&app.process().exitCode===null&&app.process().signalCode===null){let timer;try{await Promise.race([app.close(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error("Controlled app close timed out; stop only owned native processes.")),10000);})]);}finally{clearTimeout(timer);}}});
   await cleanup("stop owned application and updater",async()=>{await stopOwned([bundle,shipIt]);if(owned)await lifecycle.verifyStopped(owned);assert.equal(processesIn(bundle).length,0);assert.equal(processesIn(shipIt).length,0);});
   await cleanup("close and verify loopback fixture",async()=>{if(server?.listening){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}if(port)await new Promise((resolve,reject)=>{const socket=net.connect({host:"127.0.0.1",port});socket.setTimeout(1000);socket.once("connect",()=>{socket.destroy();reject(Error("Owned update fixture port remains occupied."));});socket.once("error",error=>{socket.destroy();error.code==="ECONNREFUSED"?resolve():reject(error);});socket.once("timeout",()=>{socket.destroy();reject(Error("Cannot verify owned fixture port cleanup."));});});});
   await cleanup("remove owned profile and caches",async()=>{assert.equal(processesIn(bundle).length,0);assert.equal(processesIn(shipIt).length,0);assert.equal(await fs.readFile(path.join(profile,".upgrade-owner"),"utf8"),marker);for(const name of await fs.readdir(profile))if(!existingProfile||name!=="tool-locks")await fs.rm(path.join(profile,name),{recursive:true,force:true});if(!existingProfile)await fs.rmdir(profile);await fs.rm(cache,{recursive:true,force:true});if(!existingShipIt)await fs.rm(shipIt,{recursive:true,force:true});});
   await cleanup("remove owned fixture source",async()=>{assert.equal(processesIn(bundle).length,0);await fs.rm(temporary,{recursive:true,force:true});});
  }finally{clearTimeout(watchdog);}
  if(cleanupErrors.length)throw new AggregateError([...(failure?[failure]:[]),...cleanupErrors],"Signed upgrade qualification cleanup did not pass. Inspect each owned resource error.");
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
