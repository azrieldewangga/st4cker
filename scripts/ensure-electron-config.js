
import fs from 'fs';
import path from 'path';

// Using console.log to debug where we are
console.log('Ensuring dist-electron/package.json for CommonJS support...');

const distPath = path.resolve('dist-electron');

if (!fs.existsSync(distPath)) {
    console.error('dist-electron directory NOT found! Build might have failed.');
    process.exit(1);
}

const pkgPath = path.join(distPath, 'package.json');
const content = JSON.stringify({ type: 'module' }, null, 4);

fs.writeFileSync(pkgPath, content);
console.log('Successfully created dist-electron/package.json');

// Copy splash.html to dist-electron
console.log('Copying splash.html to dist-electron...');
const splashSrc = path.resolve('electron/splash.html');
const splashDest = path.join(distPath, 'splash.html');

if (fs.existsSync(splashSrc)) {
    fs.copyFileSync(splashSrc, splashDest);
    console.log('Successfully copied splash.html');
} else {
    console.error('ERROR: electron/splash.html not found!');
    process.exit(1);
}
