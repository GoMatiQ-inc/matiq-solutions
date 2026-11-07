const fs=require("node:fs/promises"),{spawnSync}=require("node:child_process"),assert=require("node:assert/strict"),{capture,captureTree,verifyStopped}=require("./fixture-lifecycle.cjs");
function identity(pid){
 assert.ok(Number.isSafeInteger(pid)&&pid>0);
 const windows=process.platform==="win32",result=spawnSync(windows?"powershell.exe":"/bin/ps",windows?["-NoProfile","-NonInteractive","-Command",`$ErrorActionPreference='Stop';$p=Get-CimInstance Win32_Process -Filter 'ProcessId = ${pid}';if($p){$p|Select-Object ProcessId,CreationDate,ExecutablePath|ConvertTo-Json -Compress}`]:["-p",String(pid),"-o","uid=,lstart=,comm="],{encoding:"utf8",timeout:15000});
 if(result.error)throw result.error;if(!windows&&result.status===1&&!result.stdout.trim())return null;if(result.status!==0)throw Error("Inspect the owned fixture process identity before signaling it.");return result.stdout.trim()||null;
}
async function cleanupDesktop({app,owned=[],temporary,watchdog}){
 const errors=[];let snapshots=[],stopped=true;
 async function stage(label,operation){try{await operation();}catch(error){errors.push(new Error(label+": "+error.message,{cause:error}));console.error("Fixture cleanup failed — "+label+": "+error.message);}}
 try{
  await stage("capture owned runtime identities",async()=>{const child=app?.process(),live=child&&child.exitCode===null&&child.signalCode===null;const rows=live?captureTree(capture(child)):[];snapshots=rows.map(row=>({...row,identity:identity(row.pid)}));const pids=new Set(rows.map(row=>row.pid));snapshots.push(...owned.filter(row=>!pids.has(row.pid)));});
  await stage("close controlled desktop",async()=>{if(app&&app.process().exitCode===null&&app.process().signalCode===null){let timer;try{await Promise.race([app.close(),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error("Normal close timed out; verify only owned runtime cleanup.")),10000);})]);}finally{clearTimeout(timer);}}});
  for(const child of snapshots)await stage("stop and verify owned process "+child.pid,async()=>{
   try{await verifyStopped(child);return;}catch(initial){
    const current=identity(child.pid);if(current===null){await verifyStopped(child);return;}assert.ok(child.identity&&current===child.identity,"The PID identity changed. Leave the unknown process untouched.");
    try{process.kill(child.pid,"SIGTERM");}catch(error){if(error.code!=="ESRCH")throw error;}
    try{await verifyStopped(child);}catch(error){const final=identity(child.pid);if(final!==null){assert.equal(final,child.identity,"The PID identity changed. Leave the unknown process untouched.");try{process.kill(child.pid,"SIGKILL");}catch(error){if(error.code!=="ESRCH")throw error;}}await verifyStopped(child);}
   }
  });
  await stage("independently confirm runtime absence",async()=>{for(const child of snapshots){try{await verifyStopped(child);}catch(error){stopped=false;throw error;}}if(!snapshots.length&&(app||owned.length)){stopped=false;throw Error("Runtime ownership could not be captured; retain its fixture files for inspection.");}});
  await stage("remove owned fixture directory",async()=>{assert.ok(stopped,"Retain fixture files while owned runtime cleanup is unverified.");if(temporary)await fs.rm(temporary,{recursive:true,force:true});});
 }finally{clearTimeout(watchdog);}
 if(errors.length)throw new AggregateError(errors,"Desktop fixture cleanup did not pass. Inspect every owned runtime and listener error.");
}
module.exports={cleanupDesktop};
