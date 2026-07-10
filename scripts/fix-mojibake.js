const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const WRITE = process.argv.includes('--write');
const INCLUDED_EXTENSIONS = new Set(['.js', '.css', '.html', '.md', '.cmd', '.vbs', '.py', '.json']);
const EXCLUDED_DIRECTORIES = new Set(['.git', 'node_modules', 'dist']);
const SELF = path.resolve(__filename);

const cp1251Decoder = new TextDecoder('windows-1251');
const utf8Decoder = new TextDecoder('utf-8', { fatal: true });
const cp1251Bytes = new Map();

for (let byte = 0; byte <= 255; byte += 1) {
  const character = cp1251Decoder.decode(Uint8Array.of(byte));
  if (character !== '\uFFFD') cp1251Bytes.set(character, byte);
}

function suspiciousScore(text) {
  const cyrillicLeads = text.match(/[\u0420\u0421][^\x00-\x7F]/g)?.length || 0;
  const punctuationLeads = text.match(/[\u0432\u0412][^\x00-\x7F]/g)?.length || 0;
  return cyrillicLeads * 2 + punctuationLeads;
}

function decodeCp1251AsUtf8(text) {
  const bytes = [];
  for (const character of text) {
    const code = character.codePointAt(0);
    if (code <= 0x7f) {
      bytes.push(code);
      continue;
    }
    const byte = cp1251Bytes.get(character);
    if (byte === undefined) return null;
    bytes.push(byte);
  }
  try {
    return utf8Decoder.decode(Uint8Array.from(bytes));
  } catch (error) {
    return null;
  }
}

function repairRun(run) {
  let current = run;
  for (let pass = 0; pass < 4; pass += 1) {
    if (suspiciousScore(current) === 0) break;
    const decoded = decodeCp1251AsUtf8(current);
    if (!decoded || decoded === current) break;
    const scoreImproved = suspiciousScore(decoded) < suspiciousScore(current);
    const becameShorter = decoded.length < current.length && /[\u0420\u0421\u0432\u0412]/.test(current);
    if (!scoreImproved && !becameShorter) break;
    current = decoded;
  }
  return current;
}

function repairText(text) {
  return text.replace(/[^\x00-\x7F]+/g, repairRun);
}

function collectFiles(directory, output = []) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if (entry.isDirectory() && EXCLUDED_DIRECTORIES.has(entry.name)) continue;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) collectFiles(fullPath, output);
    else if (fullPath !== SELF && INCLUDED_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) output.push(fullPath);
  }
  return output;
}

let changedFiles = 0;
let changedLines = 0;
for (const file of collectFiles(ROOT)) {
  const before = fs.readFileSync(file, 'utf8');
  const after = repairText(before);
  if (after === before) continue;
  const beforeLines = before.split(/\r?\n/);
  const afterLines = after.split(/\r?\n/);
  const lineCount = beforeLines.reduce((count, line, index) => count + (line !== afterLines[index] ? 1 : 0), 0);
  changedFiles += 1;
  changedLines += lineCount;
  console.log(`${path.relative(ROOT, file)}: ${lineCount} line(s)`);
  if (WRITE) fs.writeFileSync(file, after, 'utf8');
}

console.log(`${WRITE ? 'Repaired' : 'Would repair'} ${changedLines} line(s) in ${changedFiles} file(s).`);
