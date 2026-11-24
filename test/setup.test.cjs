const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {createSetup}=require('../packages/runtime/setup.cjs');
const {stopRecordingsForQuit}=require('../packages/runtime/quit-recordings.cjs');
test('setup requires explicit choices and native checks, resumes, and fails closed on save/validation errors',async t=>{
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'matiq-setup-'));t.after(()=>fs.rm(root,{recursive:true,force:true}));const file=path.join(root,'setup.json'),steps=[{id:'mode',kind:'choice',options:[['local','Local']]},{id:'access',kind:'check'},{id:'privacy',kind:'review'},{id:'ready',kind:'summary'}];let access=false;
 const config={file,steps,validate:async()=>{if(!access)throw Error('Permission was revoked.');}},flow=createSetup(config);
 await assert.rejects(flow.assertReady(),/Complete setup/);await assert.rejects(flow.complete(),/every required/);assert.throws(()=>flow.review('access','verified'),/valid option/);
 await flow.review('mode','local');await flow.progress(1);assert.equal((await createSetup(config).read()).step,1);
 await assert.rejects(flow.check('access',async()=>{throw Error('Denied');}),/Denied/);assert.equal((await flow.read()).values.access,undefined);
 access=true;await flow.check('access',async()=>{});await flow.review('privacy','reviewed');await flow.complete();await flow.assertReady();await createSetup(config).assertReady();
 await flow.invalidate(['access']);await assert.rejects(flow.assertReady(),/Complete setup/);await flow.check('access',async()=>{});access=false;await assert.rejects(flow.complete(),/revoked/);assert.equal((await flow.read()).completed,false);
});
test('quit cancellation leaves recording intact; confirmed quit awaits durable save and propagates failures',async()=>{
 let recording=true,saved=false;const tool={name:'Copycat',status:async()=>({recording}),stopAndSave:async()=>{await Promise.resolve();saved=true;recording=false;}};
 assert.equal(await stopRecordingsForQuit({tools:[tool],confirm:async()=>({response:0})}),false);assert(recording);assert(!saved);
 assert.equal(await stopRecordingsForQuit({tools:[tool],confirm:async()=>({response:1})}),true);assert(saved);assert(!recording);
 recording=true;tool.stopAndSave=async()=>{throw Error('Disk full');};await assert.rejects(stopRecordingsForQuit({tools:[tool],confirm:async()=>({response:1})}),/Disk full/);assert(recording);
});
