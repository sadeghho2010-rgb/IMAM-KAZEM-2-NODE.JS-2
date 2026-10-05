const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const { execSync } = require('child_process');

async function buildIcons() {
  const iconSvg = fs.readFileSync('public/icon.svg');
  const maskableSvg = fs.readFileSync('public/icon-maskable.svg');
  const faviconSvg = fs.readFileSync('public/favicon.svg');

  console.log('Generating PWA and web icons...');

  // 1. PWA 192x192
  await sharp(iconSvg)
    .resize(192, 192)
    .png()
    .toFile('public/pwa-192x192.png');
  console.log('Created public/pwa-192x192.png');

  // 2. PWA 512x512
  await sharp(iconSvg)
    .resize(512, 512)
    .png()
    .toFile('public/pwa-512x512.png');
  console.log('Created public/pwa-512x512.png');

  // 3. PWA Maskable 512x512
  await sharp(maskableSvg)
    .resize(512, 512)
    .png()
    .toFile('public/pwa-maskable-512x512.png');
  console.log('Created public/pwa-maskable-512x512.png');

  // 4. Apple Touch Icon 180x180
  await sharp(iconSvg)
    .resize(180, 180)
    .png()
    .toFile('public/apple-touch-icon-180x180.png');
  console.log('Created public/apple-touch-icon-180x180.png');

  // 5. Favicon 16x16 and 32x32
  await sharp(faviconSvg)
    .resize(16, 16)
    .png()
    .toFile('public/favicon-16x16.png');
  await sharp(faviconSvg)
    .resize(32, 32)
    .png()
    .toFile('public/favicon-32x32.png');
  console.log('Created 16x16 & 32x32 PNGs');

  // 6. Favicon .ico using convert or copy
  try {
    execSync('convert public/favicon-16x16.png public/favicon-32x32.png public/favicon.ico');
    console.log('Created public/favicon.ico with ImageMagick convert');
  } catch (err) {
    console.warn('convert failed, copying 32x32 to favicon.ico:', err);
    fs.copyFileSync('public/favicon-32x32.png', 'public/favicon.ico');
  }

  console.log('All icons generated successfully!');
}

buildIcons().catch(err => {
  console.error('Icon generation failed:', err);
  process.exit(1);
});
