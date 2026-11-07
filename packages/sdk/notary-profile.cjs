const fs=require("node:fs/promises"),os=require("node:os"),path=require("node:path"),{randomUUID,randomBytes}=require("node:crypto"),{execFile,spawnSync}=require("node:child_process"),{promisify}=require("node:util");
const execute=promisify(execFile);
async function withNotaryProfile(env,operation,{run=execute,security}={}){
 // API-key notarization passes a key-file path, not a secret password argument.
 if(!env.APPLE_ID&&!env.APPLE_APP_SPECIFIC_PASSWORD&&env.APPLE_API_KEY&&env.APPLE_API_KEY_ID&&env.APPLE_API_ISSUER)return operation();
 if(!env.APPLE_ID||!env.APPLE_TEAM_ID||!env.APPLE_APP_SPECIFIC_PASSWORD)throw Error("Supply the existing Apple account and app-specific password or complete API-key credentials before notarization.");
 const names=["APPLE_ID","APPLE_TEAM_ID","APPLE_APP_SPECIFIC_PASSWORD","APPLE_KEYCHAIN","APPLE_KEYCHAIN_PROFILE"],saved=Object.fromEntries(names.map(name=>[name,env[name]]));
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),"matiq-notary-")),keychain=path.join(directory,"notary.keychain-db"),password=randomBytes(32).toString("hex"),profile="matiq-release-"+randomUUID();
 const redact=value=>{let text=String(value);for(const secret of [password,...Object.values(saved)].filter(Boolean))text=text.replaceAll(secret,"[redacted]");return text;};
 const command=security||((args)=>{
  const quote=value=>{if(/[\r\n\0]/.test(value))throw Error("Keychain arguments must not contain line breaks or NUL.");return '\"'+value.replaceAll('\\','\\\\').replaceAll('\"','\\\"')+'\"';};
  const result=spawnSync("/usr/bin/security",["-i"],{input:args.map(quote).join(" ")+"\n",encoding:"utf8",timeout:30000,maxBuffer:128*1024});
  if(result.error||result.status!==0)throw Error("Notarization keychain "+args[0]+" failed: "+redact(result.stderr||result.error?.message||result.status));return result.stdout;
 });
 let original,created=false,failure,result;
 try{
  original=[...command(["list-keychains","-d","user"]).matchAll(/"([^"]+)"/g)].map(match=>match[1]);
  command(["create-keychain","-p",password,keychain]);created=true;
  command(["set-keychain-settings","-lut","21600",keychain]);command(["unlock-keychain","-p",password,keychain]);
  try{await run("python3",[path.join(__dirname,"store-notary-profile.py"),keychain,profile],{env:{...process.env,...env},timeout:120000,maxBuffer:128*1024});}
  catch(error){throw Error("Create the notarization keychain profile before building: "+redact(error.stderr||error.message));}
  env.APPLE_KEYCHAIN=keychain;env.APPLE_KEYCHAIN_PROFILE=profile;delete env.APPLE_ID;delete env.APPLE_TEAM_ID;delete env.APPLE_APP_SPECIFIC_PASSWORD;
  result=await operation();
 }catch(error){failure=error;}
 finally{
  for(const [name,value] of Object.entries(saved)){if(value===undefined)delete env[name];else env[name]=value;}
  const errors=[];
  try{if(original)command(["list-keychains","-d","user","-s",...original]);}catch(error){errors.push(error);}
  try{if(created)command(["delete-keychain",keychain]);}catch(error){errors.push(error);}
  try{await fs.rm(directory,{recursive:true,force:true});}catch(error){errors.push(error);}
  if(errors.length)throw new AggregateError([...(failure?[failure]:[]),...errors],"Restore the signing keychain search list and remove the owned notarization keychain before retrying.");
 }
 if(failure)throw failure;return result;
}
module.exports={withNotaryProfile};
