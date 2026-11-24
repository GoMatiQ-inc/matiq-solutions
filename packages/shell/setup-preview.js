// Design preview only. Tools supply their own steps; no OS access or downloads occur.
const matiqSetupPreviewScript = document.currentScript.src;
window.matiqSetupPreview = function ({id, name, steps}) {
  const hosted = new URLSearchParams(location.search).get('mode') !== 'standalone';
  const key = 'matiq-setup-preview-v1:' + id + ':' + (hosted ? 'hosted' : 'standalone');
  let state; try { state = JSON.parse(localStorage.getItem(key)); } catch {}
  state ||= {step: 0, values: {}, complete: false};
  window.matiqPrototypeSetupReady = state.complete;
  const persist = () => localStorage.setItem(key, JSON.stringify(state));
  const appName = hosted ? 'MatiQ Solutions' : 'MatiQ ' + name;
  const node = (tag, text) => { const n = document.createElement(tag); if (text) n.textContent = text; return n; };
  const button = (text, fn) => { const n = node('button', text); n.type = 'button'; n.onclick = fn; return n; };
  const style = node('link'); style.rel = 'stylesheet'; style.href = new URL('setup-preview.css', matiqSetupPreviewScript).href; document.head.append(style);
  const dialog = node('dialog'); dialog.className = 'matiq-setup-preview'; dialog.setAttribute('aria-label', name + ' setup');
  const resume = button('Resume ' + name + ' setup', () => { dialog.showModal(); draw(); }); resume.className = 'matiq-setup-resume'; resume.hidden = true;
  document.body.append(dialog, resume);
  dialog.addEventListener('cancel', event => event.preventDefault());
  const workspace = document.querySelector('main');
  const saved = (step) => state.values[step.id] ?? '';
  function draw() {
    persist(); dialog.replaceChildren(); const step = steps[state.step];
    const header = node('div'); header.className = 'setup-line'; header.append(node('small', name + ' setup · ' + (state.step + 1) + ' of ' + steps.length), button('Finish later', () => { dialog.close(); resume.hidden = false; if (workspace) workspace.inert = true; }));
    dialog.append(header, node('h2', step.title), node('p', step.body.replaceAll('{app}', appName)));
    const body = node('div'); body.className = 'setup-fields'; dialog.append(body);
    const next = button(state.step === steps.length - 1 ? 'Finish setup' : 'Continue', () => {
      if (state.step === steps.length - 1) { state.complete = true; window.matiqPrototypeSetupReady = true; persist(); window.dispatchEvent(new CustomEvent('matiq:setup-preview-complete', {detail: structuredClone(state.values)})); dialog.close(); resume.hidden = true; if (workspace) workspace.inert = false; return; }
      state.step++; draw();
    });
    if (step.kind === 'choice') {
      const label = node('label', step.label); const select = node('select'); select.setAttribute('aria-label', step.label);
      const blank = node('option', 'Choose an option'); blank.value = ''; select.append(blank);
      for (const [value, title] of step.options) { const option = node('option', title); option.value = value; select.append(option); }
      select.value = saved(step); select.onchange = () => { state.values[step.id] = select.value; persist(); next.disabled = !select.value; };
      body.append(label, select); next.disabled = !saved(step);
    } else if (step.kind === 'check') {
      const status = node('p', saved(step) === 'verified' ? step.success : 'Not checked yet.'); status.setAttribute('role', 'status');
      const check = button(step.action, () => { state.values[step.id] = 'verified'; draw(); });
      body.append(check, status);
      if (step.permission) {
        body.append(node('p', 'In System Settings → Privacy & Security, enable ' + appName + '. If macOS requests a restart, quit and reopen ' + appName + ', then check again. Setup resumes here.'));
        body.append(button('Preview permission denied', () => { state.values[step.id] = ''; draw(); const notice = node('p', 'Permission is still off. Setup remains incomplete. No recording started; you can finish later and quit normally.'); notice.setAttribute('role', 'alert'); dialog.querySelector('.setup-fields').append(notice); }));
      }
      next.disabled = saved(step) !== 'verified';
    } else if (step.kind === 'review') {
      const label = node('label'); label.className = 'setup-check'; const check = node('input'); check.type = 'checkbox'; check.checked = saved(step) === 'reviewed';
      check.onchange = () => { state.values[step.id] = check.checked ? 'reviewed' : ''; persist(); next.disabled = !check.checked; }; label.append(check, node('span', step.label)); body.append(label); next.disabled = !check.checked;
    } else if (step.kind === 'summary') {
      const list = node('ul'); for (const earlier of steps.slice(0, -1)) list.append(node('li', earlier.title + ' — ' + (earlier.kind === 'choice' ? earlier.options.find(x => x[0] === saved(earlier))?.[1] || 'Not configured' : saved(earlier) ? 'Complete' : 'Not configured')));
      body.append(list); next.disabled = steps.slice(0, -1).some(x => !saved(x));
    }
    const footer = node('div'); footer.className = 'setup-line'; const back = button('Back', () => { state.step--; draw(); }); back.disabled = state.step === 0; footer.append(back, next); dialog.append(footer, node('small', 'Interactive prototype: checks and permissions are simulated. No device settings change.'));
  }
  const reset = button('Preview first-time setup', () => { state = {step: 0, values: {}, complete: false}; window.matiqPrototypeSetupReady = false; if (workspace) workspace.inert = true; resume.hidden = true; if (!dialog.open) dialog.showModal(); draw(); }); reset.className = 'matiq-setup-replay'; document.body.append(reset);
  if (!state.complete) { if (workspace) workspace.inert = true; dialog.showModal(); draw(); }
};
