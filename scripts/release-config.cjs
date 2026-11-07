const {build}=require("../package.json");
if(process.platform!=="darwin")throw Error("This release path requires a native macOS signing runner.");
if(!process.env.CSC_NAME?.startsWith("Developer ID Application:")||!process.env.APPLE_ID||!process.env.APPLE_TEAM_ID||!process.env.APPLE_APP_SPECIFIC_PASSWORD)throw Error("Configure the existing company Apple signing and notarization credentials.");
const config={...build,forceCodeSigning:true,mac:{...build.mac,target:["dmg","zip"],identity:process.env.CSC_NAME.slice("Developer ID Application:".length).trim(),notarize:true}};
if(process.env.SOLUTIONS_RELEASE_VERSION){
 if(!/^\d+\.\d+\.\d+$/.test(process.env.SOLUTIONS_RELEASE_VERSION))throw Error("Use a three-part qualification version.");
 config.extraMetadata={version:process.env.SOLUTIONS_RELEASE_VERSION};
}
if(process.env.SOLUTIONS_RELEASE_OUTPUT){
 if(!["dist","upgrade-target"].includes(process.env.SOLUTIONS_RELEASE_OUTPUT))throw Error("Use an owned release qualification output directory.");
 config.directories={...config.directories,output:process.env.SOLUTIONS_RELEASE_OUTPUT};
}
module.exports=config;
