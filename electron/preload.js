const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  // Данные (чаты / группы)
  dataGet:        ()              => ipcRenderer.invoke('data:get'),
  dataSave:       (data)          => ipcRenderer.invoke('data:save', data),

  // Настройки
  settingsGet:    ()              => ipcRenderer.invoke('settings:get'),
  settingsSave:   (s)             => ipcRenderer.invoke('settings:save', s),

  // Ollama
  ollamaStatus:   ()              => ipcRenderer.invoke('ollama:status'),
  ollamaEnsure:   ()              => ipcRenderer.invoke('ollama:ensure-running'),
  ollamaPath:     ()              => ipcRenderer.invoke('ollama:path'),
  pullModel:      (name)          => ipcRenderer.invoke('ollama:pull', name),
  deleteModel:    (name)          => ipcRenderer.invoke('ollama:delete', name),
  onPullProgress: (cb)            => {
    const handler = (_e, data) => cb(data);
    ipcRenderer.on('pull-progress', handler);
    return () => ipcRenderer.removeListener('pull-progress', handler);
  },

  // Внешние ссылки
  openExternal:   (url)           => ipcRenderer.invoke('shell:open', url),
  openProjectsFolder: ()          => ipcRenderer.invoke('projects:open-folder'),
  getProjectsRoot: ()             => ipcRenderer.invoke('projects:get-root'),
  ensureProjectFolder: (name, preferredFolderName) => ipcRenderer.invoke('projects:ensure-folder', name, preferredFolderName),
  renameProjectFolder: (oldFolderName, newName) => ipcRenderer.invoke('projects:rename-folder', oldFolderName, newName),
  writeProjectFile: (folderName, filePath, content) => ipcRenderer.invoke('projects:write-file', folderName, filePath, content),
  projectFileExists: (folderName, filePath) => ipcRenderer.invoke('projects:file-exists', folderName, filePath),
  installPythonPackages: (packages, folderName) => ipcRenderer.invoke('python:install-packages', packages, folderName),
  installNodePackages: (packages, folderName) => ipcRenderer.invoke('node:install-packages', packages, folderName),
});
