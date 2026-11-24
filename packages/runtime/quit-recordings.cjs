async function stopRecordingsForQuit({tools, confirm}) {
  const recording = [];
  for (const tool of tools) {
    const status = await tool.status();
    if (status.recording) {
      if (typeof tool.stopAndSave !== 'function') throw Error('Stop and save '+tool.name+' before quitting; it does not support safe recording shutdown.');
      recording.push(tool);
    }
  }
  if (!recording.length) return true;
  const choice = await confirm({
    type: 'warning', message: 'Stop recording, save, and quit?',
    detail: recording.map(t => t.name).join(', ')+' is recording or paused. Quitting will stop recording and save captured work on this device. If saving fails, the app will stay open. Dictation audio is saved locally for recovery only when you confirm this action.',
    buttons: ['Keep recording', 'Stop, save, and quit'], defaultId: 0, cancelId: 0, noLink: true
  });
  if (choice.response !== 1) return false;
  for (const tool of recording) await tool.stopAndSave();
  for (const tool of recording) if ((await tool.status()).recording) throw Error(tool.name+' is still recording. Keep the app open and retry stopping it.');
  return true;
}
module.exports = {stopRecordingsForQuit};
