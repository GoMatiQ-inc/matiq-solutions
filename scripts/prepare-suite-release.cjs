const fs=require("node:fs/promises"),path=require("node:path"),{createHash}=require("node:crypto"),assert=require("node:assert/strict"),yaml=require("js-yaml");
const digest=bytes=>createHash("sha256").update(bytes).digest("hex");
async function prepareSuiteRelease(input,output,{version,source}){
 assert.match(version,/^\d+\.\d+\.\d+$/);assert.match(source,/^[a-f0-9]{40}$/);const published=new Map(),feeds=[];
 for(const arch of ["arm64","x64"]){
  const directory=path.join(input,arch),read=async name=>JSON.parse(await fs.readFile(path.join(directory,name),"utf8")),signature=await read("mac-signature.json"),packaged=await read("packaged-proof.json"),upgrade=await read("upgrade-proof.json");
  assert.equal(signature.commit,source);assert.equal(signature.version,version);assert.equal(signature.arch,arch);assert.equal(signature.product,"com.matiq.solutions");
  for(const check of ["codesign-strict","company-team","hardened-runtime","library-validation","no-debug-entitlement","stapled-ticket","gatekeeper","update-hash","zip-app-signature"])assert.ok(signature.checks.includes(check),"Require native signing qualification: "+check);
  assert.equal(packaged.version,version);assert.equal(packaged.arch,arch);assert.equal(packaged.packaged,true);assert.ok(packaged.checks.includes("no-tools-auto-installed"));
  assert.equal(upgrade.source,source);assert.equal(upgrade.baseVersion,version);assert.equal(upgrade.arch,arch);for(const check of ["signedDownloadRestart","automaticRelaunch","nativeArchitectureVerified","replacementWorkspaceReloaded"])assert.equal(upgrade[check],true,"Require actual native upgrade qualification: "+check);
  assert.equal(upgrade.retained.installedSDKTool,true);assert.match(upgrade.retained.documentSha256,/^[a-f0-9]{64}$/);assert.match(upgrade.retained.registrySha256,/^[a-f0-9]{64}$/);assert.equal(upgrade.retained.automaticDownloadPreference,false);
  const names=["zip","dmg"].map(extension=>`MatiQ-Solutions-${version}-mac-${arch}.${extension}`);assert.deepEqual(Object.keys(signature.artifacts).sort(),[...names].sort());
  const feed=yaml.load(await fs.readFile(path.join(directory,"latest-mac.yml"),"utf8"));assert.equal(feed.version,version);assert.deepEqual(feed.files.map(file=>file.url).sort(),[...names].sort());
  for(const item of feed.files){const bytes=await fs.readFile(path.join(directory,item.url)),proof=signature.artifacts[item.url];assert.equal(bytes.length,proof.bytes);assert.equal(digest(bytes),proof.sha256,"Native receipt must cover exact release bytes.");assert.equal(createHash("sha512").update(bytes).digest("base64"),item.sha512);assert.equal(item.sha512,proof.sha512);assert.equal(item.size,bytes.length);published.set(item.url,bytes);}
  const allowed=new Set([...names,...names.map(name=>name+".blockmap"),"latest-mac.yml","mac-signature.json","packaged-proof.json","upgrade-proof.json"]);for(const name of await fs.readdir(directory)){assert.ok(allowed.has(name),"Reject unexpected release artifact: "+name);if(name.endsWith(".blockmap")){const bytes=await fs.readFile(path.join(directory,name));assert.ok(bytes.length>0&&bytes.length<4*1024**2);published.set(name,bytes);}}
  feeds.push(feed);
 }
 const combined={...feeds[0],files:feeds.flatMap(feed=>feed.files)};
 // Exercise the actual updater's architecture selector, including a deliberately
 // mixed feed, before publishing either architecture's download metadata.
 const {MacUpdater}=require("electron-updater/out/MacUpdater"),{findFile}=require("electron-updater/out/providers/Provider");
 const resolved=combined.files.map(info=>({info,url:new URL(info.url,"https://github.com/GoMatiQ-inc/matiq-solutions/releases/download/v"+version+"/")}));
 for(const arch of ["arm64","x64"]){const chosen=findFile(MacUpdater.filterFilesForArch(resolved,arch==="arm64"),"zip",["pkg","dmg"]);assert.equal(path.basename(chosen.url.pathname),`MatiQ-Solutions-${version}-mac-${arch}.zip`);}
 published.set("latest-mac.yml",Buffer.from(yaml.dump(combined)));await fs.mkdir(output,{recursive:true});assert.deepEqual(await fs.readdir(output),[],"Use an empty owned release output directory.");
 const checksums=[];for(const [name,bytes]of [...published].sort(([a],[b])=>a.localeCompare(b))){await fs.writeFile(path.join(output,name),bytes,{flag:"wx"});checksums.push(digest(bytes)+"  "+name);}await fs.writeFile(path.join(output,"SHA256SUMS.txt"),checksums.join("\n")+"\n",{flag:"wx"});return [...published.keys()];
}
if(require.main===module)prepareSuiteRelease("qualified-assets","release-assets",{version:process.env.SOLUTIONS_PUBLISH_VERSION,source:process.env.SOLUTIONS_PUBLISH_SOURCE}).then(()=>console.log("PASS: exact qualified Mac assets and architecture-selecting update feed prepared.")).catch(error=>{console.error(error);process.exitCode=1;});
module.exports={prepareSuiteRelease};
