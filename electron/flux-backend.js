const fs = require('fs');
const path = require('path');
const https = require('https');
const { spawn } = require('child_process');
const { detectVram } = require('./gpu-detect');

const FLUX_VARIANTS = [
  {
    id: 'fp16',
    label: 'FP16',
    name: 'flux1-schnell',
    quality: 'Full quality',
    requiredVramGb: 24,
    sizeLabel: '~24 GB',
    fileName: 'flux1-schnell.safetensors',
    url: 'https://huggingface.co/Comfy-Org/flux1-schnell/resolve/main/flux1-schnell.safetensors'
  },
  {
    id: 'fp8',
    label: 'FP8',
    name: 'flux1-schnell-fp8',
    quality: 'Minimal quality loss',
    requiredVramGb: 12,
    sizeLabel: '~12 GB',
    fileName: 'flux1-schnell-fp8.safetensors',
    url: 'https://huggingface.co/Comfy-Org/flux1-schnell/resolve/main/flux1-schnell-fp8.safetensors'
  },
  {
    id: 'nf4',
    label: 'NF4',
    name: 'flux1-schnell-bnb-nf4',
    quality: 'Lower detail, low VRAM',
    requiredVramGb: 6,
    sizeLabel: '~6 GB',
    fileName: 'flux1-schnell-bnb-nf4.safetensors',
    url: 'https://huggingface.co/eridgd/flux.1-schnell-nf4/resolve/main/diffusion_pytorch_model.safetensors'
  }
];

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function getVariant(id) {
  return FLUX_VARIANTS.find(variant => variant.id === id) || null;
}

function selectFluxVariant(vramGb) {
  if (typeof vramGb !== 'number' || !Number.isFinite(vramGb)) return null;
  if (vramGb >= 24) return getVariant('fp16');
  if (vramGb >= 12) return getVariant('fp8');
  if (vramGb >= 6) return getVariant('nf4');
  return null;
}

function modelPath(modelsDir, variant) {
  return path.join(modelsDir, variant.fileName);
}

async function getFluxStatus(modelsDir) {
  ensureDir(modelsDir);
  const gpu = await detectVram();
  const recommended = gpu.known ? selectFluxVariant(gpu.vramGb) : null;
  const variants = FLUX_VARIANTS.map(variant => {
    const filePath = modelPath(modelsDir, variant);
    const installed = fs.existsSync(filePath);
    return Object.assign({}, variant, {
      path: filePath,
      installed,
      bytes: installed ? fs.statSync(filePath).size : 0
    });
  });

  return {
    ok: true,
    gpu,
    recommendedId: recommended ? recommended.id : null,
    insufficient: gpu.known && !recommended,
    variants
  };
}

function requestWithRedirect(url, onResponse, redirects = 0) {
  return https.get(url, { headers: { 'User-Agent': 'Nevo' } }, response => {
    if ([301, 302, 303, 307, 308].includes(response.statusCode) && response.headers.location && redirects < 5) {
      response.resume();
      return requestWithRedirect(new URL(response.headers.location, url).toString(), onResponse, redirects + 1);
    }
    onResponse(response);
  });
}

function downloadFluxVariant(modelsDir, variantId, onProgress) {
  const variant = getVariant(variantId);
  if (!variant) return Promise.resolve({ ok: false, error: 'Unknown Flux variant.' });
  ensureDir(modelsDir);

  const target = modelPath(modelsDir, variant);
  const temp = `${target}.download`;
  if (fs.existsSync(target)) return Promise.resolve({ ok: true, variantId, path: target, alreadyInstalled: true });

  return new Promise(resolve => {
    const req = requestWithRedirect(variant.url, response => {
      if (response.statusCode < 200 || response.statusCode >= 300) {
        response.resume();
        resolve({ ok: false, error: `HTTP ${response.statusCode}` });
        return;
      }

      const total = Number(response.headers['content-length'] || 0);
      let completed = 0;
      let lastPercent = -1;
      const out = fs.createWriteStream(temp);

      response.on('data', chunk => {
        completed += chunk.length;
        const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
        if (percent !== lastPercent) {
          onProgress?.({ variantId, model: variant.name, percent, completed, total, status: 'downloading' });
          lastPercent = percent;
        }
      });

      response.pipe(out);
      out.on('finish', () => {
        out.close(() => {
          fs.renameSync(temp, target);
          onProgress?.({ variantId, model: variant.name, percent: 100, completed, total, status: 'done' });
          resolve({ ok: true, variantId, path: target });
        });
      });
      out.on('error', err => {
        try { fs.unlinkSync(temp); } catch (e) { /* ignore */ }
        resolve({ ok: false, error: err.message });
      });
    });

    req.on('error', err => {
      try { fs.unlinkSync(temp); } catch (e) { /* ignore */ }
      resolve({ ok: false, error: err.message });
    });
  });
}

function runFluxGenerate({ modelsDir, outputDir, prompt, variantId, computeMode = 'auto', onProgress }) {
  const variant = getVariant(variantId);
  if (!variant) return Promise.resolve({ ok: false, error: 'Unknown Flux variant.' });
  const model = modelPath(modelsDir, variant);
  if (!fs.existsSync(model)) return Promise.resolve({ ok: false, error: 'Flux model is not downloaded.' });
  ensureDir(outputDir);

  const script = path.join(__dirname, '..', 'scripts', 'flux_generate.py');
  const output = path.join(outputDir, `flux-${Date.now()}.png`);
  const candidates = process.platform === 'win32' ? ['py', 'python', 'python3'] : ['python3', 'python'];

  const parseLastJson = text => {
    try {
      return JSON.parse(String(text || '').trim().split(/\r?\n/).pop() || '{}');
    } catch (err) {
      return null;
    }
  };

  return new Promise(resolve => {
    let index = 0;
    const attempts = [];
    const runNext = () => {
      const command = candidates[index++];
      if (!command) {
        resolve({
          ok: false,
          error: 'Python was not found.',
          attempts
        });
        return;
      }

      const args = command === 'py'
        ? ['-3', script, '--model', model, '--cache-dir', modelsDir, '--prompt', prompt, '--output', output, '--variant', variant.id, '--compute', computeMode]
        : [script, '--model', model, '--cache-dir', modelsDir, '--prompt', prompt, '--output', output, '--variant', variant.id, '--compute', computeMode];

      const child = spawn(command, args, { windowsHide: true, shell: false });
      let stdout = '';
      let stderr = '';
      let settled = false;
      const timeout = setTimeout(() => {
        if (settled) return;
        settled = true;
        try { child.kill(); } catch (e) { /* ignore */ }
        resolve({
          ok: false,
          error: 'Flux generation timed out. First launch can take a long time while downloading or loading the model.',
          stdout,
          stderr
        });
      }, 45 * 60 * 1000);
      const finish = value => {
        if (settled) return;
        settled = true;
        clearTimeout(timeout);
        resolve(value);
      };
      const handleStdout = text => {
        stdout += text;
        for (const line of String(text || '').split(/\r?\n/)) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const json = JSON.parse(trimmed);
            if (json && json.ok === null && json.stage) {
              onProgress?.({ variantId, stage: json.stage, message: json.message || json.stage });
            }
          } catch (err) {
            // Non-JSON output from Python libraries is kept in stdout for debugging.
          }
        }
      };
      child.stdout.on('data', data => { handleStdout(data.toString()); });
      child.stderr.on('data', data => { stderr += data.toString(); });
      child.on('error', err => {
        if (settled) return;
        attempts.push({ command, error: err.message });
        settled = true;
        clearTimeout(timeout);
        runNext();
      });
      child.on('close', code => {
        if (settled) return;
        const json = parseLastJson(stdout);
        if (json && json.ok === false) {
          finish({ ok: false, error: json.error || 'Flux generation failed.', stdout, stderr });
          return;
        }
        if (code !== 0) {
          attempts.push({ command, code, stderr, stdout });
          if (index < candidates.length) {
            settled = true;
            clearTimeout(timeout);
            runNext();
          } else {
            finish({ ok: false, error: stderr || `Python exited with code ${code}` });
          }
          return;
        }
        if (json) {
          finish(Object.assign({ ok: true, path: output }, json));
        } else {
          finish({ ok: fs.existsSync(output), path: output, stdout, error: fs.existsSync(output) ? null : 'Flux did not return a result.' });
        }
      });
    };
    runNext();
  });
}

module.exports = {
  FLUX_VARIANTS,
  getFluxStatus,
  downloadFluxVariant,
  runFluxGenerate
};
