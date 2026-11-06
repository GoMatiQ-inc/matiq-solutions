const fs=require('node:fs/promises');
const {fileURLToPath}=require('node:url');
function frameGuard(contents, workspace) {
  const expected=fs.realpath(workspace);
  return async event=>{
    if(event.sender!==contents || event.senderFrame!==contents.mainFrame)
      throw Error('Commands require the trusted application workspace. Reopen the tool.');
    let actual;
    try { actual=await fs.realpath(fileURLToPath(event.senderFrame.url)); }
    catch { throw Error('Commands require a local application workspace. Reopen the tool.'); }
    if(actual!==await expected)
      throw Error('This page is not the installed workspace. Reopen the tool.');
  };
}
module.exports={frameGuard};
