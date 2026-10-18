'use strict';
/* One serverless function that serves several related endpoints (Vercel's Hobby plan allows 12 functions).
   vercel.json rewrites the public paths here, e.g. /api/login -> /api/giftcard?a=login. */
const H = { buy: require('./_h/giftcard'), barcode: require('./_h/barcode'), config: require('./_h/config') };
module.exports = function (req, res) {
  const a = new URL(req.url, 'http://x').searchParams.get('a') || 'buy';
  if (!Object.prototype.hasOwnProperty.call(H, a)) { res.statusCode = 404; return res.end('Not found'); }
  return H[a](req, res);
};
