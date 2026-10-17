'use strict';
/* Code 128 barcode as a PNG, no dependencies. Gift card codes are printed as a barcode so a shop scanner can read them
   straight into the admin Gift cards lookup (scanners type the code like a keyboard). */
const zlib = require('zlib');
const BARS = '11011001100,11001101100,11001100110,10010011000,10010001100,10001001100,10011001000,10011000100,10001100100,11001001000,11001000100,11000100100,10110011100,10011011100,10011001110,10111001100,10011101100,10011100110,11001110010,11001011100,11001001110,11011100100,11001110100,11101101110,11101001100,11100101100,11100100110,11101100100,11100110100,11100110010,11011011000,11011000110,11000110110,10100011000,10001011000,10001000110,10110001000,10001101000,10001100010,11010001000,11000101000,11000100010,10110111000,10110001110,10001101110,10111011000,10111000110,10001110110,11101110110,11010001110,11000101110,11011101000,11011100010,11011101110,11101011000,11101000110,11100010110,11101101000,11101100010,11100011010,11101111010,11001000010,11110001010,10100110000,10100001100,10010110000,10010000110,10000101100,10000100110,10110010000,10110000100,10011010000,10011000010,10000110100,10000110010,11000010010,11001010000,11110111010,11000010100,10001111010,10100111100,10010111100,10010011110,10111100100,10011110100,10011110010,11110100100,11110010100,11110010010,11011011110,11011110110,11110110110,10101111000,10100011110,10001011110,10111101000,10111100010,11110101000,11110100010,10111011110,10111101110,11101011110,11110101110,11010000100,11010010000,11010011100,1100011101011'.split(',');
const STOP = '1100011101011';

let CRC;
function crc32(buf) {
  if (!CRC) { CRC = []; for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; CRC[n] = c >>> 0; } }
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC[(c ^ buf[i]) & 255] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

/* the module pattern ('1' = bar) for text, using Code Set B */
function modules(text) {
  const vals = [104];
  for (const ch of String(text)) { const v = ch.charCodeAt(0) - 32; if (v < 0 || v > 94) throw new Error('unsupported character'); vals.push(v); }
  let sum = vals[0]; for (let i = 1; i < vals.length; i++) sum += vals[i] * i;
  vals.push(sum % 103);
  return vals.map(function (v) { return BARS[v]; }).join('') + STOP;
}

function png(text, opt) {
  opt = opt || {};
  const scale = opt.scale || 3, quiet = 10, h = opt.height || 84;
  const m = modules(text), w = (m.length + quiet * 2) * scale;
  const row = Buffer.alloc(1 + w, 255);
  row[0] = 0;
  for (let i = 0; i < m.length; i++) if (m[i] === '1') row.fill(0, 1 + (quiet + i) * scale, 1 + (quiet + i + 1) * scale);
  const raw = Buffer.alloc((1 + w) * h);
  for (let y = 0; y < h; y++) row.copy(raw, y * (1 + w));
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
module.exports = { png, modules };
