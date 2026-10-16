'use strict';
const L = require('./_lib');
const M = require('./_media');

/* Returns a short-lived, signed URL for one reel video. */
module.exports = function (req, res) {
  const id = new URL(req.url, 'http://x').searchParams.get('id') || '';
  if (req.method !== 'GET' || !M.file(id) || !M.sameSite(req)) return L.json(res, 403, { error: 'Not available' });
  const t = L.sign({ id: id, exp: Date.now() + 10 * 60 * 1000 });
  return L.json(res, 200, { url: '/api/video?id=' + id + '&t=' + encodeURIComponent(t) });
};
