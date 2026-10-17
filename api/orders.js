'use strict';
const L = require('./_lib');
const Mail = require('./_mail');
const G = require('./_gift');

const STATUSES = ['new', 'in_production', 'ready', 'shipped', 'complete', 'cancelled'];
const METHODS = ['', 'card', 'cash', 'check', 'invoice', 'other'];
function clip(v, n) { return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>]/g, ' ').trim().slice(0, n) : ''; }

/* Admin only: list, update and delete orders. */
module.exports = async function (req, res) {
  if (!L.requireAdmin(req, res)) return;
  try {
    const q = new URL(req.url, 'http://x').searchParams, id = q.get('id') || '';
    if (req.method === 'GET') {
      const names = (await L.store.list('orders/')).sort().reverse().slice(0, 500);
      const orders = (await Promise.all(names.map(function (n) { return L.store.get(n); }))).filter(Boolean);
      return L.json(res, 200, { orders: orders, mail: Mail.configured });
    }
    if (!/^[0-9TZ-]+-[a-f0-9]{6}$/.test(id)) return L.json(res, 400, { error: 'Bad order id' });
    const p = 'orders/' + id + '.json';
    if (req.method === 'PUT') {
      const o = await L.store.get(p);
      if (!o) return L.json(res, 404, { error: 'Order not found' });
      const b = await L.readBody(req, 4096), before = o.status;
      const log = function (e) { (o.history = o.history || []).push({ at: new Date().toISOString(), event: e }); };
      if (b.status !== undefined) {
        if (STATUSES.indexOf(b.status) < 0) return L.json(res, 400, { error: 'Bad status' });
        if (b.status !== o.status) { o.status = b.status; log('Status: ' + b.status.replace('_', ' ')); }
      }
      if (b.payment) {
        const ps = b.payment.status === 'paid' ? 'paid' : b.payment.status === 'refunded' ? 'refunded' : b.payment.status === 'pending' && o.payment.status === 'pending' ? 'pending' : 'unpaid';
        const method = METHODS.indexOf(b.payment.method) >= 0 ? b.payment.method : '';
        if (ps !== o.payment.status) log('Payment: ' + ps + (method ? ' (' + method + ')' : ''));
        o.payment = Object.assign({}, o.payment, { status: ps, method: method, note: clip(b.payment.note, 200) });
      }
      if (b.tracking) o.tracking = { carrier: clip(b.tracking.carrier, 30), number: clip(b.tracking.number, 60) };
      if (b.notes !== undefined) o.notes = clip(b.notes, 1000);
      if (o.status === 'cancelled' && before !== 'cancelled' && o.payment.status !== 'paid' && await G.restoreOrder(o)) log('Gift card balance restored');
      await L.store.put(p, o);
      let emailed = false;
      if (o.status !== before && (o.status === 'ready' || o.status === 'shipped') && b.notify !== false) emailed = (await Mail.statusUpdate(o)).sent;
      return L.json(res, 200, { ok: true, order: o, emailed: emailed });
    }
    if (req.method === 'DELETE') { await L.store.del(p); return L.json(res, 200, { ok: true }); }
    res.setHeader('Allow', 'GET, PUT, DELETE');
    return L.json(res, 405, { error: 'Method not allowed' });
  } catch (e) { console.error('orders failed', e); return L.json(res, 500, { error: 'Something went wrong.' }); }
};
