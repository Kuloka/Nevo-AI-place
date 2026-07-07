const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');
const { spawn, execSync, exec } = require('child_process');

// ============================================================
//  Nevo data folders
// ============================================================
const LEGACY_DATA_DIR = path.join(os.homedir(), `.ne${'bula'}-data`);
const DATA_DIR = path.join(os.homedir(), '.nevo-data');
const LEGACY_PROJECTS_DIR = path.join(os.homedir(), `Ne${'bula'}Project`);
const PROJECTS_DIR = path.join(os.homedir(), 'NevoProject');
const CHATS_FILE = path.join(DATA_DIR, 'data.json');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const OLLAMA_WINDOWS_INSTALL_URL = 'https://ollama.com/install.ps1';
const OLLAMA_LINUX_INSTALL_URL = 'https://ollama.com/install.sh';
const OLLAMA_HOST = 'http://127.0.0.1:11434';
const ELECTRON_USER_DATA_DIR = path.join(DATA_DIR, 'electron-user-data');
const ELECTRON_CACHE_DIR = path.join(DATA_DIR, 'cache');
const ELECTRON_GPU_CACHE_DIR = path.join(DATA_DIR, 'gpu-cache');

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR) && fs.existsSync(LEGACY_DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
    for (const name of ['data.json', 'settings.json']) {
      const oldPath = path.join(LEGACY_DATA_DIR, name);
      const nextPath = path.join(DATA_DIR, name);
      if (fs.existsSync(oldPath) && !fs.existsSync(nextPath)) fs.copyFileSync(oldPath, nextPath);
    }
  }
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  for (const dir of [ELECTRON_USER_DATA_DIR, ELECTRON_CACHE_DIR, ELECTRON_GPU_CACHE_DIR]) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }
}

ensureDataDir();
app.setPath('userData', ELECTRON_USER_DATA_DIR);
app.setPath('sessionData', ELECTRON_CACHE_DIR);
app.commandLine.appendSwitch('disk-cache-dir', ELECTRON_CACHE_DIR);
app.commandLine.appendSwitch('gpu-cache-dir', ELECTRON_GPU_CACHE_DIR);

function ensureProjectsDir() {
  if (!fs.existsSync(PROJECTS_DIR) && fs.existsSync(LEGACY_PROJECTS_DIR)) {
    try {
      fs.renameSync(LEGACY_PROJECTS_DIR, PROJECTS_DIR);
    } catch (e) {
      // If migration is blocked, keep going with a fresh NevoProject folder.
    }
  }
  if (!fs.existsSync(PROJECTS_DIR)) fs.mkdirSync(PROJECTS_DIR, { recursive: true });
}

function sanitizeFolderName(name) {
  const cleaned = String(name || '')
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/[. ]+$/g, '');
  return cleaned || 'Untitled';
}

function getUniqueProjectFolderName(baseName, currentName = null) {
  const base = sanitizeFolderName(baseName);
  let candidate = base;
  let index = 2;
  while (
    fs.existsSync(path.join(PROJECTS_DIR, candidate)) &&
    candidate.toLowerCase() !== String(currentName || '').toLowerCase()
  ) {
    candidate = base === 'NevoProject' ? `${base}${index}` : `${base} ${index}`;
    index += 1;
  }
  return candidate;
}

function ensureProjectFolder(name, preferredFolderName = null) {
  ensureProjectsDir();
  const folderName = getUniqueProjectFolderName(preferredFolderName || name, preferredFolderName);
  const folderPath = path.join(PROJECTS_DIR, folderName);
  if (!fs.existsSync(folderPath)) fs.mkdirSync(folderPath, { recursive: true });
  return { folderName, path: folderPath };
}

function renameProjectFolder(oldFolderName, newName) {
  ensureProjectsDir();
  const oldName = sanitizeFolderName(oldFolderName);
  const nextName = getUniqueProjectFolderName(newName, oldName);
  const oldPath = path.join(PROJECTS_DIR, oldName);
  const nextPath = path.join(PROJECTS_DIR, nextName);

  if (oldName.toLowerCase() === nextName.toLowerCase()) {
    if (!fs.existsSync(nextPath)) fs.mkdirSync(nextPath, { recursive: true });
    return { folderName: nextName, path: nextPath };
  }

  if (fs.existsSync(oldPath)) {
    fs.renameSync(oldPath, nextPath);
    return { folderName: nextName, path: nextPath };
  }

  return ensureProjectFolder(newName, nextName);
}

function sanitizeRelativeFilePath(filePath) {
  const clean = String(filePath || 'main.txt')
    .replace(/\\/g, '/')
    .split('/')
    .map(part => sanitizeFolderName(part))
    .filter(Boolean)
    .join('/');
  return clean || 'main.txt';
}

function writeProjectFile(folderName, filePath, content) {
  const folder = ensureProjectFolder(folderName, folderName);
  const relativePath = sanitizeRelativeFilePath(filePath);
  const targetPath = path.resolve(folder.path, relativePath);
  const rootPath = path.resolve(folder.path);
  if (!targetPath.toLowerCase().startsWith(rootPath.toLowerCase() + path.sep) && targetPath.toLowerCase() !== rootPath.toLowerCase()) {
    throw new Error('Invalid project file path.');
  }
  const existed = fs.existsSync(targetPath);
  fs.mkdirSync(path.dirname(targetPath), { recursive: true });
  fs.writeFileSync(targetPath, String(content || ''), 'utf-8');
  return { folderName: folder.folderName, path: targetPath, existed };
}

function projectFileExists(folderName, filePath) {
  const folder = ensureProjectFolder(folderName, folderName);
  const relativePath = sanitizeRelativeFilePath(filePath);
  const targetPath = path.resolve(folder.path, relativePath);
  const rootPath = path.resolve(folder.path);
  if (!targetPath.toLowerCase().startsWith(rootPath.toLowerCase() + path.sep) && targetPath.toLowerCase() !== rootPath.toLowerCase()) {
    throw new Error('Invalid project file path.');
  }
  return { folderName: folder.folderName, path: targetPath, exists: fs.existsSync(targetPath) };
}

async function installPythonPackages(packages, folderName) {
  ensureProjectsDir();
  const safePackages = Array.from(new Set((packages || [])
    .map(pkg => String(pkg || '').trim())
    .filter(pkg => /^[a-zA-Z0-9_.-]+$/.test(pkg))));
  if (!safePackages.length) return { ok: true, packages: [] };

  const folder = ensureProjectFolder(folderName || 'NevoProject', folderName || 'NevoProject');
  const run = (command, args) => new Promise(resolve => {
    const child = spawn(command, args, {
      cwd: folder.path,
      windowsHide: true,
      shell: false
    });
    let output = '';
    child.stdout.on('data', data => { output += data.toString(); });
    child.stderr.on('data', data => { output += data.toString(); });
    child.on('error', err => resolve({ ok: false, error: err.message, output }));
    child.on('close', code => resolve({ ok: code === 0, code, output }));
  });

  const candidates = process.platform === 'win32'
    ? [['py', ['-m', 'pip', 'install']], ['python', ['-m', 'pip', 'install']], ['python3', ['-m', 'pip', 'install']]]
    : [['python3', ['-m', 'pip', 'install']], ['python', ['-m', 'pip', 'install']]];

  let last = null;
  for (const [command, baseArgs] of candidates) {
    const result = await run(command, [...baseArgs, ...safePackages]);
    if (result.ok) return { ok: true, packages: safePackages, output: result.output };
    last = result;
  }

  return {
    ok: false,
    packages: safePackages,
    output: last?.output || '',
    error: last?.error || `pip exited with code ${last?.code ?? 'unknown'}`
  };
}

async function installNodePackages(packages, folderName) {
  ensureProjectsDir();
  const safePackages = Array.from(new Set((packages || [])
    .map(pkg => String(pkg || '').trim())
    .filter(pkg => /^(?:@[a-zA-Z0-9_.-]+\/)?[a-zA-Z0-9_.-]+$/.test(pkg))));
  if (!safePackages.length) return { ok: true, packages: [] };

  const folder = ensureProjectFolder(folderName || 'NevoProject', folderName || 'NevoProject');
  const command = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return new Promise(resolve => {
    const child = spawn(command, ['install', ...safePackages], {
      cwd: folder.path,
      windowsHide: true,
      shell: false
    });
    let output = '';
    child.stdout.on('data', data => { output += data.toString(); });
    child.stderr.on('data', data => { output += data.toString(); });
    child.on('error', err => resolve({ ok: false, error: err.message, output }));
    child.on('close', code => {
      resolve(code === 0
        ? { ok: true, packages: safePackages, output }
        : { ok: false, packages: safePackages, output, error: `npm exited with code ${code}` });
    });
  });
}

// ============================================================
//  РҐСЂР°РЅРёР»РёС‰Рµ С‡Р°С‚РѕРІ / РіСЂСѓРїРї / РЅР°СЃС‚СЂРѕРµРє
// ============================================================
function loadData() {
  ensureDataDir();
  try {
    if (fs.existsSync(CHATS_FILE)) {
      return JSON.parse(fs.readFileSync(CHATS_FILE, 'utf-8'));
    }
  } catch (e) { /* corrupt вЂ” start fresh */ }
  return { groups: [], chats: [] };
}

function saveData(data) {
  ensureDataDir();
  try {
    fs.writeFileSync(CHATS_FILE, JSON.stringify(data, null, 2), 'utf-8');
  } catch (e) { /* ignore */ }
}

function loadSettings() {
  ensureDataDir();
  try {
    if (fs.existsSync(SETTINGS_FILE)) {
      return JSON.parse(fs.readFileSync(SETTINGS_FILE, 'utf-8'));
    }
  } catch (e) { /* ignore */ }
  return {};
}

function saveSettings(s) {
  ensureDataDir();
  try {
    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2), 'utf-8');
  } catch (e) { /* ignore */ }
}

// ============================================================
//  РћРєРЅРѕ
// ============================================================
function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 780,
    minWidth: 820,
    minHeight: 520,
    title: 'Nevo',
    icon: path.join(__dirname, '..', 'resources', process.platform === 'win32' ? 'nevo-logo.ico' : 'nevo-logo.png'),
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    },
    backgroundColor: '#0a0a0a',
    show: false
  });

  win.once('ready-to-show', () => { win.show(); win.focus(); });
  win.loadFile(path.join(__dirname, '..', 'index.html'));
  return win;
}

// ============================================================
//  РђРІС‚РѕР·Р°РїСѓСЃРє Ollama
// ============================================================
let ollamaProc = null;
let ollamaInstallState = {
  installing: false,
  installed: false,
  lastError: null
};

function bundledOllamaCandidates() {
  const roots = [
    path.join(__dirname, '..', 'resources', 'ollama'),
    path.join(process.resourcesPath || '', 'ollama')
  ];
  return roots
    .filter(Boolean)
    .flatMap(root => [
      path.join(root, process.platform === 'win32' ? 'ollama.exe' : 'ollama'),
      path.join(root, 'bin', process.platform === 'win32' ? 'ollama.exe' : 'ollama')
    ]);
}

function findOllamaExe() {
  // 1) bundled with Nevo
  for (const c of bundledOllamaCandidates()) {
    if (fs.existsSync(c)) return c;
  }

  // 2) РІ PATH
  try {
    const lookup = process.platform === 'win32' ? 'where ollama' : 'command -v ollama';
    const found = execSync(lookup, {
      stdio: ['ignore', 'pipe', 'ignore'],
      shell: process.platform !== 'win32'
    })
      .toString().trim().split(/\r?\n/)[0];
    if (found && fs.existsSync(found)) return found;
  } catch (e) { /* not in PATH */ }

  // 3) С‚РёРїРёС‡РЅС‹Рµ СЂР°СЃРїРѕР»РѕР¶РµРЅРёСЏ РЅР° Windows
  const candidates = [
    path.join(os.homedir(), 'AppData', 'Local', 'Programs', 'Ollama', 'ollama.exe'),
    'C:\\Program Files\\Ollama\\ollama.exe',
    '/usr/local/bin/ollama',
    '/usr/bin/ollama',
    '/opt/homebrew/bin/ollama'
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function installOllamaWindows() {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') {
      resolve(false);
      return;
    }

    if (ollamaInstallState.installing) {
      const timer = setInterval(() => {
        if (!ollamaInstallState.installing) {
          clearInterval(timer);
          resolve(!!findOllamaExe());
        }
      }, 1000);
      return;
    }

    ollamaInstallState = { installing: true, installed: false, lastError: null };
    const ps = spawn('powershell.exe', [
      '-NoProfile',
      '-ExecutionPolicy', 'Bypass',
      '-Command',
      `irm ${OLLAMA_WINDOWS_INSTALL_URL} | iex`
    ], {
      windowsHide: true,
      stdio: 'ignore'
    });

    ps.on('error', (err) => {
      ollamaInstallState = { installing: false, installed: false, lastError: err.message };
      resolve(false);
    });

    ps.on('exit', () => {
      const installed = !!findOllamaExe();
      ollamaInstallState = {
        installing: false,
        installed,
        lastError: installed ? null : 'Ollama installer finished, but ollama.exe was not found.'
      };
      resolve(installed);
    });
  });
}

function installOllamaLinux() {
  return new Promise((resolve) => {
    if (process.platform !== 'linux') {
      resolve(false);
      return;
    }

    if (ollamaInstallState.installing) {
      const timer = setInterval(() => {
        if (!ollamaInstallState.installing) {
          clearInterval(timer);
          resolve(!!findOllamaExe());
        }
      }, 1000);
      return;
    }

    ollamaInstallState = { installing: true, installed: false, lastError: null };
    const child = spawn('sh', ['-c', `curl -fsSL ${OLLAMA_LINUX_INSTALL_URL} | sh`], {
      windowsHide: true,
      stdio: 'ignore'
    });

    child.on('error', (err) => {
      ollamaInstallState = { installing: false, installed: false, lastError: err.message };
      resolve(false);
    });

    child.on('exit', () => {
      const installed = !!findOllamaExe();
      ollamaInstallState = {
        installing: false,
        installed,
        lastError: installed ? null : 'Ollama installer finished, but ollama was not found.'
      };
      resolve(installed);
    });
  });
}

async function installOllamaForPlatform() {
  if (process.platform === 'win32') return installOllamaWindows();
  if (process.platform === 'linux') return installOllamaLinux();
  if (process.platform === 'darwin') {
    ollamaInstallState.lastError = 'Install Ollama for macOS from https://ollama.com/download';
    shell.openExternal('https://ollama.com/download');
  }
  return false;
}

function isOllamaResponding() {
  return new Promise((resolve) => {
    const http = require('http');
    const req = http.get(`${OLLAMA_HOST}/api/tags`, (res) => {
      res.resume();
      resolve(res.statusCode === 200);
    });
    req.on('error', () => resolve(false));
    req.setTimeout(1500, () => { req.destroy(); resolve(false); });
  });
}

async function ensureOllamaRunning() {
  // РЈР¶Рµ Р·Р°РїСѓС‰РµРЅ?
  if (await isOllamaResponding()) return true;

  let exe = findOllamaExe();
  if (!exe) {
    const installed = await installOllamaForPlatform();
    if (installed) exe = findOllamaExe();
  }
  if (!exe) return false;

  const savedSettings = loadSettings();
  const computeMode = savedSettings.computeMode || 'auto';
  const ollamaEnv = {
    ...process.env,
    OLLAMA_HOST: '127.0.0.1:11434',
    OLLAMA_FLASH_ATTENTION: process.env.OLLAMA_FLASH_ATTENTION || '1',
    OLLAMA_KEEP_ALIVE: process.env.OLLAMA_KEEP_ALIVE || '10m'
  };
  if (computeMode === 'cpu') {
    ollamaEnv.OLLAMA_LLM_LIBRARY = 'cpu';
    ollamaEnv.CUDA_VISIBLE_DEVICES = '';
  } else if (computeMode === 'gpu') {
    delete ollamaEnv.OLLAMA_LLM_LIBRARY;
  }

  // Р—Р°РїСѓСЃРєР°РµРј ollama serve
  try {
    ollamaProc = spawn(exe, ['serve'], {
      windowsHide: true,
      detached: true,
      stdio: 'ignore',
      env: ollamaEnv
    });
    ollamaProc.unref();
  } catch (e) {
    return false;
  }

  // Р–РґС‘Рј РіРѕС‚РѕРІРЅРѕСЃС‚Рё (РґРѕ ~30 СЃРµРєСѓРЅРґ)
  for (let i = 0; i < 60; i++) {
    await new Promise(r => setTimeout(r, 500));
    if (await isOllamaResponding()) return true;
  }
  return false;
}

app.whenReady().then(async () => {
  ensureDataDir();
  createWindow();
  ensureOllamaRunning();   // С„РѕРЅРѕРІР°СЏ РїРѕРїС‹С‚РєР° Р°РІС‚РѕР·Р°РїСѓСЃРєР° / Р°РІС‚РѕСѓСЃС‚Р°РЅРѕРІРєРё
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

// ============================================================
//  IPC: Р§РђРўР« / Р“Р РЈРџРџР«
// ============================================================
ipcMain.handle('data:get', async () => {
  return loadData();
});

ipcMain.handle('data:save', async (_e, data) => {
  saveData(data);
  return { ok: true };
});

// ============================================================
//  IPC: РќРђРЎРўР РћР™РљР
// ============================================================
ipcMain.handle('settings:get', async () => loadSettings());
ipcMain.handle('settings:save', async (_e, s) => { saveSettings(s); return { ok: true }; });

// ============================================================
//  IPC: OLLAMA
// ============================================================
ipcMain.handle('ollama:status', async () => {
  try {
    const resp = await fetch(`${OLLAMA_HOST}/api/tags`);
    if (!resp.ok) return {
      ok: false,
      running: false,
      installing: ollamaInstallState.installing,
      installed: !!findOllamaExe(),
      installError: ollamaInstallState.lastError
    };
    const data = await resp.json();
    return {
      ok: true,
      running: true,
      installing: ollamaInstallState.installing,
      installed: !!findOllamaExe(),
      host: OLLAMA_HOST,
      models: (data.models || []).map(m => ({
        name: m.name,
        size: m.size || 0,
        details: m.details || {}
      }))
    };
  } catch (e) {
    return {
      ok: false,
      running: false,
      installing: ollamaInstallState.installing,
      installed: !!findOllamaExe(),
      installError: ollamaInstallState.lastError,
      error: e.message
    };
  }
});

ipcMain.handle('ollama:ensure-running', async () => {
  const ok = await ensureOllamaRunning();
  return { ok, running: ok };
});

// РЎРєР°С‡Р°С‚СЊ РјРѕРґРµР»СЊ СЃ РїСЂРѕРіСЂРµСЃСЃРѕРј
ipcMain.handle('ollama:pull', async (event, modelName) => {
  try {
    const response = await fetch(`${OLLAMA_HOST}/api/pull`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName })
    });

    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const reader = response.body.getReader();
    const dec = new TextDecoder();
    let lastPercent = -1;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const text = dec.decode(value, { stream: true });
      const lines = text.split('\n').filter(l => l.trim());
      for (const line of lines) {
        try {
          const json = JSON.parse(line);
          const status = json.status || '';
          const completed = json.completed || 0;
          const total = json.total || 0;
          const percent = total > 0 ? Math.round((completed / total) * 100) : 0;

          // РЁР»С‘Рј РїСЂРѕРіСЂРµСЃСЃ С‚РѕР»СЊРєРѕ РєРѕРіРґР° РѕРЅ РјРµРЅСЏРµС‚СЃСЏ
          if (percent !== lastPercent || status.includes('success') || status.includes('verifying')) {
            if (event.sender.isDestroyed && event.sender.isDestroyed()) return { ok: true };
            event.sender.send('pull-progress', {
              model: modelName,
              status,
              percent,
              completed,
              total
            });
            lastPercent = percent;
          }
        } catch (e) { /* partial json */ }
      }
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// РЈРґР°Р»РёС‚СЊ РјРѕРґРµР»СЊ
ipcMain.handle('ollama:delete', async (_e, modelName) => {
  try {
    const resp = await fetch(`${OLLAMA_HOST}/api/delete`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: modelName })
    });
    if (!resp.ok) {
      const error = await resp.text().catch(() => '');
      return { ok: false, error: error || `HTTP ${resp.status}` };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

// РџСѓС‚СЊ Рє ollama.exe (РґР»СЏ РїРѕРґСЃРєР°Р·РѕРє РІ UI)
ipcMain.handle('node:install-packages', async (_e, packages, folderName) => {
  try {
    return await installNodePackages(packages, folderName);
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('ollama:path', async () => findOllamaExe());

// РћС‚РєСЂС‹С‚СЊ СЃСЃС‹Р»РєСѓ РІРѕ РІРЅРµС€РЅРµРј Р±СЂР°СѓР·РµСЂРµ
ipcMain.handle('shell:open', async (_e, url) => {
  shell.openExternal(url);
  return { ok: true };
});

ipcMain.handle('projects:open-folder', async () => {
  try {
    ensureProjectsDir();
    const error = await shell.openPath(PROJECTS_DIR);
    return { ok: !error, path: PROJECTS_DIR, error };
  } catch (err) {
    return { ok: false, path: PROJECTS_DIR, error: err.message };
  }
});

ipcMain.handle('projects:get-root', async () => {
  ensureProjectsDir();
  return { ok: true, path: PROJECTS_DIR };
});

ipcMain.handle('projects:ensure-folder', async (_e, name, preferredFolderName = null) => {
  try {
    const folder = ensureProjectFolder(name, preferredFolderName);
    return { ok: true, ...folder };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('projects:rename-folder', async (_e, oldFolderName, newName) => {
  try {
    const folder = renameProjectFolder(oldFolderName, newName);
    return { ok: true, ...folder };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('projects:write-file', async (_e, folderName, filePath, content) => {
  try {
    const file = writeProjectFile(folderName, filePath, content);
    return { ok: true, ...file };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('projects:file-exists', async (_e, folderName, filePath) => {
  try {
    const file = projectFileExists(folderName, filePath);
    return { ok: true, ...file };
  } catch (err) {
    return { ok: false, error: err.message };
  }
});

ipcMain.handle('python:install-packages', async (_e, packages, folderName) => {
  try {
    return await installPythonPackages(packages, folderName);
  } catch (err) {
    return { ok: false, error: err.message };
  }
});
