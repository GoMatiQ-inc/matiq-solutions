// Shared setup presentation. The tool verifies and persists every action through its native bridge.
export async function mountSetup({name, steps, api, onComplete = async () => {}, onLeave = () => {}}) {
  let state = await api.read(), busy = false;
  const el = (tag, text) => { const node = document.createElement(tag); if (text) node.textContent = text; return node; };
  const button = (text, action) => { const node = el('button', text); node.type = 'button'; node.onclick = action; return node; };
  const css = el('link'); css.rel = 'stylesheet'; css.href = new URL('setup-preview.css', import.meta.url).href; document.head.append(css);
  const dialog = el('dialog'); dialog.className = 'matiq-setup-preview'; dialog.setAttribute('aria-label', name+' setup');
  const resume = button('Resume '+name+' setup', () => { dialog.showModal(); draw(); }); resume.className = 'matiq-setup-resume'; resume.hidden = true;
  document.body.append(dialog, resume);
  const workspace = document.querySelector('main');
  const block = () => { if (workspace) workspace.inert = !state.completed; };
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  dialog.addEventListener('close', () => { if (!state.completed) { resume.hidden = false; block(); onLeave(); } });
  async function perform(operation) {
    if (busy) return; busy = true; draw();
    try { state = await operation(); busy = false; draw(); }
    catch (error) { busy = false; draw(); const message=el('p',error.message);message.setAttribute('role','alert');dialog.querySelector('.setup-fields').append(message); }
  }
  function draw() {
    block(); dialog.replaceChildren(); const step = steps[state.step];
    const header=el('div');header.className='setup-line';const leave=button('Finish later',()=>dialog.close());leave.disabled=busy;header.append(el('small',name+' setup · '+(state.step+1)+' of '+steps.length),leave);
    dialog.append(header,el('h2',step.title),el('p',typeof step.body==='function'?step.body():step.body));
    const fields=el('div');fields.className='setup-fields';dialog.append(fields);
    const next=button(state.step===steps.length-1?'Finish setup':'Continue',()=>perform(async()=>{
      if(state.step===steps.length-1){const ready=await api.complete();if(!ready.completed)throw Error('Setup is incomplete. Finish its required checks.');state=ready;await onComplete();dialog.close();resume.hidden=true;block();return ready;}
      return api.progress(state.step+1);
    }));
    if(step.kind==='choice') {
      const label=el('label',step.label),select=el('select');select.setAttribute('aria-label',step.label);
      const blank=el('option','Choose an option');blank.value='';select.append(blank);
      for(const [value,title] of step.options){const option=el('option',title);option.value=value;select.append(option);}
      select.value=state.values[step.id]||'';select.disabled=busy;select.onchange=()=>perform(()=>api.review(step.id,select.value));fields.append(label,select);
    } else if(step.kind==='check') {
      const check=button(step.action,()=>perform(()=>api.check(step.id)));check.disabled=busy;const status=el('p');status.dataset.setupStatus='';status.textContent=state.values[step.id]?'Verified.':busy?'Checking…':'Not checked yet.';fields.append(check,status);
      if(step.help)fields.append(el('p',typeof step.help==='function'?step.help():step.help));
    } else if(step.kind==='review') {
      const label=el('label'),check=el('input');label.className='setup-check';check.type='checkbox';check.checked=state.values[step.id]==='reviewed';check.disabled=busy;
      check.onchange=()=>perform(()=>api.review(step.id,check.checked?'reviewed':''));label.append(check,el('span',step.label));fields.append(label);
    } else {
      const list=el('ul');for(const previous of steps.slice(0,-1))list.append(el('li',previous.title+' — '+(previous.kind==='choice'?previous.options.find(x=>x[0]===state.values[previous.id])?.[1]||'Not configured':state.values[previous.id]?'Complete':'Not configured')));fields.append(list);
    }
    next.disabled=busy||(step.kind==='summary'?steps.slice(0,-1).some(s=>!state.values[s.id]):!state.values[step.id]);
    const footer=el('div');footer.className='setup-line';const back=button('Back',()=>perform(()=>api.progress(state.step-1)));back.disabled=busy||state.step===0;footer.append(back,next);dialog.append(footer);
  }
  if(!state.completed){block();dialog.showModal();draw();}
  return {async open(){state=await api.read();if(state.completed)state=await api.reopen();block();if(!dialog.open)dialog.showModal();draw();},progress:message=>{const status=dialog.querySelector('[data-setup-status]');if(status&&busy)status.textContent=message;},isComplete:()=>state.completed};
}
