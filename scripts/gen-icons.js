const sharp = require('sharp');
const fs = require('fs');
const path = require('path');

const sizes = [16, 48, 128];
const svg = fs.readFileSync(path.join(__dirname, '..', 'icons', 'icon.svg'), 'utf8');

Promise.all(sizes.map(size => {
  const resized = svg.replace('width="128" height="128"', 'width="' + size + '" height="' + size + '"');
  return sharp(Buffer.from(resized))
    .png()
    .toFile(path.join(__dirname, '..', 'icons', 'icon' + size + '.png'))
    .then(() => console.log('Created icon' + size + '.png'));
})).then(() => console.log('Done')).catch(e => console.error(e));
