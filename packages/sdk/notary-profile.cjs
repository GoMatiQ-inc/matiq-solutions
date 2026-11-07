const path=require("node:path"),{randomUUID}=require("node:crypto"),{execFile}=require("node:child_process"),{promisify}=require("node:util");
const execute=promisify(execFile);
async function withNotaryProfile(env,operation,{run=execute}={}){
 if(!env.CSC_KEYCHAIN||!env.APPLE_ID||!env.APPLE_TEAM_ID||!env.APPLE_APP_SPECIFIC_PASSWORD)throw Error("Create the temporary signing keychain and supply the existing Apple account before notarization.");
 const names=["APPLE_ID","APPLE_TEAM_ID","APPLE_APP_SPECIFIC_PASSWORD","APPLE_KEYCHAIN","APPLE_KEYCHAIN_PROFILE"];
 const saved=Object.fromEntries(names.map(name=>[name,env[name]]));
 const profile="matiq-release-"+randomUUID();
 try{
  try{await run("python3",[path.join(__dirname,"store-notary-profile.py"),env.CSC_KEYCHAIN,profile],{env:{...process.env,...env},timeout:120000,maxBuffer:128*1024});}
  catch(error){
   let detail=error.stderr||error.message;for(const value of Object.values(saved).filter(Boolean))detail=detail.replaceAll(value,"[redacted]");
   throw Error("Create the notarization keychain profile before building: "+detail);
  }
  env.APPLE_KEYCHAIN=env.CSC_KEYCHAIN;env.APPLE_KEYCHAIN_PROFILE=profile;
  delete env.APPLE_ID;delete env.APPLE_TEAM_ID;delete env.APPLE_APP_SPECIFIC_PASSWORD;
  return await operation();
 }finally{
  for(const [name,value] of Object.entries(saved)){if(value===undefined)delete env[name];else env[name]=value;}
 }
}
module.exports={withNotaryProfile};
