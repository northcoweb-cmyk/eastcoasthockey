'use strict';
const G = require('./_gift');
const B = require('./_barcode');

/* Barcode image for a gift card code (used in the gift card email). It only draws the characters it is given. */
module.exports = function (req, res) {
  const c = G.norm(new URL(req.url, 'http://x').searchParams.get('c'));
  if (!G.valid(c)) { res.statusCode = 400; return res.end('Bad code'); }
  res.statusCode = 200;
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', 'private, max-age=86400');
  res.end(B.png(c));
};
