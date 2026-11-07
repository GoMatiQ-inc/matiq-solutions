const test=require("node:test"),assert=require("node:assert/strict"),{prepareShutdown}=require("../app/lifecycle.cjs");
test("a rollback beginning during a held settings write blocks shutdown before disposal",async()=>{
 let release,busy=false,disposed=false;const pending=new Promise(resolve=>{release=resolve;});
 const result=prepareShutdown({busy:()=>busy,settings:()=>pending,dispose:async()=>{disposed=true;}});busy=true;release();await assert.rejects(result,/Finish tool changes/);assert.equal(disposed,false);
});
test("a tool change beginning during disposal blocks the final quit or relaunch",async()=>{
 let release,entered,busy=false;const pending=new Promise(resolve=>{release=resolve;}),started=new Promise(resolve=>{entered=resolve;});
 const result=prepareShutdown({busy:()=>busy,settings:async()=>{},dispose:async()=>{entered();await pending;}});await started;busy=true;release();await assert.rejects(result,/Finish tool changes/);
});
