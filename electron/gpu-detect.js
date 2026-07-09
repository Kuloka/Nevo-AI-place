const { exec } = require('child_process');
const os = require('os');

function execText(command) {
  return new Promise(resolve => {
    exec(command, { windowsHide: true, timeout: 8000 }, (error, stdout) => {
      if (error) {
        resolve({ ok: false, error: error.message, stdout: stdout || '' });
        return;
      }
      resolve({ ok: true, stdout: stdout || '' });
    });
  });
}

function parseLargestNumber(text) {
  const values = String(text || '')
    .split(/\r?\n/)
    .map(line => Number(String(line).replace(/[^\d.]/g, '')))
    .filter(value => Number.isFinite(value) && value > 0);
  return values.length ? Math.max(...values) : null;
}

async function detectNvidiaVram() {
  const result = await execText('nvidia-smi --query-gpu=memory.total --format=csv,noheader,nounits');
  if (!result.ok) return null;
  const mb = parseLargestNumber(result.stdout);
  if (!mb) return null;
  return {
    source: 'nvidia-smi',
    vramMb: Math.round(mb),
    vramGb: Math.round((mb / 1024) * 10) / 10
  };
}

async function detectWindowsAdapterRam() {
  if (process.platform !== 'win32') return null;
  const result = await execText('wmic path win32_VideoController get AdapterRAM');
  if (!result.ok) return null;
  const bytes = parseLargestNumber(result.stdout);
  if (!bytes) return null;
  return {
    source: 'wmic',
    vramMb: Math.round(bytes / 1024 / 1024),
    vramGb: Math.round((bytes / 1024 / 1024 / 1024) * 10) / 10
  };
}

async function detectVram() {
  try {
    const nvidia = await detectNvidiaVram();
    if (nvidia) return Object.assign({ ok: true, known: true }, nvidia);

    const windows = await detectWindowsAdapterRam();
    if (windows) return Object.assign({ ok: true, known: true }, windows);
  } catch (err) {
    return { ok: false, known: false, error: err.message, platform: os.platform() };
  }

  return { ok: true, known: false, vramMb: null, vramGb: null, source: null, platform: os.platform() };
}

module.exports = { detectVram };
