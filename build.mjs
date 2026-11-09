// Tạo userscript (Tampermonkey/Violentmonkey) từ src/cleanxlink.js
// Chạy: node build.mjs
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const manifest = JSON.parse(readFileSync('manifest.json', 'utf8'));
const core = readFileSync('src/cleanxlink.js', 'utf8');
const matches = manifest.content_scripts.find((c) => c.world === 'MAIN').matches;

const header = `// ==UserScript==
// @name         CleanXLink
// @namespace    cleanxlink
// @version      ${manifest.version}
// @description  ${manifest.description}
${matches.map((m) => `// @match        ${m}`).join('\n')}
// @run-at       document-start
// @grant        none
// ==/UserScript==

// Đổi cài đặt: mở Console (F12) trên trang và chạy, ví dụ:
//   localStorage.cleanxlink = JSON.stringify({ xDomain: 'fixupx.com', style: 'g', translate: 'vi' })
// Các khoá: stripTracking, fixup, xDomain, style, translate, bsky, reddit (xem DEFAULTS bên dưới).

`;

mkdirSync('dist', { recursive: true });
writeFileSync('dist/cleanxlink.user.js', header + core);
console.log('OK -> dist/cleanxlink.user.js');
