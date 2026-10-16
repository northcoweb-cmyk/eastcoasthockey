'use strict';
const L = require('./_lib');

/* Serves images uploaded from the admin (stored in the Blob store, which may be private). */
module.exports = async function (req, res) {
  try {
    const p = new URL(req.url, 'http://x').searchParams.get('p') || '';
    if (!/^uploads\/[a-f0-9]{16}\.(webp|png|jpg)$/.test(p) || !L.hasBlob) { res.statusCode = 404; return res.end('Not found'); }
    const r = await L.getImage(p);
    if (!r || !r.stream) { res.statusCode = 404; return res.end('Not found'); }
    const type = p.endsWith('.png') ? 'image/png' : p.endsWith('.jpg') ? 'image/jpeg' : 'image/webp';
    res.setHeader('Content-Type', type);
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
    const buf = Buffer.from(await new Response(r.stream).arrayBuffer());
    res.end(buf);
  } catch (e) { res.statusCode = 500; res.end('Error'); }
};
