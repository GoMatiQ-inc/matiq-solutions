const test=require("node:test"),assert=require("node:assert/strict"),{spawnSync}=require("node:child_process");
test("secure notarization prompt keeps passwords out of argv and diagnostics",{skip:process.platform==="win32"},()=>{
 const program=`
import importlib.util,os,sys
spec=importlib.util.spec_from_file_location("notary",sys.argv[1]);module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
secret=os.environ["APPLE_APP_SPECIFIC_PASSWORD"]
success="import os,sys;assert os.environ['APPLE_APP_SPECIFIC_PASSWORD'] not in str(sys.argv);value=input('App-specific password for fixture: ');assert value==os.environ['APPLE_APP_SPECIFIC_PASSWORD']"
module.store_profile("/fixture/owned.keychain-db","fixture-profile",command=[sys.executable,"-c",success],timeout=5)
failure="import os;input('App-specific password for fixture: ');print(os.environ['APPLE_APP_SPECIFIC_PASSWORD']);raise SystemExit(3)"
try:module.store_profile("/fixture/owned.keychain-db","fixture-failure",command=[sys.executable,"-c",failure],timeout=5)
except RuntimeError as error:
 assert secret not in str(error)
 assert "[APPLE_APP_SPECIFIC_PASSWORD]" in str(error)
else:raise AssertionError("Credential rejection must remain visible")
`;
 const result=spawnSync("python3",["-c",program,require.resolve("@matiq-solutions/sdk/store-notary-profile.py")],{env:{...process.env,PYTHONDONTWRITEBYTECODE:"1",APPLE_ID:"fixture@example.test",APPLE_TEAM_ID:"FIXTURETEAM",APPLE_APP_SPECIFIC_PASSWORD:"fixture-notary-password"},encoding:"utf8",timeout:15000});
 assert.equal(result.status,0,result.stderr);assert.equal((result.stdout+result.stderr).includes("fixture-notary-password"),false);
});
