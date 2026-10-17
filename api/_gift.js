'use strict';
const crypto = require('crypto');
const L = require('./_lib');

/* 12 characters from an alphabet with no 0/O/1/I, shown as XXXX-XXXX-XXXX and encoded in the barcode without dashes. */
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const MIN = 10, MAX = 500;

function newCode() { const b = crypto.randomBytes(12); let s = ''; for (let i = 0; i < 12; i++) s += ALPHA[b[i] % 32]; return s; }
function norm(v) { return String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function valid(v) { return /^[A-HJ-NP-Z2-9]{12}$/.test(v); }
function pretty(c) { return c.slice(0, 4) + '-' + c.slice(4, 8) + '-' + c.slice(8); }
const path = function (c) { return 'giftcards/' + c + '.json'; };

/* one write at a time per card inside an instance, so a double scan cannot spend the same balance twice */
const chains = {};
function locked(code, fn) {
  const prev = chains[code] || Promise.resolve();
  const next = prev.then(fn, fn);
  chains[code] = next.catch(function () { /* keep the chain alive */ });
  return next;
}

async function create(o) {
  let code, tries = 0;
  do { code = newCode(); tries++; } while ((await L.store.get(path(code))) && tries < 5);
  const now = new Date().toISOString();
  const card = { code: code, initialCents: o.cents, balanceCents: o.status === 'active' ? o.cents : 0, status: o.status || 'pending', source: o.source || 'online',
    buyer: o.buyer || { name: '', email: '' }, recipient: o.recipient || { name: '', email: '' }, from: o.from || '', message: o.message || '', createdAt: now, paidAt: o.status === 'active' ? now : '',
    payment: o.payment || {}, emailed: false, history: [{ at: now, event: o.status === 'active' ? 'Issued ' + o.source : 'Created, awaiting payment', cents: o.cents }] };
  await L.store.put(path(code), card);
  return card;
}
const get = function (code) { return valid(code) ? L.store.get(path(code)) : Promise.resolve(null); };
const list = async function () { return (await Promise.all((await L.store.list('giftcards/')).sort().map(function (n) { return L.store.get(n); }))).filter(Boolean); };

/* idempotent: a repeated webhook only activates once. Returns { card, first } */
function activate(code, info) {
  return locked(code, async function () {
    const c = await get(code);
    if (!c || c.status !== 'pending') return { card: c, first: false };
    c.status = 'active'; c.balanceCents = c.initialCents; c.paidAt = new Date().toISOString();
    c.payment = Object.assign(c.payment || {}, info || {});
    c.history.push({ at: c.paidAt, event: 'Paid online, activated', cents: c.initialCents });
    await L.store.put(path(code), c);
    return { card: c, first: true };
  });
}
/* spend (cents > 0) or restore (cents < 0). Never goes below zero. Returns { ok, card, applied } */
function adjust(code, cents, event, note) {
  return locked(code, async function () {
    const c = await get(code);
    if (!c || c.status !== 'active') return { ok: false, error: c && c.status === 'void' ? 'This gift card has been voided.' : 'Gift card not found.' };
    if (cents > 0) {
      if (c.balanceCents <= 0) return { ok: false, error: 'This gift card has no balance.', card: c };
      cents = Math.min(cents, c.balanceCents);
    } else cents = Math.max(cents, c.balanceCents - c.initialCents);   /* a restore can never lift the balance above the amount sold */
    c.balanceCents -= cents;
    c.history.push({ at: new Date().toISOString(), event: event + (note ? ' - ' + note : ''), cents: -cents });
    await L.store.put(path(code), c);
    return { ok: true, card: c, applied: cents };
  });
}
function setStatus(code, status) {
  return locked(code, async function () {
    const c = await get(code); if (!c) return null;
    if (status === 'void' && c.status !== 'void') { c.status = 'void'; c.history.push({ at: new Date().toISOString(), event: 'Voided', cents: 0 }); }
    else if (status === 'active' && c.status === 'void') { c.status = 'active'; c.history.push({ at: new Date().toISOString(), event: 'Reactivated', cents: 0 }); }
    await L.store.put(path(code), c); return c;
  });
}
const save = function (c) { return L.store.put(path(c.code), c); };
const publicView = function (c) { return { code: pretty(c.code), balance: c.balanceCents / 100, status: c.status }; };
module.exports = { MIN: MIN, MAX: MAX, norm: norm, valid: valid, pretty: pretty, create: create, get: get, list: list, activate: activate, adjust: adjust, setStatus: setStatus, save: save, publicView: publicView };

/* give back what an unpaid or cancelled order had reserved */
async function restoreOrder(o) {
  const g = o && o.giftcard;
  if (!g || g.restored || !(g.appliedCents > 0)) return false;
  const r = await adjust(g.code, -g.appliedCents, 'Restored: order not completed', '#' + String(o.id).slice(-6).toUpperCase());
  if (r.ok) g.restored = true;
  return r.ok;
}
module.exports.restoreOrder = restoreOrder;
