'use strict';
const crypto = require('crypto');
const L = require('./_lib');
const M = require('./_media');

const SIZES = ['YS', 'YM', 'YL', 'S', 'M', 'L', 'XL', '2XL'];
const hits = {};

function clip(v, n) { return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n) : ''; }

/* Public: a family submits a team-store order request. No payment is taken; the shop follows up. */
module.exports = async function (req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return L.json(res, 405, { error: 'Method not allowed' }); }
  if (!M.sameSite(req)) return L.json(res, 403, { error: 'Blocked request.' });
  const ip = L.clientIp(req), now = Date.now();
  hits[ip] = (hits[ip] || []).filter(function (t) { return now - t < 10 * 60 * 1000; });
  if (hits[ip].length >= 5) return L.json(res, 429, { error: 'Too many orders from this device. Please call the shop.' });
  try {
    const b = await L.readBody(req, 30 * 1024);
    if (b.website) return L.json(res, 200, { ok: true, id: 'ok' });         /* honeypot: bots fill this in */
    const content = await L.getContent();
    const c = b.contact || {};
    const contact = { name: clip(c.name, 80), email: clip(c.email, 120), phone: clip(c.phone, 30), pickup: clip(c.pickup, 40), notes: clip(c.notes, 500) };
    if (contact.name.length < 2) return L.json(res, 400, { error: 'Please enter your name.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact.email)) return L.json(res, 400, { error: 'Please enter a valid email address.' });
    if (contact.phone && contact.phone.replace(/\D/g, '').length < 7) return L.json(res, 400, { error: 'That phone number looks too short.' });
    const pickups = content.locations.map(function (l) { return l.n; }).concat(['Ship to me']);
    if (pickups.indexOf(contact.pickup) < 0) return L.json(res, 400, { error: 'Please choose a pickup shop or shipping.' });
    const raw = Array.isArray(b.items) ? b.items.slice(0, 30) : [];
    if (!raw.length) return L.json(res, 400, { error: 'Your order is empty.' });
    const items = []; let total = 0;
    for (const it of raw) {
      const team = content.teams.filter(function (t) { return t.id === it.teamId && !t.hidden; })[0];
      const prod = team && team.items.filter(function (p) { return p.k === it.k && !p.hidden; })[0];
      const qty = Math.round(Number(it.qty));
      if (!prod || !(qty >= 1 && qty <= 20) || SIZES.indexOf(it.size) < 0) return L.json(res, 400, { error: 'One of the items in your cart is no longer available. Please re-add it.' });
      const num = String(it.num || '').replace(/\D/g, '').slice(0, 2);
      items.push({ team: team.n, name: prod.n, size: it.size, qty: qty, price: prod.price, first: clip(it.first, 24), last: clip(it.last, 24), num: num });
      total += prod.price * qty;
    }
    const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomBytes(3).toString('hex');
    await L.store.put('orders/' + id + '.json', { id: id, createdAt: new Date().toISOString(), status: 'new', contact: contact, items: items, total: Math.round(total * 100) / 100 });
    hits[ip].push(now);
    return L.json(res, 200, { ok: true, id: id.slice(-6).toUpperCase() });
  } catch (e) {
    console.error('order failed', e);
    return L.json(res, 500, { error: 'We could not save your order. Please call the shop.' });
  }
};
