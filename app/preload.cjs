const { contextBridge, ipcRenderer } = require("electron");
contextBridge.exposeInMainWorld("solutions", {
  request: (name, args) => ipcRenderer.invoke("solutions:request", name, args),
  onEvent: (callback) => {
    const fn = (_, event) => callback(event);
    ipcRenderer.on("solutions:event", fn);
    return () => ipcRenderer.removeListener("solutions:event", fn);
  },
});
