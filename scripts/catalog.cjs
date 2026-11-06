const fs=require("node:fs/promises"),path=require("node:path"),sdk=require("@matiq-solutions/sdk");
const {verifyCatalog}=require("@matiq-solutions/runtime");
const CATALOG_URL="https://raw.githubusercontent.com/GoMatiQ-inc/matiq-solutions/catalog/catalog.signed.json";
async function json(url,{optional=false}={}) {
 const response=await fetch(url,{headers:{Accept:"application/vnd.github+json",...(process.env.GH_TOKEN&&url.startsWith("https://api.github.com/")?{Authorization:"Bearer "+process.env.GH_TOKEN}:{})},signal:AbortSignal.timeout(30000)});
 if(optional&&response.status===404)return null;
 if(!response.ok)throw Error(`Cannot read release metadata (${response.status}): ${url}`);
 const chunks=[];let length=0;
 for await(const chunk of response.body){length+=chunk.length;if(length>4*1024**2)throw Error("Release metadata exceeds its size limit.");chunks.push(Buffer.from(chunk));}
 return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}
function mergeReleases(registration,release,envelopes,publishers) {
 let tool=null;
 for(const envelope of envelopes) {
  const {signed,signature,publisher}=envelope||{};
  if(!signed||!publishers[publisher]||!sdk.verify(signed,signature,publishers[publisher]))throw Error("Tool release metadata has an untrusted signature.");
  if(signed.id!==registration.id||"v"+signed.version!==release.tag_name)throw Error("Tool release identity/version does not match its registered repository release.");
  sdk.validateManifest({...signed,adapter:"src/adapter.cjs",workspace:"src/index.html",preload:"src/preload.cjs"});
  if(signed.schema!==1||!signed.packages||!signed.targets.length)throw Error("Tool release metadata is incomplete.");
  if(!tool)tool={...signed,targets:[],packages:{},source:"https://github.com/"+registration.repository,license:"MatiQ source-available — no paid redistribution"};
  for(const key of ["id","name","description","version","capabilities","sdk","dataVersion","runtime"])
   if(sdk.canonical(tool[key])!==sdk.canonical(signed[key]))throw Error("Native release manifests disagree. Publish one consistent tool version.");
  if(Object.keys(signed.packages).length!==signed.targets.length)throw Error("Native release targets and packages disagree.");
  for(const target of signed.targets) {
   const item=signed.packages[target],prefix=`https://github.com/${registration.repository}/releases/download/${encodeURIComponent(release.tag_name)}/`;
   if(!item||typeof item.url!=="string"||!item.url.startsWith(prefix)||!/^[-\w.]+\.mqt$/.test(item.url.slice(prefix.length))||!Number.isSafeInteger(item.bytes)||item.bytes<1||item.bytes>sdk.MAX_ARCHIVE||!/^[a-f0-9]{64}$/.test(item.sha256))throw Error("Tool asset must be a bounded immutable package in its own release.");
   const asset=release.assets.find(asset=>asset.browser_download_url===item.url);
   if(!asset||asset.size!==item.bytes)throw Error("Tool package is missing from its native release or its size changed.");
   if(tool.packages[target])throw Error("Duplicate native target in release metadata.");
   tool.targets.push(target);tool.packages[target]=item;
  }
 }
 return tool;
}
async function buildCatalog({registry,publishers,privateKey,previous,read=json,now=Date.now()}) {
 if(previous&&(!publishers[previous.publisher]||!sdk.verify(previous.signed,previous.signature,publishers[previous.publisher])))throw Error("Previous marketplace signature is invalid.");
 const tools=[];
 for(const registration of registry) {
  if(!/^GoMatiQ-inc\/[a-z0-9-]+$/.test(registration.repository))throw Error("Register an official first-party repository.");
  const release=await read("https://api.github.com/repos/"+registration.repository+"/releases/latest",{optional:true});
  if(!release)continue;
  const envelopes=[];
  for(const asset of release.assets.filter(asset=>asset.name.endsWith(".mqt.release.json"))) {
   if(asset.size>4*1024**2)throw Error("Tool release metadata exceeds its size limit.");
   envelopes.push(await read(asset.browser_download_url));
  }
  const tool=mergeReleases(registration,release,envelopes,publishers);
  if(tool)tools.push(tool);
 }
 const signed={schema:1,sequence:Math.max(now,(previous?.signed.sequence||0)+1),expires:new Date(now+7*86400000).toISOString(),tools};
 const publisher="matiq-solutions-release-v1",envelope={signed,publisher,signature:sdk.sign(signed,privateKey)};
 verifyCatalog(envelope,publishers,previous?.signed.sequence||0);
 return envelope;
}
async function main() {
 const root=path.join(__dirname,".."),registry=JSON.parse(await fs.readFile(path.join(root,"catalog/tools.json"))),{publishers}=require("../catalog/trust.json");
 if(!process.env.MATIQ_TOOL_SIGNING_KEY)throw Error("Run catalog publication in the protected catalog-signing environment.");
 const previous=await json(CATALOG_URL,{optional:true});
 const envelope=await buildCatalog({registry,publishers,privateKey:process.env.MATIQ_TOOL_SIGNING_KEY,previous});
 await fs.writeFile(path.resolve(process.argv[2]||"catalog.signed.json"),JSON.stringify(envelope,null,2)+"\n");
}
if(require.main===module)main().catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={buildCatalog,mergeReleases};
