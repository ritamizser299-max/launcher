const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('bootstrapper', {
  // Listen for status updates
  onStatus: (callback) => {
    ipcRenderer.on('status', (event, data) => callback(data));
  },
  
  // Retry download
  retry: () => ipcRenderer.invoke('retry'),
  
  // Close window
  close: () => ipcRenderer.send('window-close'),
  
  // Get current install path
  getInstallPath: () => ipcRenderer.invoke('get-install-path'),
  
  // Get default install path
  getDefaultPath: () => ipcRenderer.invoke('get-default-path'),
  
  // Select custom install path
  selectInstallPath: () => ipcRenderer.invoke('select-install-path'),
  
  // Reset to default path
  resetInstallPath: () => ipcRenderer.invoke('reset-install-path')
});
