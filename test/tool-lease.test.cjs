const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs/promises"),os=require("node:os"),path=require("node:path");
const {execFileSync}=require("node:child_process"),{acquireToolLease}=require("@matiq-solutions/runtime/tool-lease.cjs");
async function fixture(t){const root=await fs.mkdtemp(path.join(os.tmpdir(),"matiq-lease-"));t.after(()=>fs.rm(root,{recursive:true,force:true}));return {root,id:"com.matiq.example",owner:"standalone"};}
test("standalone and suite cannot concurrently own one tool",async t=>{
 const options=await fixture(t),first=await acquireToolLease(options);
 await assert.rejects(acquireToolLease({...options,owner:"suite"}),/already open in standalone/);
 await first.release();await first.release();
 const second=await acquireToolLease({...options,owner:"suite"});await second.release();
});
test("concurrent dead-owner recovery grants exactly one claimant",async t=>{
 const options=await fixture(t);
 const pid=Number(execFileSync(process.execPath,["-e","process.stdout.write(String(process.pid))"],{encoding:"utf8",timeout:5000}));
 await fs.writeFile(path.join(options.root,options.id+".json"),JSON.stringify({pid,owner:"exited app",nonce:"previous"}));
 const results=await Promise.allSettled([acquireToolLease(options),acquireToolLease(options)]);
 assert.equal(results.filter(r=>r.status==="fulfilled").length,1);
 await results.find(r=>r.status==="fulfilled").value.release();
});
test("damaged ownership and abandoned recovery fail visibly",async t=>{
 const options=await fixture(t),file=path.join(options.root,options.id+".json");
 await fs.writeFile(file,"{damaged");
 await assert.rejects(acquireToolLease(options),/damaged/);
 assert.equal(await fs.readFile(file,"utf8"),"{damaged");
 await fs.writeFile(file+".recovery","");
 await assert.rejects(acquireToolLease(options),/recovering ownership/);
});

test("lease accepts every valid manifest ID",async t=>{for(const id of ["com.matiq.3dcanvas","my-tool"]){const options=await fixture(t),lease=await acquireToolLease({...options,id});await lease.release();}});
