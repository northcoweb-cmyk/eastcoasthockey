'use strict';
const L = require('./_lib');
const Pay = require('./_pay');
const G = require('./_gift');
const Mail = require('./_mail');

/* The payment provider calls this when a checkout is paid or expires. It is the only thing that marks an order paid
   or activates (and emails) a gift card. Requests are verified with the provider's signature. */
module.exports = async function (req, res) {
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
  const pay = Pay.active();
  if (!pay) { res.statusCode = 503; return res.end('Payments not configured'); }
  let ev;
  try { ev = pay.parseWebhook(await L.readRaw(req), req.headers); }
  catch (e) { console.error('[webhook] rejected:', e.message); res.statusCode = 400; return res.end('Bad signature'); }
  try {
    if (ev && ev.kind === 'giftcard') await giftcard(ev, pay, req);
    else if (ev && ev.kind === 'order') await order(ev, pay);
    res.statusCode = 200; res.setHeader('Content-Type', 'application/json'); res.end('{"received":true}');
  } catch (e) { console.error('[webhook] failed', e); res.statusCode = 500; res.end('Error'); }   /* the provider retries on a 500 */
};

async function giftcard(ev, pay, req) {
  const card = await G.get(ev.id);
  if (!card) return;
  if (ev.event === 'expired') { if (card.status === 'pending') await L.store.del('giftcards/' + card.code + '.json'); return; }
  if (ev.cents !== card.initialCents) { console.error('[webhook] gift card amount mismatch', card.code.slice(-4), ev.cents, card.initialCents); return; }
  const r = await G.activate(card.code, { provider: pay.name, sessionId: ev.sessionId });
  if (!r.first) return;
  const sent = await Mail.giftCard(r.card, Pay.origin(req));
  await Mail.giftReceipt(r.card); await Mail.giftAlert(r.card);
  r.card.emailed = !!sent.sent; await G.save(r.card);
}

async function order(ev, pay) {
  const p = 'orders/' + ev.id + '.json';
  const o = await L.store.get(p);
  if (!o) return;
  if (ev.event === 'expired') {
    if (o.payment.status === 'paid' || o.status === 'cancelled') return;
    o.status = 'cancelled'; o.payment.status = 'unpaid'; o.payment.note = 'Checkout expired or failed';
    o.history.push({ at: new Date().toISOString(), event: 'Checkout expired, order cancelled' });
    await G.restoreOrder(o); await L.store.put(p, o); return;
  }
  if (o.payment.status === 'paid') return;
  const due = Math.round((o.totals.total - (o.totals.giftCard || 0)) * 100);
  if (ev.cents !== due) { console.error('[webhook] order amount mismatch', ev.id, ev.cents, due); o.payment.note = 'Paid amount differs from the order total. Check the processor.'; }
  o.payment = { status: 'paid', method: 'card', note: o.payment.note || '', provider: pay.name, sessionId: ev.sessionId, paidAt: new Date().toISOString() };
  if (o.status === 'cancelled') o.status = 'new';
  o.history.push({ at: o.payment.paidAt, event: 'Payment received online' });
  await L.store.put(p, o);
  await Promise.all([Mail.orderReceived(o), Mail.orderAlert(o)]);
}
