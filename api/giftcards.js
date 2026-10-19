'use strict';
const L = require('./_lib');
const G = require('./_gift');
const Pay = require('./_pay');
const Mail = require('./_mail');

function clip(v, n) { return typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/g, ' ').trim().slice(0, n) : ''; }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const SETTINGS_PATH = 'settings/gift.json';
async function getSettings() {
  const s = (await L.store.get(SETTINGS_PATH)) || {};
  const amounts = Array.isArray(s.amounts) && s.amounts.length ? s.amounts : [10, 25, 50, 100, 200];
  return { amounts: amounts, low: Number(s.low) >= 1 ? Number(s.low) : 3 };
}
const view = function (c) { return Object.assign({}, c, { display: c.external ? c.code : G.pretty(c.code) }); };

/* Admin only: look up a card (type it or scan it), spend from it in the shop, issue one for an in-store sale, resend, void. */
module.exports = async function (req, res) {
  if (!L.requireAdmin(req, res)) return;
  try {
    if (req.method === 'GET') {
      const q = new URL(req.url, 'http://x').searchParams.get('code');
      if (q) {
        const c = await G.get(G.norm(q));
        return c ? L.json(res, 200, { card: view(c) }) : L.json(res, 404, { error: 'No gift card with that code.' });
      }
      const all = await G.list(), pool = {}, poolList = {};
      all.filter(function (c) { return c.status === 'pool'; }).sort(function (a, b) { return a.code < b.code ? -1 : 1; }).forEach(function (c) { const k = String(c.initialCents / 100); pool[k] = (pool[k] || 0) + 1; (poolList[k] = poolList[k] || []).push(c.code); });
      const cards = all.filter(function (c) { return c.status !== 'pool' && (c.status !== 'pending' || Date.now() - Date.parse(c.createdAt) < 86400000); }).sort(function (a, b) { return a.createdAt < b.createdAt ? 1 : -1; });
      return L.json(res, 200, { cards: cards.map(view), pool: pool, poolList: poolList, settings: await getSettings(), payments: !!Pay.active(), mail: Mail.configured });
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return L.json(res, 405, { error: 'Method not allowed' }); }
    const b = await L.readBody(req, 8 * 1024), act = b.action, code = G.norm(b.code);
    if (act === 'settings') {
      const amounts = (Array.isArray(b.amounts) ? b.amounts : []).map(Number).filter(function (n) { return Number.isInteger(n) && n >= 1 && n <= 2000; }).filter(function (n, i, a) { return a.indexOf(n) === i; }).sort(function (a, c) { return a - c; }).slice(0, 10);
      const low = Math.min(Math.max(parseInt(b.low, 10) || 3, 1), 50);
      await L.store.put(SETTINGS_PATH, { amounts: amounts.length ? amounts : [10, 25, 50, 100, 200], low: low });
      return L.json(res, 200, { ok: true, settings: await getSettings() });
    }
    if (act === 'poolRemove') {
      const c = await G.get(code);
      if (!c || c.status !== 'pool') return L.json(res, 404, { error: 'That number is not in the pool.' });
      await L.store.del('giftcards/' + c.code + '.json');
      return L.json(res, 200, { ok: true });
    }
    if (act === 'poolAdd') {
      /* one per line: amount, then the number the register made, e.g. "50 47790003582" */
      let added = 0, skipped = 0;
      for (const line of String(b.lines || '').split(/\n/).slice(0, 500)) {
        const m = line.trim().match(/^\$?(\d+(?:\.\d{1,2})?)[\s,;]+([A-Za-z0-9]{6,24})$/);
        if (!m) { if (line.trim()) skipped++; continue; }
        const card = await G.create({ code: G.norm(m[2]), external: true, cents: Math.round(Number(m[1]) * 100), status: 'pool', source: 'store' });
        if (card) added++; else skipped++;
      }
      return L.json(res, 200, { ok: true, added: added, skipped: skipped });
    }
    if (act === 'issue') {
      const dollars = Number(b.amount);
      if (!(dollars >= 1 && dollars <= 2000) || Math.round(dollars * 100) !== dollars * 100) return L.json(res, 400, { error: 'Enter an amount from $1 to $2000.' });
      const email = clip(b.email, 120).toLowerCase();
      if (email && !EMAIL.test(email)) return L.json(res, 400, { error: 'That email address does not look right.' });
      let num = G.norm(b.number);
      if (b.usePool && !num) {
        const free = (await G.list()).filter(function (c) { return c.status === 'pool' && c.initialCents === Math.round(dollars * 100); }).sort(function (a, b2) { return a.createdAt < b2.createdAt ? -1 : 1; });
        let got = null;
        for (const f of free) { got = await G.claim(f.code, { recipient: { name: clip(b.name, 80), email: email }, message: clip(b.message, 300), from: clip(b.from, 80) }); if (got) break; }
        if (!got) return L.json(res, 409, { error: 'There are no $' + dollars + ' cards left in the pool. Add more numbers below.' });
        const left = free.length - 1, low = (await getSettings()).low;
        if (left === low || left === 0) await Mail.lowStock(dollars, left).catch(function () { /* never blocks */ });
        let sent2 = false;
        if (email && b.send !== false) { sent2 = (await Mail.giftCard(got, Pay.origin(req))).sent; got.emailed = sent2; await G.save(got); }
        return L.json(res, 200, { ok: true, card: view(got), emailed: sent2 });
      }
      if (b.number && !G.valid(num)) return L.json(res, 400, { error: 'The register number should be 6 to 24 letters or numbers.' });
      const card = await G.create({ code: num || undefined, external: !!num, cents: Math.round(dollars * 100), status: 'active', source: 'store', recipient: { name: clip(b.name, 80), email: email }, message: clip(b.message, 300), from: clip(b.from, 80) });
      if (!card) return L.json(res, 409, { error: 'A card with that number already exists here.' });
      let sent = false;
      if (email && b.send !== false) { sent = (await Mail.giftCard(card, Pay.origin(req))).sent; card.emailed = sent; await G.save(card); }
      return L.json(res, 200, { ok: true, card: view(card), emailed: sent });
    }
    if (!G.valid(code)) return L.json(res, 400, { error: 'That is not a valid gift card code.' });
    if (act === 'redeem') {
      const dollars = Number(b.amount);
      if (!(dollars > 0) || Math.round(dollars * 100) !== dollars * 100) return L.json(res, 400, { error: 'Enter the amount to take off the card.' });
      const r = await G.adjust(code, Math.round(dollars * 100), 'Used in shop', clip(b.note, 80));
      if (!r.ok) return L.json(res, 400, { error: r.error });
      return L.json(res, 200, { ok: true, card: view(r.card), applied: r.applied / 100 });
    }
    if (act === 'void' || act === 'reactivate') {
      const c = await G.setStatus(code, act === 'void' ? 'void' : 'active');
      return c ? L.json(res, 200, { ok: true, card: view(c) }) : L.json(res, 404, { error: 'Not found.' });
    }
    if (act === 'resend') {
      const c = await G.get(code);
      if (!c || c.status !== 'active') return L.json(res, 400, { error: 'Only active cards can be emailed.' });
      const to = clip(b.email, 120).toLowerCase() || c.recipient.email;
      if (!EMAIL.test(to)) return L.json(res, 400, { error: 'Enter an email address to send it to.' });
      c.recipient.email = to;
      const r = await Mail.giftCard(c, Pay.origin(req));
      if (r.sent) { c.emailed = true; c.history.push({ at: new Date().toISOString(), event: 'Emailed to ' + to, cents: 0 }); await G.save(c); }
      return L.json(res, 200, { ok: true, emailed: r.sent, card: view(c) });
    }
    return L.json(res, 400, { error: 'Unknown action.' });
  } catch (e) { console.error('giftcards failed', e); return L.json(res, 500, { error: 'Something went wrong.' }); }
};
