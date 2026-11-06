const path = require("node:path"),fs=require("node:fs/promises"),{pathToFileURL}=require("node:url");
const stylesheet=path.join(__dirname,"shell.css"),suiteStylesheet=path.join(__dirname,"suite-tool.css"),assets=path.join(__dirname,"assets");
async function apply(contents,{suite=false}={}) {
  let css=await fs.readFile(stylesheet,"utf8");
  css=css.replace(/url\(assets\/([a-z0-9.-]+)\)/g,(_match,name)=>'url("'+pathToFileURL(path.join(assets,name)).href+'")');
  if(suite)css+="\n"+await fs.readFile(suiteStylesheet,"utf8");
  return contents.insertCSS(css);
}
module.exports={stylesheet,suiteStylesheet,assets,apply};
