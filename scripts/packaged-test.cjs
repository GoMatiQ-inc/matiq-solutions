const fs=require("node:fs/promises"),os=require("node:os"),path=require("node:path"),assert=require("node:assert/strict");
const { _electron:electron }=require("playwright"),lifecycle=require("@matiq-solutions/sdk/fixture-lifecycle.cjs");
(async()=>{
 const profile=await fs.mkdtemp(path.join(os.tmpdir(),"matiq-suite-packaged-"));
 const output=path.resolve(__dirname,"..",process.env.SOLUTIONS_RELEASE_OUTPUT||"dist");
 const executable=process.env.SOLUTIONS_EXECUTABLE_PATH||(process.platform==="darwin"?path.join(output,process.arch==="arm64"?"mac-arm64":"mac","MatiQ Solutions.app/Contents/MacOS/MatiQ Solutions"):process.platform==="win32"?path.join(output,"win-unpacked","MatiQ Solutions.exe"):path.join(output,"linux-unpacked","matiq-solutions"));
 let app,owned=[];
 const watchdog=setTimeout(()=>{for(const child of owned){try{process.kill(child.pid,"SIGKILL");}catch(error){if(error.code!=="ESRCH")console.error("Owned packaged-process stop failed:",error.message);}}},60000);
 try{
  app=await electron.launch({executablePath:executable,args:["--user-data-dir="+profile],timeout:30000});
  const page=await app.firstWindow();page.setDefaultTimeout(15000);
  owned=lifecycle.captureTree(lifecycle.capture(app.process()));
  const actual=await app.evaluate(({app})=>({profile:app.getPath("userData"),version:app.getVersion(),packaged:app.isPackaged}));
  assert.equal(await fs.realpath(actual.profile),await fs.realpath(profile),"Packaged qualification must use its isolated user-data directory.");
  assert.equal(actual.packaged,true);
  assert.equal(actual.version,process.env.SOLUTIONS_RELEASE_VERSION||require("../package.json").version);
  await page.getByText("No tools installed. Browse the marketplace to choose your first tool.",{exact:true}).waitFor();
  await page.getByRole("button",{name:"Browse marketplace",exact:true}).click();
  await page.getByRole("heading",{name:"Find your next tool.",exact:true}).waitFor();
  const state=await page.evaluate(()=>window.solutions.request("state"));
  assert.deepEqual(state.installed.tools,{});
  await assert.rejects(fs.access(path.join(profile,"tools")),{code:"ENOENT"});
  await page.getByRole("button",{name:"Settings",exact:true}).click();
  await page.getByText("Suite version "+actual.version+" · "+process.platform+"-"+process.arch,{exact:true}).waitFor();
  await fs.writeFile(path.join(output,"packaged-proof.json"),JSON.stringify({schema:1,version:actual.version,arch:process.arch,packaged:true,checks:["isolated-profile","empty-library","marketplace-navigation","no-tools-auto-installed","settings-rendered"]},null,2)+"\n");
  console.log("PASS: packaged suite launches with its own profile, empty library, marketplace and settings.");
 }finally{
  if(app){owned=lifecycle.captureTree(lifecycle.capture(app.process()));await app.close();}
  for(const child of owned)await lifecycle.verifyStopped(child);
  clearTimeout(watchdog);await fs.rm(profile,{recursive:true,force:true});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
