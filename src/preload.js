const { contextBridge, ipcRenderer } = require('electron')


contextBridge.exposeInMainWorld('electronAPI', {

  minimizeWindow: () => ipcRenderer.send('minimize-window'),
  maximizeWindow: () => ipcRenderer.send('maximize-window'),
  closeWindow: () => ipcRenderer.send('close-window'),
  
  
  searchAnime: (query, category, filter) => ipcRenderer.invoke('searchAnime', query, category, filter),
  startDownload: (data) => ipcRenderer.invoke('start-download', data),
  pauseDownload: (infoHash) => ipcRenderer.invoke('pause-download', infoHash),
  resumeDownload: (infoHash) => ipcRenderer.invoke('resume-download', infoHash),
  removeDownload: (infoHash) => ipcRenderer.invoke('remove-download', infoHash),
  cancelDownload: (id) => ipcRenderer.invoke('cancelDownload', id),
  

  onDownloadUpdate: (callback) => {
    ipcRenderer.on('download-update', (event, data) => callback(data))
    return () => {
      ipcRenderer.removeListener('download-update', callback)
    }
  },
  

  selectDownloadPath: () => ipcRenderer.invoke('select-download-path'),
  openFolder: (path) => ipcRenderer.invoke('open-folder', path),
});
