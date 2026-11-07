const path=require("node:path");
const {withNotaryProfile}=require("@matiq-solutions/sdk/notary-profile.cjs");
const {withMacKeychain}=require("@matiq-solutions/sdk/mac-keychain.cjs");
async function main(){
 const config=require("./release-config.cjs");
 await withMacKeychain(process.env,()=>withNotaryProfile(process.env,()=>require("electron-builder").build({projectDir:path.join(__dirname,".."),config,publish:"never"})),{requireInstaller:false});
}
main().catch(error=>{console.error(error.message);process.exit(1);});
