const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const fs = require("node:fs/promises"), path = require("node:path");
const { validateManifest } = require("@matiq-solutions/sdk");
const { acquireToolLease } = require("./tool-lease.cjs");
async function launch({ root, profile }) {
  const manifest = validateManifest(JSON.parse(await fs.readFile(path.join(root, "matiq-tool.json"), "utf8")));
  app.setName(manifest.name);
  if (profile) app.setPath("userData", profile);
  if (!app.requestSingleInstanceLock()) { app.quit(); return; }
  await app.whenReady();
  const lease = await acquireToolLease({ root:path.join(app.getPath("appData"),"MatiQ Solutions","tool-locks"),id:manifest.id,owner:app.getName() });
  const dataDir = app.getPath("userData");
  await fs.mkdir(dataDir, { recursive: true, mode: 0o700 });
  const window = new BrowserWindow({
    width:1120,height:820,title:manifest.name,backgroundColor:"#fff",
    webPreferences:{preload:path.join(root,manifest.preload),contextIsolation:true,nodeIntegration:false,sandbox:true},
  });
  const contents=window.webContents,channels=[],listeners=[],requests=new Set();
  let quitting=false,closing=false,checking=false;
  contents.setWindowOpenHandler(()=>({action:"deny"}));
  contents.on("will-navigate",e=>e.preventDefault());
  contents.session.setPermissionRequestHandler((_c,_p,cb)=>cb(false));
  const requireFrame=require("./trusted-frame.cjs").frameGuard(contents,path.join(root,manifest.workspace));
  const host={
    window,view:{webContents:contents},session:contents.session,dataDir,resourceDir:root,manifest,
    protectedRoots:[root,dataDir],
    handle(channel,fn){
      if(typeof channel!=="string"||channel.startsWith("solutions:")||channels.includes(channel))throw Error("Choose a unique tool command channel.");
      ipcMain.handle(channel,async(event,...args)=>{
        const request=(async()=>{await requireFrame(event);if(closing)throw Error("This tool is closing. Retry after reopening.");return fn(...args);})();
        requests.add(request);try{return await request;}finally{requests.delete(request);}
      });channels.push(channel);
    },
    emit:(channel,event)=>{if(!contents.isDestroyed())contents.send(channel,event);},
    on(emitter,event,fn){emitter.on(event,fn);listeners.push([emitter,event,fn]);},
    show(){window.show();window.focus();},
    close:async()=>{setImmediate(()=>app.quit());return {requested:true};},
  };
  let instance,activating=true,activationFailed=false;
  app.on("second-instance",()=>host.show());app.on("activate",()=>host.show());
  window.on("close",event=>{if(quitting)return;event.preventDefault();app.quit();});
  app.on("before-quit",event=>{
    if(quitting)return;event.preventDefault();if(checking)return;checking=true;
    (async()=>{
      if(activating)throw Error("Wait for the tool to finish opening.");
      let timer;
      try{await Promise.race([Promise.allSettled([...requests]),new Promise(resolve=>{timer=setTimeout(resolve,1000);})]);}
      finally{clearTimeout(timer);}
      if(requests.size)throw Error("Wait for the current request to finish before quitting.");
      if(!activationFailed){
        const initial=await instance.status();if(initial.busy)throw Error(initial.reason||"Finish your work before quitting.");
        await contents.executeJavaScript("document.documentElement.inert=true");
        const final=await instance.status();if(final.busy)throw Error(final.reason||"Finish your work before quitting.");
      }
      if(requests.size)throw Error("Wait for the current request to finish before quitting.");
      closing=true;await instance.dispose();
      for(const channel of channels)ipcMain.removeHandler(channel);
      for(const [emitter,event,fn] of listeners)emitter.removeListener(event,fn);
      await lease.release();quitting=true;app.quit();
    })().catch(async error=>{closing=activationFailed;let detail=error.message;try{if(!contents.isDestroyed())await contents.executeJavaScript("document.documentElement.inert=false");}catch(restoreError){detail+=" Window recovery failed: "+restoreError.message;}dialog.showErrorBox("Tool could not close",detail);host.show();}).finally(()=>{checking=false;});
  });
  app.on("window-all-closed",()=>app.quit());
  try {
    instance=await require(path.join(root,manifest.adapter)).activate(host);
    if(typeof instance?.status!=="function"||typeof instance?.dispose!=="function")throw Error("Tool must provide status() and dispose().");
    await require("@matiq-solutions/shell").apply(contents);
    activating=false;
  } catch(error) {
    activating=false;activationFailed=true;closing=true;
    try { await instance?.dispose?.(); }
    catch(shutdownError) { throw Error(`Tool startup failed (${error.message}) and cleanup needs retry (${shutdownError.message}). Quit the tool to retry cleanup.`); }
    for(const channel of channels)ipcMain.removeHandler(channel);
    for(const [emitter,event,fn] of listeners)emitter.removeListener(event,fn);
    quitting=true;window.destroy();await lease.release();throw error;
  }
  return {window,instance};
}
module.exports={launch};
