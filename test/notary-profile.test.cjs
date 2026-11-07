const test=require("node:test"),assert=require("node:assert/strict");
const {withNotaryProfile}=require("@matiq-solutions/sdk/notary-profile.cjs");
test("notarization uses a temporary keychain profile and restores credentials after failure",async()=>{
 const env={CSC_KEYCHAIN:"/fixture/owned.keychain-db",APPLE_ID:"fixture@example.test",APPLE_TEAM_ID:"FIXTURETEAM",APPLE_APP_SPECIFIC_PASSWORD:"fixture-notary-password"},saved={...env};let invoked=false;
 await assert.rejects(withNotaryProfile(env,async()=>{assert.equal(env.APPLE_APP_SPECIFIC_PASSWORD,undefined);assert.equal(env.APPLE_ID,undefined);assert.equal(env.APPLE_KEYCHAIN,env.CSC_KEYCHAIN);assert.match(env.APPLE_KEYCHAIN_PROFILE,/^matiq-release-/);throw Error("Fixture build failed");},{run:async(program,args,options)=>{invoked=true;assert.equal(program,"python3");assert.equal(args.includes(saved.APPLE_APP_SPECIFIC_PASSWORD),false);assert.equal(options.env.APPLE_APP_SPECIFIC_PASSWORD,saved.APPLE_APP_SPECIFIC_PASSWORD);}}),/Fixture build failed/);
 assert.equal(invoked,true);assert.deepEqual(env,saved);
});
test("failed credential validation never invokes the builder or leaks the password",async()=>{
 const env={CSC_KEYCHAIN:"/fixture/owned.keychain-db",APPLE_ID:"fixture@example.test",APPLE_TEAM_ID:"FIXTURETEAM",APPLE_APP_SPECIFIC_PASSWORD:"fixture-notary-password"},saved={...env};
 await assert.rejects(withNotaryProfile(env,()=>assert.fail("Do not build without notarization credentials."),{run:async()=>{throw Object.assign(Error("failed"),{stderr:"Invalid "+env.APPLE_APP_SPECIFIC_PASSWORD});}}),error=>error.message.includes("[redacted]")&&!error.message.includes(saved.APPLE_APP_SPECIFIC_PASSWORD));
 assert.deepEqual(env,saved);
});
