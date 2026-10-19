'use strict';
const L = require('../_lib');
const M = require('../_media');
const G = require('../_gift');
const Pay = require('../_pay');

const buys = {}, checks = {};
function clip(v, n) { return typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/g, ' ').trim().slice(0, n) : ''; }
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const recent = function (map, ip, mins) { const now = Date.now(); map[ip] = (map[ip] || []).filter(function (t) { return now - t < mins * 60000; }); return map[ip]; };

/* Public.
   GET  ?code=XXXX-XXXX-XXXX   balance check (card page)
   POST                        buy a gift card: creates it unpaid, then sends the buyer to the payment page.
                               It is only activated and emailed after the payment provider confirms payment (api/webhook). */
module.exports = async function (req, res) {
  if (!M.sameSite(req)) return L.json(res, 403, { error: 'Blocked request.' });
  const ip = L.clientIp(req);
  try {
    if (req.method === 'GET') {
      if (recent(checks, ip, 10).length >= 15) return L.json(res, 429, { error: 'Too many tries. Please wait a few minutes.' });
      checks[ip].push(Date.now());
      const code = G.norm(new URL(req.url, 'http://x').searchParams.get('code'));
      const c = await G.get(code);
      if (!c || c.status !== 'active') return L.json(res, 404, { error: 'We could not find an active gift card with that code.' });
      return L.json(res, 200, { ok: true, balance: c.balanceCents / 100, initial: c.initialCents / 100 });
    }
    if (req.method !== 'POST') { res.setHeader('Allow', 'GET, POST'); return L.json(res, 405, { error: 'Method not allowed' }); }
    const pay = Pay.active();
    const content = await L.getContent();
    if (content.store.mode !== 'direct') return L.json(res, 410, { error: 'Gift cards are sold on our online store.' });
    if (!pay || !content.store.giftEnabled) return L.json(res, 503, { error: 'Online gift cards are not available yet. Please visit any shop.' });
    if (recent(buys, ip, 10).length >= 6) return L.json(res, 429, { error: 'Too many attempts. Please call the shop.' });
    const b = await L.readBody(req, 8 * 1024);
    if (b.website) return L.json(res, 200, { ok: true });
    const dollars = Number(b.amount);
    if (!Number.isInteger(dollars) || dollars < G.MIN || dollars > G.MAX) return L.json(res, 400, { error: 'Choose an amount from $' + G.MIN + ' to $' + G.MAX + '.' });
    const buyer = { name: clip(b.buyerName, 80), email: clip(b.buyerEmail, 120).toLowerCase() };
    if (buyer.name.length < 2) return L.json(res, 400, { error: 'Please enter your name.' });
    if (!EMAIL.test(buyer.email)) return L.json(res, 400, { error: 'Please enter your email address.' });
    const toMe = b.deliver === 'me';
    const recipient = toMe ? { name: buyer.name, email: buyer.email } : { name: clip(b.recipientName, 80), email: clip(b.recipientEmail, 120).toLowerCase() };
    if (!EMAIL.test(recipient.email)) return L.json(res, 400, { error: 'Please enter the recipient’s email address.' });
    const card = await G.create({ cents: dollars * 100, status: 'pending', source: 'online', buyer: buyer, recipient: recipient, from: toMe ? '' : buyer.name, message: clip(b.message, 300) });
    try {
      const base = Pay.origin(req);
      const s = await pay.createCheckout({ kind: 'giftcard', id: card.code, email: buyer.email, description: 'East Coast Hockey gift card',
        lines: [{ name: 'East Coast Hockey & Skating Supply gift card', description: 'Delivered by email', cents: dollars * 100, qty: 1 }],
        successUrl: base + '/?checkout=gift', cancelUrl: base + '/?checkout=cancel#gift' });
      card.payment = { provider: pay.name, sessionId: s.sessionId }; await G.save(card);
      buys[ip].push(Date.now());
      return L.json(res, 200, { ok: true, url: s.url });
    } catch (e) {
      await L.store.del('giftcards/' + card.code + '.json');
      return L.json(res, 502, { error: 'We could not start the payment. Please try again or visit a shop.' });
    }
  } catch (e) { console.error('giftcard failed', e); return L.json(res, 500, { error: 'Something went wrong. Please try again.' }); }
};
