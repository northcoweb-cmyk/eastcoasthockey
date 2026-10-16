'use strict';
const crypto = require('crypto');
const L = require('./_lib');

/* Accepts one small image (already resized by the admin page) and stores it in Vercel Blob. */
module.exports = async function (req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return L.json(res, 405, { error: 'Method not allowed' }); }
  if (!L.requireAdmin(req, res)) return;
  try {
    const b = await L.readBody(req, 2 * 1024 * 1024);
    const m = /^data:(image\/(png|jpeg|webp));base64,([A-Za-z0-9+/=]+)$/.exec(b.dataUrl || '');
    if (!m) return L.json(res, 400, { error: 'Please choose a PNG, JPG or WebP image.' });
    const buf = Buffer.from(m[3], 'base64');
    if (buf.length > 1.5 * 1024 * 1024) return L.json(res, 400, { error: 'That image is too large.' });
    if (!L.hasBlob) return L.json(res, 501, { error: 'Image storage is not connected yet. Ask your developer to add a Vercel Blob store.' });
    const ext = m[2] === 'jpeg' ? 'jpg' : m[2];
    const url = await L.putImage(crypto.randomBytes(8).toString('hex') + '.' + ext, buf, m[1]);
    return L.json(res, 200, { url: url });
  } catch (e) { console.error('upload failed', e); return L.json(res, 500, { error: 'Upload failed. Try again.' }); }
};
