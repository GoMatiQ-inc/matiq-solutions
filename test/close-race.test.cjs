const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path"),{createRequire}=require("node:module");
const file=require.resolve("@matiq-solutions/runtime/tool-host.cjs"),localRequire=createRequire(file);
function host() {
 const module={exports:{}};
 vm.runInNewContext(fs.readFileSync(file,"utf8"),{module,exports:module.exports,require:name=>name==="electron"?{app:{getPath:()=>"/fixture"}}:localRequire(name),setTimeout,clearTimeout});
 return new module.exports.ToolHost({window:{on(){},getContentSize:()=>[1200,800]},store:{root:"/store"},dataRoot:"/data",emit(){}});
}
function tool(id,status) {
 const dom={inert:false},entry={id,name:id,dom,requests:new Set(),disposed:false,closing:false};
 entry.view={setVisible(){},setBounds(){},webContents:{isDestroyed:()=>false,executeJavaScript:async script=>vm.runInNewContext(script,{document:{documentElement:dom}})}};
 entry.instance={status,dispose:async()=>{entry.disposed=true;}};
 entry.cleanup=async()=>{};entry.setClosing=value=>{entry.closing=value;};
 return entry;
}
test("a later tool status cannot hide a new unsaved edit in an earlier workspace",async()=>{
 const h=host();let dirty=false,edited=false;
 const a=tool("first",async()=>({busy:dirty,reason:"save your document"}));
 const b=tool("second",async()=>{if(!edited){assert.equal(a.dom.inert,false);dirty=true;edited=true;}return {busy:false};});
 h.running.set(a.id,a);h.running.set(b.id,b);
 await assert.rejects(h.dispose(),/save your document/);
 assert.equal(h.running.size,2);assert.equal(a.disposed,false);assert.equal(b.disposed,false);
 assert.equal(dirty,true);assert.equal(a.dom.inert,false);assert.equal(b.dom.inert,false);
 assert.equal(a.closing,false);assert.equal(b.closing,false);
 dirty=false;await h.dispose();assert.equal(h.running.size,0);
});
test("a failed activation closes through disposal without calling its broken renderer status",async()=>{
 const h=host(),entry=tool("failed",async()=>{throw Error("Renderer has gone");});
 entry.activationFailed=true;entry.failureReason="Close to retry cleanup";h.running.set(entry.id,entry);
 const rows=await h.status();assert.equal(rows[0].recovery,true);
 await h.close(entry.id);assert.equal(entry.disposed,true);assert.equal(h.running.size,0);
});
