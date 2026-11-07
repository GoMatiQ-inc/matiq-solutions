#!/usr/bin/env node
const fs = require("node:fs/promises"),
  path = require("node:path");
const { pack, validateManifest } = require("./index.cjs");
const sdkVersion = require("./package.json").version;
const sdkAsset = name => `https://github.com/GoMatiQ-inc/matiq-solutions/releases/download/sdk-v${sdkVersion}/matiq-solutions-${name}-${sdkVersion}.tgz`;
async function create(
  destination,
  { id = "com.matiq.newtool", name = "New tool" } = {},
) {
  const manifest = {
    schema: 1,
    id,
    name,
    description: "A private local workspace.",
    version: "0.1.0",
    sdk: 1,
    dataVersion: 1,
    runtime: "electron-45.2.3",
    targets: [
      "darwin-arm64",
      "darwin-x64",
      "win32-x64",
      "win32-arm64",
      "linux-x64",
    ],
    capabilities: [],
    adapter: "src/tool.cjs",
    workspace: "src/index.html",
    preload: "src/preload.cjs",
  };
  validateManifest(manifest);
  await fs.mkdir(destination, { recursive: false });
  await fs.mkdir(path.join(destination, "src"));
  const title = name.replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[char]);
  const files = {
    "matiq-tool.json": JSON.stringify(manifest, null, 2) + "\n",
    "package.json":
      JSON.stringify(
        {
          name: id,
          productName: name,
          version: "0.1.0",
          private: true,
          license: "SEE LICENSE IN LICENSE",
          engines: {node:">=22.12.0"},
          main: "src/main.cjs",
          scripts: {
            start: "electron .",
            package: "electron-builder --publish never",
            "tool:validate": "matiq-tool validate",
            "tool:pack": "matiq-tool pack --output tool.mqt",
            "tool:pack-app": "matiq-tool pack-app",
          },
          dependencies: {
            "@matiq-solutions/runtime": sdkAsset("runtime"),
            "@matiq-solutions/shell": sdkAsset("shell"),
          },
          devDependencies: {
            "@matiq-solutions/sdk": sdkAsset("sdk"),
            electron: "45.2.3",
            "electron-builder": "26.18.0",
          },
          build: {
            appId: id,
            productName: name,
            icon: "node_modules/@matiq-solutions/shell/assets/app-icon.png",
            mac: {icon:"node_modules/@matiq-solutions/shell/assets/app-icon.icns"},
            files: ["src/**/*", "matiq-tool.json", "package.json", "LICENSE"],
          },
        },
        null,
        2,
      ) + "\n",
    "LICENSE": await fs.readFile(path.join(__dirname,"LICENSE"),"utf8"),
    ".gitignore": "node_modules/\ndist/\n*.mqt\n",
    "src/main.cjs":
      "require('@matiq-solutions/runtime/standalone.cjs').launch({root:require('node:path').join(__dirname,'..')}).catch(error=>{require('electron').dialog.showErrorBox('Could not start',error.message);require('electron').app.quit();});\n",
    "src/preload.cjs":
      "const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('tool',{request:(name,args)=>ipcRenderer.invoke('" +
      id +
      ":request',name,args)});\n",
    "src/tool.cjs": `const fs=require('node:fs/promises'),path=require('node:path');
exports.activate=async host=>{
 const file=path.join(host.dataDir,'document.txt');let savedText='',saving=false;
 host.handle('${id}:request',async(name,text)=>{
  if(name==='load'){try{savedText=await fs.readFile(file,'utf8');return savedText;}catch(e){if(e.code==='ENOENT')return '';throw e;}}
  if(name==='save'){
   if(typeof text!=='string'||text.length>1000000)throw Error('Keep the document under one million characters.');
   if(saving)throw Error('Wait for the current save.');
   saving=true;
   try{const tmp=file+'.tmp';await fs.writeFile(tmp,text,{mode:0o600});await fs.rename(tmp,file);savedText=text;return true;}finally{saving=false;}
  }
  throw Error('Unknown tool command.');
 });
 await host.view.webContents.loadFile(path.join(host.resourceDir,'src/index.html'));
 return {status:async()=>{const current=await host.view.webContents.executeJavaScript("document.querySelector('textarea').value");return {busy:saving||current!==savedText,reason:saving?'saving document':current!==savedText?'save your document first':''};},dispose:async()=>{}};
};`,
    "src/index.html":
      '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="default-src \'self\'; script-src \'self\'; style-src \'self\'; connect-src \'none\'; object-src \'none\'; base-uri \'none\'"><title>' + title + '</title><link rel="stylesheet" href="style.css"></head><body><aside class="sidebar"><div class="brand"><img src="../node_modules/@matiq-solutions/shell/assets/matiq-solutions-wordmark-dark.png" alt="MatiQ Solutions"><span>' + title + '</span></div><nav aria-label="Main navigation"><button class="active" aria-current="page">Document</button></nav><div class="sidebar-foot"><strong>On your device</strong><span>Your files stay local.</span></div></aside><div class="workspace"><header><h1>Document</h1></header><main><h2>Your local workspace.</h2><p>A tool in its own repository. Your document stays on this device.</p><textarea aria-label="Document"></textarea><button id="save">Save document</button><p id="status" role="status"></p></main><footer>By MatiQ Solutions<span>Your work. Your device.</span></footer></div><script src="app.js"></script></body></html>',
    "src/style.css":
      "textarea{display:block;width:100%;height:260px;margin:24px 0;font:inherit}button{font:inherit;padding:10px 18px}",
    "src/app.js": `const text=document.querySelector('textarea'),status=document.querySelector('#status'),save=document.querySelector('#save');
text.disabled=true;save.disabled=true;
window.tool.request('load').then(value=>{text.value=value;text.disabled=false;save.disabled=false;}).catch(e=>status.textContent='Document could not be loaded. Reopen the tool before editing: '+e.message);
text.oninput=()=>status.textContent='Unsaved changes';
save.onclick=async()=>{save.disabled=true;const snapshot=text.value;try{await window.tool.request('save',snapshot);status.textContent=text.value===snapshot?'Saved on this device.':'Unsaved changes';}catch(e){status.textContent=e.message;}finally{save.disabled=false;}};
`,
  };
  for (const [name, data] of Object.entries(files))
    await fs.writeFile(path.join(destination, name), data);
  return manifest;
}
async function main(args) {
  const command = args[0],
    value = (flag) => args[args.indexOf(flag) + 1];
  if (command === "create") {
    if (!args[1])
      throw Error(
        "Use matiq-tool create <new-directory> [--id com.example.tool] [--name Name].",
      );
    await create(path.resolve(args[1]), {
      id: args.includes("--id") ? value("--id") : undefined,
      name: args.includes("--name") ? value("--name") : undefined,
    });
    console.log(
      "Created standalone/suite tool. Keep its implementation in this repository.",
    );
    return;
  }
  const root = process.cwd(),
    manifest = validateManifest(
      JSON.parse(await fs.readFile(path.join(root, "matiq-tool.json"), "utf8")),
    );
  if (command === "validate") {
    for (const f of [manifest.adapter, manifest.workspace, manifest.preload])
      await fs.access(path.join(root, f));
    console.log("Tool manifest and entry files are valid.");
    return;
  }
  if (command === "pack-app") {
    if (!process.env.MATIQ_TOOL_SIGNING_KEY) throw Error("Supply MATIQ_TOOL_SIGNING_KEY through the release signing environment.");
    const result = await require("./package-app.cjs").packApp({
      resources: path.resolve(value("--resources")), manifest, target: value("--target"),
      extra: args.includes("--extra") ? value("--extra").split(",") : [],
      output: path.resolve(value("--output")), url: value("--url"),
      privateKey: process.env.MATIQ_TOOL_SIGNING_KEY,
      publisher: process.env.MATIQ_TOOL_PUBLISHER || "matiq-solutions-release-v1",
    });
    console.log(JSON.stringify(result));
    return;
  }
  if (command === "pack") {
    if (!process.env.MATIQ_TOOL_SIGNING_KEY)
      throw Error(
        "Supply MATIQ_TOOL_SIGNING_KEY through the release signing environment.",
      );
    const result = await pack({
      root,
      manifest,
      publisher:
        process.env.MATIQ_TOOL_PUBLISHER || "matiq-solutions-release-v1",
      privateKey: process.env.MATIQ_TOOL_SIGNING_KEY,
      include: args.includes("--include")
        ? value("--include").split(",")
        : ["src"],
      output: path.resolve(
        args.includes("--output") ? value("--output") : "tool.mqt",
      ),
    });
    console.log(JSON.stringify(result));
    return;
  }
  throw Error("Use create, validate, pack or pack-app.");
}
if (require.main === module)
  main(process.argv.slice(2)).catch((e) => {
    console.error(e.message);
    process.exitCode = 1;
  });
module.exports = { create, main };
