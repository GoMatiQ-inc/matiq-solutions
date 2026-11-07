const fs=require("node:fs/promises"),path=require("node:path"),assert=require("node:assert/strict"),sdk=require("@matiq-solutions/sdk"),{publishers}=require("../catalog/trust.json");
async function createFixture({descriptor,output,sharedModelRoot}){
 const envelope=JSON.parse(await fs.readFile(descriptor,"utf8")),{signed,publisher,signature}=envelope;
 assert.ok(publishers[publisher]&&sdk.verify(signed,signature,publishers[publisher]),"Use release metadata signed by the suite trusted publisher.");
 const target=process.platform+"-"+process.arch,item=signed.packages?.[target];
 assert.ok(item&&signed.targets.length===1&&signed.targets[0]===target,"Use the exact native target package.");
 const file=descriptor.replace(/\.release\.json$/,""),bytes=await fs.readFile(file);
 assert.equal(bytes.length,item.bytes);assert.equal(sdk.hash(bytes),item.sha256);
 const verified=sdk.inspect(bytes,publishers,target);
 for(const name of ["id","name","version","sdk","dataVersion","runtime","capabilities","targets"])assert.equal(sdk.canonical(verified.manifest[name]),sdk.canonical(signed[name]),"Release metadata must match its signed native payload: "+name);
 const fixture={publishers,catalog:{schema:1,sequence:1,tools:[signed]},packages:{[item.url]:path.resolve(file)},...(sharedModelRoot?{sharedModelRoot:path.resolve(sharedModelRoot)}:{})};
 await fs.writeFile(output,JSON.stringify(fixture,null,2)+"\n",{flag:"wx",mode:0o600});return fixture;
}
if(require.main===module)createFixture({descriptor:process.argv[2],output:process.argv[3],sharedModelRoot:process.env.MATIQ_SHARED_MODEL_ROOT}).then(()=>console.log("PASS: native package fixture preserves the suite publisher trust and exact signed release bytes.")).catch(error=>{console.error(error.message);process.exitCode=1;});
module.exports={createFixture};
