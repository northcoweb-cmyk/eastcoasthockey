'use strict';
const crypto = require('crypto');
const L = require('./_lib');
const M = require('./_media');
const Mail = require('./_mail');
const Pay = require('./_pay');

const hits = {};
const STATES = ['AL','AK','AZ','AR','CA','CO','CT','DE','DC','FL','GA','HI','ID','IL','IN','IA','KS','KY','LA','ME','MD','MA','MI','MN','MS','MO','MT','NE','NV','NH','NJ','NM','NY','NC','ND','OH','OK','OR','PA','RI','SC','SD','TN','TX','UT','VT','VA','WA','WV','WI','WY'];
const NAME_RE = /^[\p{L}\p{M}][\p{L}\p{M}' .-]{0,23}$/u;

function clip(v, n) { return typeof v === 'string' ? v.replace(/[\u0000-\u001f\u007f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n) : ''; }
const cents = function (n) { return Math.round(n * 100); };
const fail = function (res, msg) { return L.json(res, 400, { error: msg }); };

/* Public: a family submits a team-store order. Every price, size rule and total is decided here, never by the browser. */
module.exports = async function (req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return L.json(res, 405, { error: 'Method not allowed' }); }
  if (!M.sameSite(req)) return L.json(res, 403, { error: 'Blocked request.' });
  const ip = L.clientIp(req), now = Date.now();
  hits[ip] = (hits[ip] || []).filter(function (t) { return now - t < 10 * 60 * 1000; });
  if (hits[ip].length >= 5) return L.json(res, 429, { error: 'Too many orders from this device. Please call the shop.' });
  try {
    const b = await L.readBody(req, 40 * 1024);
    if (b.website) return L.json(res, 200, { ok: true, id: 'ok' });         /* honeypot */
    const content = await L.getContent();
    const c = b.contact || {};
    const contact = { name: clip(c.name, 80), email: clip(c.email, 120).toLowerCase(), phone: clip(c.phone, 30), notes: clip(c.notes, 500) };
    if (contact.name.length < 2) return fail(res, 'Please enter your name.');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(contact.email)) return fail(res, 'Please enter a valid email address.');
    if (contact.phone && contact.phone.replace(/\D/g, '').length < 7) return fail(res, 'That phone number looks too short.');

    /* fulfillment */
    const fulfillment = b.fulfillment === 'ship' ? 'ship' : 'pickup';
    let pickupShop = '', shipping = null;
    if (fulfillment === 'pickup') {
      pickupShop = clip(b.pickupShop, 40);
      if (content.locations.map(function (l) { return l.n; }).indexOf(pickupShop) < 0) return fail(res, 'Please choose a pickup shop.');
    } else {
      if (!content.store.shipEnabled) return fail(res, 'Shipping is not available right now. Please choose pickup.');
      const s = b.shipping || {};
      shipping = { name: clip(s.name, 80), address1: clip(s.address1, 90), address2: clip(s.address2, 60), city: clip(s.city, 50), state: clip(s.state, 2).toUpperCase(), zip: clip(s.zip, 10) };
      if (shipping.name.length < 2 || shipping.address1.length < 4 || shipping.city.length < 2) return fail(res, 'Please complete the shipping address.');
      if (STATES.indexOf(shipping.state) < 0) return fail(res, 'Please choose a valid state.');
      if (!/^\d{5}(-\d{4})?$/.test(shipping.zip)) return fail(res, 'Please enter a valid ZIP code.');
    }

    /* items: checked against the saved product rules */
    const raw = Array.isArray(b.items) ? b.items.slice(0, 40) : [];
    if (!raw.length) return fail(res, 'Your order is empty.');
    const items = []; let subtotal = 0;
    for (const it of raw) {
      const team = content.teams.filter(function (t) { return t.id === it.teamId && !t.hidden; })[0];
      const prod = team && team.items.filter(function (p) { return p.k === it.k && !p.hidden; })[0];
      const qty = Math.round(Number(it.qty));
      if (!prod || !(qty >= 1 && qty <= 20)) return fail(res, 'One of the items in your cart is no longer available. Please re-add it.');
      const sizes = L.SIZE_SETS[prod.sizes] || [];
      let size = '';
      if (sizes.length) { size = clip(it.size, 4); if (sizes.indexOf(size) < 0) return fail(res, prod.n + ': please choose a valid size.'); }
      let last = '', first = '', num = '';
      if (prod.name !== 'off') {
        last = clip(it.last, 24); first = clip(it.first, 24);
        if (prod.name === 'required' && !last) return fail(res, prod.n + ': a last name is required.');
        if ((last && !NAME_RE.test(last)) || (first && !NAME_RE.test(first))) return fail(res, prod.n + ': names can only use letters, spaces, apostrophes, periods and hyphens.');
      }
      if (prod.number !== 'off') {
        num = String(it.num == null ? '' : it.num).trim();
        if (num && !/^\d{1,2}$/.test(num)) return fail(res, prod.n + ': the number must be 0 to 99.');
        if (prod.number === 'required' && num === '') return fail(res, prod.n + ': a number is required.');
      }
      items.push({ teamId: team.id, team: team.n, k: prod.k, name: prod.n, size: size, qty: qty, price: prod.price, first: first, last: last, num: num });
      subtotal += cents(prod.price) * qty;
    }
    /* totals in whole cents: tax is on items; shipping is a flat fee */
    const tax = Math.round(subtotal * content.store.taxRate / 100);
    const ship = fulfillment === 'ship' ? cents(content.store.shipFee) : 0;
    const totals = { subtotal: subtotal / 100, tax: tax / 100, shipping: ship / 100, total: (subtotal + tax + ship) / 100, taxRate: content.store.taxRate };

    const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomBytes(3).toString('hex');
    const refCode = id.slice(-6).toUpperCase();
    const order = { id: id, createdAt: new Date().toISOString(), status: 'new', payment: { status: 'unpaid', method: '', note: '' }, contact: contact, fulfillment: fulfillment, pickupShop: pickupShop, shipping: shipping,
      tracking: { carrier: '', number: '' }, items: items, totals: totals, notes: '', history: [{ at: new Date().toISOString(), event: 'Order received' }] };

    let dueCents = subtotal + tax + ship;

    const pay = Pay.active();
    let url = '';
    if (pay) order.payment = { status: 'pending', method: '', note: 'Waiting for online payment' };
    await L.store.put('orders/' + id + '.json', order);

    if (pay) {
      try {
        const base = Pay.origin(req);
        const lines = items.map(function (i) { return { name: i.team + ' ' + i.name, description: [i.size && 'Size ' + i.size, [i.first, i.last].filter(Boolean).join(' '), i.num !== '' && '#' + i.num].filter(Boolean).join(' | '), cents: cents(i.price), qty: i.qty }; })
              .concat(tax ? [{ name: 'Sales tax (' + totals.taxRate + '%)', cents: tax, qty: 1 }] : []).concat(ship ? [{ name: 'Shipping', cents: ship, qty: 1 }] : []);
        const s = await pay.createCheckout({ kind: 'order', id: id, email: contact.email, description: 'Team order #' + refCode, lines: lines,
          successUrl: base + '/?checkout=success&o=' + refCode, cancelUrl: base + '/?checkout=cancel#teams' });
        order.payment.provider = pay.name; order.payment.sessionId = s.sessionId; url = s.url;
        await L.store.put('orders/' + id + '.json', order);
      } catch (e) {
        order.status = 'cancelled'; order.payment = { status: 'unpaid', method: '', note: 'Could not start checkout' };
        order.history.push({ at: new Date().toISOString(), event: 'Payment page could not be created, order cancelled' });
        await L.store.put('orders/' + id + '.json', order);
        return L.json(res, 502, { error: 'We could not open the payment page. Nothing was charged. Please try again or call the shop.' });
      }
    }
    hits[ip].push(now);
    /* with online payment the emails go out when the payment is confirmed; otherwise right away */
    if (!url) await Promise.all([Mail.orderReceived(order), Mail.orderAlert(order)]).catch(function () { /* email never blocks an order */ });
    return L.json(res, 200, { ok: true, id: refCode, total: totals.total, url: url, emailed: Mail.configured });
  } catch (e) {
    console.error('order failed', e);
    return L.json(res, 500, { error: 'We could not save your order. Please call the shop.' });
  }
};
