#!/usr/bin/env node

/**
 * Starbucks Operations Suite — Błyskawiczny Publikator Hot-Patch OTA
 * Buduje wyłącznie kod aplikacji (dist/ + dist-electron/) i publikuje mikropatch ~1.5 MB na GitHub w ~3 sekundy.
 */

import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import https from 'https';
import crypto from 'crypto';

const ROOT_DIR = path.resolve(import.meta.dirname, '..');

// 1. Wczytaj poświadczenia z .env
const envPath = path.join(ROOT_DIR, '.env');
let GH_TOKEN = process.env.GH_TOKEN;

if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (trimmed.startsWith('GH_TOKEN=')) {
      GH_TOKEN = trimmed.replace('GH_TOKEN=', '').trim().replace(/^["']|["']$/g, '');
    }
  }
}

if (!GH_TOKEN) {
  console.error('❌ Błąd: Brak tokena GH_TOKEN w środowisku ani w pliku .env.');
  process.exit(1);
}

const startTime = Date.now();
const noBump = process.argv.includes('--no-bump');

// 2. Wczytaj package.json i podbij wersję patch
const pkgPath = path.join(ROOT_DIR, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

const currentVer = pkg.version;
let newVersion = currentVer;

if (!noBump) {
  const verParts = currentVer.split('.').map(Number);
  verParts[2] = (verParts[2] || 0) + 1;
  newVersion = verParts.join('.');
  pkg.version = newVersion;
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');
  console.log(`\n📦 [Hot-Patch] Podbito wersję: v${currentVer} ➔ v${newVersion}`);
} else {
  console.log(`\n📦 [Hot-Patch] Publikacja bieżącej wersji bez podbijania: v${newVersion}`);
}

// 3. Zbuduj czysty kod źródłowy (TypeScript + Vite)
console.log('⚡ [Hot-Patch] Kompilacja kodu aplikacji (tsc && vite build)...');
execSync('npm run build', { cwd: ROOT_DIR, stdio: 'inherit' });

// 4. Utwórz app.asar i paczkę ZIP
const releaseDir = path.join(ROOT_DIR, 'release');
const patchTempDir = path.join(releaseDir, `patch_temp_${Date.now()}`);
const asarTempDir = path.join(releaseDir, `asar_temp_${Date.now()}`);
const zipFileName = `sos-patch-${newVersion}.zip`;
const zipFilePath = path.join(releaseDir, zipFileName);

if (fs.existsSync(zipFilePath)) fs.unlinkSync(zipFilePath);
if (fs.existsSync(patchTempDir)) fs.rmSync(patchTempDir, { recursive: true, force: true });
if (fs.existsSync(asarTempDir)) fs.rmSync(asarTempDir, { recursive: true, force: true });

fs.mkdirSync(patchTempDir, { recursive: true });
fs.mkdirSync(asarTempDir, { recursive: true });

// Kopiuj pliki wykonywalne aplikacji do asarTempDir
execSync(`cp -R "${path.join(ROOT_DIR, 'dist')}" "${asarTempDir}/dist"`);
execSync(`cp -R "${path.join(ROOT_DIR, 'dist-electron')}" "${asarTempDir}/dist-electron"`);
execSync(`cp "${path.join(ROOT_DIR, 'package.json')}" "${asarTempDir}/package.json"`);

// Kopiuj moduły node_modules wymagane w procesie głównym Electrona
fs.mkdirSync(path.join(asarTempDir, 'node_modules'), { recursive: true });
if (fs.existsSync(path.join(ROOT_DIR, 'node_modules', 'sql.js'))) {
  execSync(`cp -R "${path.join(ROOT_DIR, 'node_modules', 'sql.js')}" "${path.join(asarTempDir, 'node_modules', 'sql.js')}"`);
}
if (fs.existsSync(path.join(ROOT_DIR, 'node_modules', 'xlsx'))) {
  execSync(`cp -R "${path.join(ROOT_DIR, 'node_modules', 'xlsx')}" "${path.join(asarTempDir, 'node_modules', 'xlsx')}"`);
}

// Spakuj app.asar za pomocą @electron/asar do release/app.asar
console.log(`📦 [Hot-Patch] Tworzenie kompletnego mikropakietu app.asar z modułami sql.js i xlsx...`);
const asarFilePath = path.join(releaseDir, 'app.asar');
if (fs.existsSync(asarFilePath)) fs.unlinkSync(asarFilePath);
execSync(`npx @electron/asar pack "${asarTempDir}" "${asarFilePath}"`);

// Kopiuj do patchTempDir
execSync(`cp "${asarFilePath}" "${patchTempDir}/app.asar"`);
execSync(`cp -R "${asarTempDir}/dist" "${patchTempDir}/dist"`);
execSync(`cp -R "${asarTempDir}/dist-electron" "${patchTempDir}/dist-electron"`);
execSync(`cp -R "${asarTempDir}/node_modules" "${patchTempDir}/node_modules"`);
execSync(`cp "${asarTempDir}/package.json" "${patchTempDir}/package.json"`);

// Spakuj ZIP
console.log(`📦 [Hot-Patch] Pakowanie mikropaczki ${zipFileName}...`);
execSync(`cd "${patchTempDir}" && zip -r -q "${zipFilePath}" .`);

// Sprzątanie katalogów tymczasowych
fs.rmSync(patchTempDir, { recursive: true, force: true });
fs.rmSync(asarTempDir, { recursive: true, force: true });

const zipStats = fs.statSync(zipFilePath);
const sizeMB = (zipStats.size / (1024 * 1024)).toFixed(2);
const fileBuffer = fs.readFileSync(zipFilePath);
const sha256Hash = crypto.createHash('sha256').update(fileBuffer).digest('hex');

console.log(`✅ [Hot-Patch] Utworzono mikropatch: ${zipFileName} (${sizeMB} MB, SHA256: ${sha256Hash.slice(0, 10)}...)`);

// 5. Pomocnicze funkcje GitHub API
async function githubRequest(method, endpoint, body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const defaultHeaders = {
      'User-Agent': 'Starbucks-Operations-Suite-Patch-Publisher',
      'Authorization': `token ${GH_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      ...headers
    };

    const isUpload = endpoint.startsWith('https://uploads.github.com');
    const urlObj = isUpload ? new URL(endpoint) : new URL(`https://api.github.com${endpoint}`);

    const req = https.request({
      hostname: urlObj.hostname,
      path: urlObj.pathname + urlObj.search,
      method,
      headers: defaultHeaders
    }, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          try {
            resolve(JSON.parse(data || '{}'));
          } catch (_) {
            resolve(data);
          }
        } else {
          reject(new Error(`GitHub API Error ${res.statusCode}: ${data}`));
        }
      });
    });

    req.on('error', reject);
    if (body) {
      if (Buffer.isBuffer(body)) {
        req.write(body);
      } else {
        req.write(typeof body === 'string' ? body : JSON.stringify(body));
      }
    }
    req.end();
  });
}

async function uploadAsset(uploadUrlTemplate, fileName, fileBuf, contentType = 'application/octet-stream') {
  const uploadUrl = uploadUrlTemplate.replace(/\{(\?name,label)?\}/, '') + `?name=${encodeURIComponent(fileName)}`;
  return githubRequest('POST', uploadUrl, fileBuf, {
    'Content-Type': contentType,
    'Content-Length': fileBuf.length
  });
}

// 6. Publikacja na GitHub Releases
async function publishToGitHub() {
  console.log(`🚀 [Hot-Patch] Tworzenie wydania v${newVersion} na GitHubie...`);

  // Utwórz lub zaktualizuj tag w gicie
  try {
    execSync(`git add -A && git commit -m "feat(patch): v${newVersion} - Hot-Patch OTA: UI Zoom & SQLite Health" && git tag -f v${newVersion}`, { cwd: ROOT_DIR, stdio: 'pipe' });
    execSync(`git push https://x-access-token:${GH_TOKEN}@github.com/apeldawid-hub/COL-TOOL.git main --tags -f`, { cwd: ROOT_DIR, stdio: 'pipe' });
  } catch (gitErr) {
    console.warn('⚠️ Git push warning (kontynuuję publikację release przez API):', gitErr.message);
  }

  // Utwórz release
  const releaseData = {
    tag_name: `v${newVersion}`,
    target_commitish: 'main',
    name: `Starbucks Operations Suite v${newVersion} (Hot-Patch)`,
    body: `⚡ Błyskawiczny patch OTA v${newVersion}\n- Rozmiar: ${sizeMB} MB\n- Suma SHA256: \`${sha256Hash}\`\n- Automatyczna instalacja w programie bez restartu binarki.`,
    draft: false,
    prerelease: false,
    make_latest: 'true'
  };

  let release;
  try {
    release = await githubRequest('POST', '/repos/apeldawid-hub/COL-TOOL/releases', releaseData);
  } catch (err) {
    // Jeśli release istnieje, pobierz go
    const existing = await githubRequest('GET', `/repos/apeldawid-hub/COL-TOOL/releases/tags/v${newVersion}`);
    release = existing;
  }

  console.log(`📤 [Hot-Patch] Wysyłanie ${zipFileName} (${sizeMB} MB)...`);
  await uploadAsset(release.upload_url, zipFileName, fileBuffer, 'application/zip');

  // Przygotuj manifest latest-patch.json
  const patchManifest = {
    version: newVersion,
    releaseDate: new Date().toISOString(),
    patchUrl: `https://github.com/apeldawid-hub/COL-TOOL/releases/download/v${newVersion}/${zipFileName}`,
    zipName: zipFileName,
    sha256: sha256Hash,
    sizeMB: parseFloat(sizeMB),
    isPatch: true
  };

  const manifestBuf = Buffer.from(JSON.stringify(patchManifest, null, 2), 'utf8');
  console.log('📤 [Hot-Patch] Wysyłanie latest-patch.json...');
  await uploadAsset(release.upload_url, 'latest-patch.json', manifestBuf, 'application/json');

  // Upewnij się, że wydanie jest publiczne
  await githubRequest('PATCH', `/repos/apeldawid-hub/COL-TOOL/releases/${release.id}`, {
    draft: false,
    make_latest: 'true'
  });

  const elapsedSec = ((Date.now() - startTime) / 1000).toFixed(1);
  console.log(`\n🎉 [Hot-Patch] SUKCES! Patch v${newVersion} został opublikowany w ${elapsedSec}s!`);
  console.log(`🔗 Link: https://github.com/apeldawid-hub/COL-TOOL/releases/tag/v${newVersion}\n`);
}

publishToGitHub().catch(err => {
  console.error('❌ Błąd publikacji patcha:', err);
  process.exit(1);
});
