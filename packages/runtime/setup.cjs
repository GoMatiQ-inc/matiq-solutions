const fs = require('node:fs/promises');
const path = require('node:path');
function createSetup({file, steps, validate = async () => {}, validateChoice = (step, value) => step.options.some(option => option[0] === value)}) {
  let state = {schema: 1, completed: false, step: 0, values: {}}, tail = Promise.resolve();
  const initial = (async () => {
    try {
      const value = JSON.parse(await fs.readFile(file, 'utf8'));
      if (value.schema !== 1 || typeof value.completed !== 'boolean' || !Number.isInteger(value.step) || value.step < 0 || value.step >= steps.length || !value.values || typeof value.values !== 'object' || Array.isArray(value.values)) throw Error('Invalid saved setup.');
      state = value;
    } catch (error) { if (error.code !== 'ENOENT') throw Error('Saved setup could not be read. Preserve '+file+' and recover it before continuing: '+error.message); }
  })();
  const snapshot = () => structuredClone(state);
  const update = operation => {
    const result = tail.then(async () => {
      await initial; const next = snapshot(); await operation(next);
      await fs.mkdir(path.dirname(file), {recursive: true, mode: 0o700});
      await fs.writeFile(file+'.tmp', JSON.stringify(next)+'\n', {mode: 0o600});
      await fs.rename(file+'.tmp', file); state = next; return snapshot();
    });
    tail = result.catch(() => {}); return result;
  };
  const find = id => { const step = steps.find(s => s.id === id); if (!step) throw Error('Choose a listed setup section.'); return step; };
  return {
    async read() { await initial; await tail; return snapshot(); },
    review(id, value) {
      const step = find(id);
      if (step.kind === 'choice' ? !validateChoice(step, value) : step.kind !== 'review' || !['reviewed',''].includes(value)) throw Error('Choose a valid option or explicitly confirm this setup section.');
      return update(next => { next.values[id] = value; next.completed = false; });
    },
    check(id, operation) {
      if (find(id).kind !== 'check' || typeof operation !== 'function') throw Error('This setup check must be verified by the tool.');
      return update(async next => { await operation(); next.values[id] = 'verified'; next.completed = false; });
    },
    progress(step) {
      if (!Number.isInteger(step) || step < 0 || step >= steps.length) throw Error('Choose a valid setup step.');
      return update(next => { if (steps.slice(0,step).some(s => !next.values[s.id])) throw Error('Complete the preceding setup sections first.'); next.step = step; });
    },
    invalidate(ids) { return update(next => { for (const id of ids) { delete next.values[find(id).id]; next.step = Math.min(next.step, steps.findIndex(step => step.id === id)); } next.completed = false; }); },
    reopen() { return update(next => { next.completed = false; next.step = 0; }); },
    complete() {
      return update(async next => {
        if (steps.filter(s => s.kind !== 'summary').some(s => !next.values[s.id])) throw Error('Complete every required setup section before using this tool.');
        await validate(snapshot()); next.completed = true;
      });
    },
    async assertReady() { const current = await this.read(); if (!current.completed) throw Error('Complete setup before using this tool.'); },
    async idle() { await initial; await tail; }
  };
}
module.exports = {createSetup};
