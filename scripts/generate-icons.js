import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const buildDir = path.resolve('build');
if (!fs.existsSync(buildDir)) {
  fs.mkdirSync(buildDir, { recursive: true });
}

const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <!-- Background Gradient (Starbucks Signature Green to Deep Emerald) -->
    <linearGradient id="macBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#1E3932"/>
      <stop offset="50%" stop-color="#006241"/>
      <stop offset="100%" stop-color="#004D33"/>
    </linearGradient>

    <!-- Gold Accent Gradient -->
    <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#F2D888"/>
      <stop offset="50%" stop-color="#CBA258"/>
      <stop offset="100%" stop-color="#9E762E"/>
    </linearGradient>

    <!-- Drop Shadow for Siren Emblem -->
    <filter id="dropShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="16" stdDeviation="24" flood-color="#000000" flood-opacity="0.45"/>
    </filter>

    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="6" result="blur"/>
      <feComposite in="SourceGraphic" in2="blur" operator="over"/>
    </filter>
  </defs>

  <!-- macOS Squircle Application Base (macOS Big Sur+ Icon Standard) -->
  <rect x="32" y="32" width="960" height="960" rx="214" fill="url(#macBg)" stroke="rgba(255,255,255,0.18)" stroke-width="4" filter="url(#dropShadow)"/>

  <!-- Subtle Inner Specular Rim -->
  <rect x="36" y="36" width="952" height="952" rx="210" fill="none" stroke="url(#goldGradient)" stroke-width="3" opacity="0.4"/>

  <!-- Outer Starbucks Medallion Ring -->
  <circle cx="512" cy="512" r="390" fill="none" stroke="url(#goldGradient)" stroke-width="14" filter="url(#glow)"/>
  <circle cx="512" cy="512" r="374" fill="#006241" stroke="#ffffff" stroke-width="6"/>

  <!-- Inner Siren Circle -->
  <circle cx="512" cy="512" r="330" fill="#1E3932" stroke="rgba(255,255,255,0.3)" stroke-width="4"/>

  <!-- Center Siren Crown / Star (Starbucks Signature) -->
  <g fill="#ffffff">
    <!-- Center Star in Crown -->
    <polygon points="512,250 534,316 604,316 548,358 569,424 512,382 455,424 476,358 420,316 490,316" fill="url(#goldGradient)"/>

    <!-- Siren Crown Waves -->
    <path d="M420,370 Q512,330 604,370 Q512,410 420,370 Z" fill="#ffffff"/>

    <!-- Siren Face -->
    <circle cx="512" cy="495" r="75" fill="#ffffff"/>
    <circle cx="512" cy="495" r="58" fill="#1E3932"/>
    <path d="M472,485 Q512,460 552,485 Q512,500 472,485 Z" fill="#ffffff"/>
    <ellipse cx="512" cy="520" rx="16" ry="8" fill="#ffffff"/>

    <!-- Flowing Mermaid Twin Tails -->
    <!-- Left Tail -->
    <path d="M370,460 C320,530 310,650 370,740 C340,680 340,580 390,510 Z" fill="#ffffff"/>
    <path d="M340,540 C310,610 310,700 360,770 C330,720 330,640 370,580 Z" fill="url(#goldGradient)"/>

    <!-- Right Tail -->
    <path d="M654,460 C704,530 714,650 654,740 C684,680 684,580 634,510 Z" fill="#ffffff"/>
    <path d="M684,540 C714,610 714,700 664,770 C694,720 694,640 654,580 Z" fill="url(#goldGradient)"/>

    <!-- Siren Flowing Hair -->
    <path d="M445,540 C430,620 460,710 512,770 C564,710 594,620 579,540 C560,600 540,660 512,690 C484,660 464,600 445,540 Z" fill="#ffffff"/>
  </g>

  <!-- Bottom Badge: OPERATIONS SUITE -->
  <rect x="256" y="810" width="512" height="64" rx="32" fill="#1E3932" stroke="url(#goldGradient)" stroke-width="4"/>
  <text x="512" y="852" font-family="-apple-system, BlinkMacSystemFont, 'Helvetica Neue', sans-serif" font-size="28" font-weight="900" fill="#ffffff" text-anchor="middle" letter-spacing="4">
    OPERATIONS SUITE
  </text>
</svg>`;

const svgPath = path.join(buildDir, 'icon.svg');
const pngPath = path.join(buildDir, 'icon.png');
const iconsetDir = path.join(buildDir, 'icon.iconset');
const icnsPath = path.join(buildDir, 'icon.icns');

fs.writeFileSync(svgPath, svgContent);
console.log('✅ Utworzono build/icon.svg');

// Render do 1024x1024 PNG za pomocą sips
execSync(`sips -s format png "${svgPath}" --out "${pngPath}" -z 1024 1024`);
console.log('✅ Wygenerowano build/icon.png (1024x1024)');

// Tworzenie iconset dla iconutil (macOS .icns)
if (fs.existsSync(iconsetDir)) {
  fs.rmSync(iconsetDir, { recursive: true, force: true });
}
fs.mkdirSync(iconsetDir, { recursive: true });

const sizes = [
  { size: 16, name: 'icon_16x16.png' },
  { size: 32, name: 'icon_16x16@2x.png' },
  { size: 32, name: 'icon_32x32.png' },
  { size: 64, name: 'icon_32x32@2x.png' },
  { size: 128, name: 'icon_128x128.png' },
  { size: 256, name: 'icon_128x128@2x.png' },
  { size: 256, name: 'icon_256x256.png' },
  { size: 512, name: 'icon_256x256@2x.png' },
  { size: 512, name: 'icon_512x512.png' },
  { size: 1024, name: 'icon_512x512@2x.png' }
];

for (const item of sizes) {
  const target = path.join(iconsetDir, item.name);
  execSync(`sips -z ${item.size} ${item.size} "${pngPath}" --out "${target}"`);
}
console.log('✅ Utworzono zestaw ikon (icon.iconset)');

// Konwersja do .icns za pomocą macOS iconutil
try {
  execSync(`iconutil -c icns "${iconsetDir}" -o "${icnsPath}"`);
  console.log('🎉 Pomyślnie wygenerowano plik ikony macOS:', icnsPath);
} catch (err) {
  console.warn('⚠️ iconutil nie powiódł się, użyty zostanie plik PNG jako ikona bazowa.');
}
