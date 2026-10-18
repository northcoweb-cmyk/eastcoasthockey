'use strict';
const fs = require('fs');
const L = require('../_lib');
const M = require('../_media');

function deny(res, code) { res.statusCode = code; res.setHeader('Cache-Control', 'no-store'); res.end('Forbidden'); }

module.exports = function (req, res) {
  const q = new URL(req.url, 'http://x').searchParams;
  const id = q.get('id') || '', tok = L.verify(q.get('t') || '');
  const f = M.file(id);
  if (!f || !tok || tok.id !== id) return deny(res, 403);
  /* a <video> element sends Sec-Fetch-Dest: video; opening the URL as a page or downloading it does not */
  const dest = req.headers['sec-fetch-dest'];
  if (dest ? dest !== 'video' : false) return deny(res, 403);
  if (!M.sameSite(req)) return deny(res, 403);
  let stat;
  try { stat = fs.statSync(f); } catch (e) { return deny(res, 404); }
  const size = stat.size;
  res.setHeader('Content-Type', 'video/mp4');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('Content-Disposition', 'inline');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('Cross-Origin-Resource-Policy', 'same-origin');
  res.setHeader('X-Robots-Tag', 'noindex');
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (m && (m[1] || m[2])) {
    let start = m[1] ? parseInt(m[1], 10) : size - parseInt(m[2], 10);
    let end = m[1] && m[2] ? parseInt(m[2], 10) : size - 1;
    if (start >= size || end < start) { res.statusCode = 416; res.setHeader('Content-Range', 'bytes */' + size); return res.end(); }
    end = Math.min(end, size - 1);
    res.statusCode = 206;
    res.setHeader('Content-Range', 'bytes ' + start + '-' + end + '/' + size);
    res.setHeader('Content-Length', end - start + 1);
    if (req.method === 'HEAD') return res.end();
    return fs.createReadStream(f, { start: start, end: end }).pipe(res);
  }
  res.statusCode = 200;
  res.setHeader('Content-Length', size);
  if (req.method === 'HEAD') return res.end();
  return fs.createReadStream(f).pipe(res);
};
