'use strict';
const L = require('./_lib');

/* Admin only: list, update and delete order requests. */
module.exports = async function (req, res) {
  if (!L.requireAdmin(req, res)) return;
  try {
    const q = new URL(req.url, 'http://x').searchParams, id = q.get('id') || '';
    if (req.method === 'GET') {
      const names = (await L.store.list('orders/')).sort().reverse().slice(0, 150);
      const orders = (await Promise.all(names.map(function (n) { return L.store.get(n); }))).filter(Boolean);
      return L.json(res, 200, { orders: orders });
    }
    if (!/^[0-9TZ-]+-[a-f0-9]{6}$/.test(id)) return L.json(res, 400, { error: 'Bad order id' });
    const p = 'orders/' + id + '.json';
    if (req.method === 'PUT') {
      const o = await L.store.get(p);
      if (!o) return L.json(res, 404, { error: 'Order not found' });
      const b = await L.readBody(req, 2048);
      o.status = b.status === 'done' ? 'done' : 'new';
      await L.store.put(p, o);
      return L.json(res, 200, { ok: true, order: o });
    }
    if (req.method === 'DELETE') { await L.store.del(p); return L.json(res, 200, { ok: true }); }
    res.setHeader('Allow', 'GET, PUT, DELETE');
    return L.json(res, 405, { error: 'Method not allowed' });
  } catch (e) { console.error('orders failed', e); return L.json(res, 500, { error: 'Something went wrong.' }); }
};
