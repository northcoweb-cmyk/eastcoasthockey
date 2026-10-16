'use strict';
const L = require('./_lib');

module.exports = async function (req, res) {
  try {
    if (req.method === 'GET') {
      const c = await L.getContent();
      res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=5');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      return res.end(JSON.stringify(c));
    }
    if (req.method === 'PUT') {
      if (!L.requireAdmin(req, res)) return;
      if (process.env.VERCEL && !L.hasBlob) return L.json(res, 503, { error: 'Not saved: the site cannot reach your Blob store. Check the BLOB_READ_WRITE_TOKEN environment variable and redeploy.' });
      const body = await L.readBody(req, 300 * 1024);
      const c = L.clean(body);
      await L.saveContent(c);
      return L.json(res, 200, { ok: true, content: c, persistent: L.hasBlob });
    }
    if (req.method === 'DELETE') {
      if (!L.requireAdmin(req, res)) return;
      await L.resetContent();
      return L.json(res, 200, { ok: true, content: L.DEFAULTS });
    }
    res.setHeader('Allow', 'GET, PUT, DELETE');
    return L.json(res, 405, { error: 'Method not allowed' });
  } catch (e) {
    console.error('content api failed', e);
    return L.json(res, 500, { error: 'Something went wrong saving. Try again.' });
  }
};
