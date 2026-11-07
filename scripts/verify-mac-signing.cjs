const fs=require("node:fs/promises"),path=require("node:path"),os=require("node:os"),crypto=require("node:crypto"),{execFileSync}=require("node:child_process"),yaml=require("js-yaml"),assert=require("node:assert/strict");
async function main(){
 if(process.platform!=="darwin")throw Error("Verify Apple signatures on native macOS.");
 const version=process.env.SOLUTIONS_RELEASE_VERSION||require("../package.json").version;
 const output=path.resolve(__dirname,"..",process.env.SOLUTIONS_RELEASE_OUTPUT||"dist");
 const app=path.join(output,process.arch==="arm64"?"mac-arm64":"mac","MatiQ Solutions.app");
 const run=(program,args)=>execFileSync(program,args,{encoding:"utf8",timeout:120000,stdio:["ignore","pipe","pipe"]});
 function verifyApp(bundle){
  run("/usr/bin/codesign",["--verify","--deep","--strict","--verbose=2",bundle]);
  const signed=require("node:child_process").spawnSync("/usr/bin/codesign",["-d","--verbose=4",bundle],{encoding:"utf8",timeout:30000});
  if(signed.status!==0)throw Error("Read the application signature before publishing.");
  assert.ok(process.env.APPLE_TEAM_ID,"Supply the expected company signing team.");
  assert.ok(signed.stderr.includes("TeamIdentifier="+process.env.APPLE_TEAM_ID),"Application signing team differs from the company identity.");
  assert.match(signed.stderr,/flags=.*\(runtime\)/,"Application must retain hardened runtime.");
  const entitlements=run("/usr/bin/codesign",["-d","--entitlements",":-",bundle]);
  for(const key of ["com.apple.security.cs.disable-library-validation","com.apple.security.get-task-allow"]){
   const marker="<key>"+key+"</key>";const tail=entitlements.split(marker)[1];
   assert.ok(!tail||!/^\s*<true\s*\/>/.test(tail),"Release must keep library validation and disallow debugger entitlements.");
  }
  run("/usr/bin/xcrun",["stapler","validate","-q",bundle]);
  run("/usr/sbin/spctl",["--assess","--type","execute","--verbose=2",bundle]);
  const plist=path.join(bundle,"Contents/Info.plist");
  assert.equal(run("/usr/libexec/PlistBuddy",["-c","Print :CFBundleIdentifier",plist]).trim(),"com.matiq.solutions");
  assert.equal(run("/usr/libexec/PlistBuddy",["-c","Print :CFBundleShortVersionString",plist]).trim(),version);
 }
 verifyApp(app);
 const metadata=yaml.load(await fs.readFile(path.join(output,"latest-mac.yml"),"utf8"));
 assert.equal(metadata.version,version);assert.ok(metadata.files.some(item=>item.url.endsWith(".zip")));
 const artifacts={};
 for(const item of metadata.files){
  assert.equal(path.basename(item.url),item.url,"Update assets must be local release filenames.");
  const bytes=await fs.readFile(path.join(output,item.url));
  assert.equal(crypto.createHash("sha512").update(bytes).digest("base64"),item.sha512);
  if(item.size!==undefined)assert.equal(bytes.length,item.size);
  artifacts[item.url]={bytes:bytes.length,sha256:crypto.createHash("sha256").update(bytes).digest("hex"),sha512:item.sha512};
  if(item.url.endsWith(".zip")){
   const stage=await fs.mkdtemp(path.join(os.tmpdir(),"matiq-suite-signed-zip-"));
   try{run("/usr/bin/ditto",["-x","-k",path.join(output,item.url),stage]);verifyApp(path.join(stage,"MatiQ Solutions.app"));}
   finally{await fs.rm(stage,{recursive:true,force:true});}
  }
 }
 const receipt={schema:1,product:"com.matiq.solutions",version,arch:process.arch,commit:run("git",["rev-parse","HEAD"]).trim(),artifacts,checks:["codesign-strict","company-team","hardened-runtime","library-validation","no-debug-entitlement","stapled-ticket","gatekeeper","update-hash","zip-app-signature"]};
 await fs.writeFile(path.join(output,"mac-signature.json"),JSON.stringify(receipt,null,2)+"\n");
 console.log("PASS: company signature, hardened runtime, notarization, Gatekeeper and exact update ZIP bytes.");
}
main().catch(error=>{console.error(error.message);process.exit(1);});
