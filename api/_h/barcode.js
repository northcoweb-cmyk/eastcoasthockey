'use strict';
const G = require('../_gift');
const B = require('../_barcode');

/* Barcode image for a gift card code (used in the gift card email). It only draws the characters it is given. */
module.exports = function (req, res) {
  const q = new URL(req.url, 'http://x').searchParams;
  const c = G.norm(q.get('c')), sc = Math.min(4, Math.max(1, parseInt(q.get('s'), 10) || 2));
  if (!G.valid(c)) { res.statusCode = 400; return res.end('Bad code'); }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.end(B.png(c, { scale: sc, height: 40 * sc }));
};
