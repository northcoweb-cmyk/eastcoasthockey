'use strict';
const L = require('../_lib');

/* Admin only: contact-form messages. */
module.exports = async function (req, res) {
  if (!L.requireAdmin(req, res)) return;
  try {
    const id = new URL(req.url, 'http://x').searchParams.get('id') || '';
    if (req.method === 'GET') {
      const names = (await L.store.list('messages/')).sort().reverse().slice(0, 300);
      return L.json(res, 200, { messages: (await Promise.all(names.map(function (n) { return L.store.get(n); }))).filter(Boolean) });
    }
    if (!/^[0-9TZ-]+-[a-f0-9]{6}$/.test(id)) return L.json(res, 400, { error: 'Bad id' });
    const p = 'messages/' + id + '.json';
    if (req.method === 'PUT') { const m = await L.store.get(p); if (!m) return L.json(res, 404, { error: 'Not found' }); m.read = true; await L.store.put(p, m); return L.json(res, 200, { ok: true }); }
    if (req.method === 'DELETE') { await L.store.del(p); return L.json(res, 200, { ok: true }); }
    return L.json(res, 405, { error: 'Method not allowed' });
  } catch (e) { console.error('messages failed', e); return L.json(res, 500, { error: 'Something went wrong.' }); }
};
