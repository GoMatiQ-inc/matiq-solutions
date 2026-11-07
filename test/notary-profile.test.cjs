const fs=require("node:fs"),path=require("node:path");
const test=require("node:test"),assert=require("node:assert/strict");
function security(args){return args[0]==="list-keychains"&&args.length===3?'"/fixture/signing.keychain-db"':"";}
const {withNotaryProfile}=require("@matiq-solutions/sdk/notary-profile.cjs");
test("notarization uses a temporary keychain profile and restores credentials after failure",async()=>{
 const env={CSC_KEYCHAIN:"/fixture/owned.keychain-db",APPLE_ID:"fixture@example.test",APPLE_TEAM_ID:"FIXTURETEAM",APPLE_APP_SPECIFIC_PASSWORD:"fixture-notary-password"},saved={...env};let invoked=false;
 await assert.rejects(withNotaryProfile(env,async()=>{assert.equal(env.APPLE_APP_SPECIFIC_PASSWORD,undefined);assert.equal(env.APPLE_ID,undefined);assert.notEqual(env.APPLE_KEYCHAIN,env.CSC_KEYCHAIN);assert.match(env.APPLE_KEYCHAIN,/matiq-notary-/);assert.match(env.APPLE_KEYCHAIN_PROFILE,/^matiq-release-/);throw Error("Fixture build failed");},{security,run:async(program,args,options)=>{invoked=true;assert.equal(program,"python3");assert.equal(args.includes(saved.APPLE_APP_SPECIFIC_PASSWORD),false);assert.equal(options.env.APPLE_APP_SPECIFIC_PASSWORD,saved.APPLE_APP_SPECIFIC_PASSWORD);}}),/Fixture build failed/);
 assert.equal(invoked,true);assert.deepEqual(env,saved);
});
test("failed credential validation never invokes the builder or leaks the password",async()=>{
 const env={CSC_KEYCHAIN:"/fixture/owned.keychain-db",APPLE_ID:"fixture@example.test",APPLE_TEAM_ID:"FIXTURETEAM",APPLE_APP_SPECIFIC_PASSWORD:"fixture-notary-password"},saved={...env};
 await assert.rejects(withNotaryProfile(env,()=>assert.fail("Do not build without notarization credentials."),{security,run:async()=>{throw Object.assign(Error("failed"),{stderr:"Invalid "+env.APPLE_APP_SPECIFIC_PASSWORD});}}),error=>error.message.includes("[redacted]")&&!error.message.includes(saved.APPLE_APP_SPECIFIC_PASSWORD));
 assert.deepEqual(env,saved);
});

test("pre-imported identities need no explicit signing keychain and notarization still cleans its own profile",async()=>{
 const env={APPLE_ID:"fixture@example.test",APPLE_TEAM_ID:"FIXTURETEAM",APPLE_APP_SPECIFIC_PASSWORD:"fixture-notary-password"},saved={...env},commands=[];let keychain;
 await withNotaryProfile(env,async()=>{keychain=env.APPLE_KEYCHAIN;assert.equal(env.CSC_KEYCHAIN,undefined);assert.ok(fs.existsSync(path.dirname(keychain)));},{security:args=>{commands.push(args);return security(args);},run:async()=>{}});
 assert.deepEqual(env,saved);assert.equal(fs.existsSync(path.dirname(keychain)),false);assert.ok(commands.some(args=>args[0]==="delete-keychain"&&args[1]===keychain));assert.deepEqual(commands.find(args=>args[0]==="list-keychains"&&args.includes("-s")),["list-keychains","-d","user","-s","/fixture/signing.keychain-db"]);
});
test("API-key notarization preserves the supported builder path without Apple-ID credentials",async()=>{
 const env={APPLE_API_KEY:"/fixture/Notary.p8",APPLE_API_KEY_ID:"FIXTUREKEY",APPLE_API_ISSUER:"fixture-issuer"},saved={...env};
 assert.equal(await withNotaryProfile(env,async()=>"api-key-build",{security:()=>assert.fail("Do not create a password profile for API-key notarization."),run:()=>assert.fail("Do not prompt for a password.")}),"api-key-build");assert.deepEqual(env,saved);
});
