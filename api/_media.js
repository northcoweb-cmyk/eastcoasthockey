'use strict';
/* Reel videos live in api/_private/ (never served as static files) and are only handed out through
   /api/vtoken -> /api/video. This is a deterrent against casual saving, not DRM: anything a browser can
   play can still be screen-recorded. */
const path = require('path');
const IDS = ['sharp-long', 'sharp-short', 'wall', 'ccm-skates', 'ccm-sticks'];
const DIR = path.join(__dirname, '_private');
function file(id) { return IDS.indexOf(id) >= 0 ? path.join(DIR, id + '.mp4') : null; }

/* the request must come from a page on this same site */
function sameSite(req) {
  const h = req.headers, site = h['sec-fetch-site'];
  if (site) return site === 'same-origin';
  const ref = h.referer || h.origin || '';
  try { return new URL(ref).host === h.host; } catch (e) { return false; }
}
module.exports = { IDS, file, sameSite };
