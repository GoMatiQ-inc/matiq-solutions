const test=require("node:test"),assert=require("node:assert/strict"),crypto=require("node:crypto"),sdk=require("@matiq-solutions/sdk");
const {buildCatalog,mergeReleases}=require("../scripts/catalog.cjs");
const key=crypto.generateKeyPairSync("ed25519"),publisher="matiq-solutions-release-v1",publishers={[publisher]:key.publicKey};
const registration={id:"com.matiq.example",repository:"GoMatiQ-inc/matiq-example"};
const url="https://github.com/GoMatiQ-inc/matiq-example/releases/download/v1.0.0/example.mqt";
const signed={schema:1,id:registration.id,name:"Example",description:"Local canvas",version:"1.0.0",sdk:1,dataVersion:1,runtime:"electron-45.2.3",capabilities:["files"],targets:["darwin-arm64"],packages:{"darwin-arm64":{url,bytes:123,sha256:"a".repeat(64)}}};
const release={tag_name:"v1.0.0",assets:[{name:"example.mqt",browser_download_url:url,size:123},{name:"example.mqt.release.json",browser_download_url:url+".release.json",size:1000}]};
const envelope=value=>({signed:value,publisher,signature:sdk.sign(value,key.privateKey)});
test("marketplace follows independent tool releases without downloading implementation",async()=>{
 const requests=[],read=async url=>{requests.push(url);return url.includes("api.github.com")?release:envelope(signed);};
 const previous=envelope({sequence:20});
 const catalog=await buildCatalog({registry:[registration],publishers,privateKey:key.privateKey,previous,read});
 assert.equal(catalog.signed.tools[0].source,"https://github.com/"+registration.repository);
 assert.deepEqual(requests,["https://api.github.com/repos/"+registration.repository+"/releases/latest",url+".release.json"]);
 assert.equal(sdk.verify(catalog.signed,catalog.signature,key.publicKey),true);
 assert.ok(catalog.signed.sequence>20);
});
test("catalog rejects wrong identity, changed assets and inconsistent native metadata",()=>{
 assert.throws(()=>mergeReleases(registration,release,[envelope({...signed,id:"com.matiq.other"})],publishers),/identity/);
 assert.throws(()=>mergeReleases(registration,{...release,assets:[]},[envelope(signed)],publishers),/missing/);
 assert.throws(()=>mergeReleases(registration,release,[envelope(signed),envelope({...signed,capabilities:[]})],publishers),/disagree/);
 assert.throws(()=>mergeReleases(registration,release,[{...envelope(signed),signature:"invalid"}],publishers),/untrusted/);
 const packages={"darwin-arm64":{...signed.packages["darwin-arm64"],url:"https://example.com/other.mqt"}};
 assert.throws(()=>mergeReleases(registration,release,[envelope({...signed,packages})],publishers),/own release/);
});
test("standalone-only releases do not fabricate marketplace entries",async()=>{
 const catalog=await buildCatalog({registry:[registration],publishers,privateKey:key.privateKey,read:async()=>({...release,assets:[]})});
 assert.deepEqual(catalog.signed.tools,[]);
});
