const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs/promises"),path=require("node:path"),os=require("node:os"),{spawn}=require("node:child_process"),{once}=require("node:events"),{cleanupDesktop}=require("@matiq-solutions/sdk/fixture-cleanup.cjs");
test("a failed normal close still stops the owned process and removes its disposable files",{timeout:20000},async()=>{
 const temporary=await fs.mkdtemp(path.join(os.tmpdir(),"matiq-cleanup-regression-")),child=spawn(process.execPath,["-e","process.on('SIGTERM',()=>{});process.stdout.write('ready');setInterval(()=>{},1000);"],{stdio:["ignore","pipe","ignore"]});
 try{await once(child.stdout,"data");await assert.rejects(cleanupDesktop({app:{process:()=>child,close:async()=>{throw Error("fixture close failure");}},temporary}),/cleanup did not pass/);assert.ok(child.exitCode!==null||child.signalCode!==null);await assert.rejects(fs.access(temporary),{code:"ENOENT"});}
 finally{if(child.exitCode===null&&child.signalCode===null){child.kill("SIGKILL");await once(child,"exit");}await fs.rm(temporary,{recursive:true,force:true});}
});

test("an exited app handle cannot adopt an unrelated live process with its old PID",{timeout:10000},async()=>{
 const temporary=await fs.mkdtemp(path.join(os.tmpdir(),"matiq-cleanup-reused-")),unrelated=spawn(process.execPath,["-e","process.stdout.write('ready');setInterval(()=>{},1000);"],{stdio:["ignore","pipe","ignore"]});
 try{await once(unrelated.stdout,"data");const exited={pid:unrelated.pid,exitCode:0,signalCode:null};await assert.rejects(cleanupDesktop({app:{process:()=>exited,close:()=>assert.fail("Do not close an exited app handle.")},temporary}),/cleanup did not pass/);process.kill(unrelated.pid,0);assert.equal(unrelated.exitCode,null);await fs.access(temporary);}
 finally{unrelated.kill("SIGKILL");await once(unrelated,"exit");await fs.rm(temporary,{recursive:true,force:true});}
});
