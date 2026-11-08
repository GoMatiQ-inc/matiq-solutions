// Navigation uses existing tool controls; no tool UI is maintained in the suite.
const controls = `Array.from(document.querySelectorAll('.sidebar nav button, [data-matiq-nav]')).filter(b=>!b.classList.contains('chat-history'))`;
const settings = `Array.from(document.querySelectorAll('.sidebar button, [data-matiq-settings]')).find(b=>b.hasAttribute('data-matiq-settings')||b.dataset.page==='settings'||b.id==='settings-nav'||b.textContent.trim().toLowerCase()==='settings')`;
async function describe(contents) {
  return contents.executeJavaScript(
    `(()=>{const buttons=${controls},settings=${settings};return {items:buttons.map((b,index)=>({index,label:b.getAttribute('aria-label')||b.textContent.trim(),active:b.classList.contains('active')||b.getAttribute('aria-current')==='page',disabled:b.disabled})).filter(item=>buttons[item.index]!==settings),settings:Boolean(settings)};})()`,
  );
}
async function navigate(contents, index) {
  if (
    index !== "settings" &&
    (!Number.isInteger(index) || index < 0 || index > 100)
  )
    throw Error("Choose an available tool navigation item.");
  return contents.executeJavaScript(
    `(()=>{const button=${index === "settings" ? settings : `(${controls})[${index}]`};if(!button||button.disabled)throw Error('This tool page is unavailable. Reopen the tool and try again.');button.click();return true;})()`,
  );
}
async function prepare(contents) {
  await contents.executeJavaScript(
    `(()=>{const setup=document.querySelector('#open-setup'),preferences=document.querySelector('#page-settings');if(setup&&preferences&&!preferences.contains(setup))preferences.prepend(setup);})()`,
  );
}
module.exports = { describe, navigate, prepare };
