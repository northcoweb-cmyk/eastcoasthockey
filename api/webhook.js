'use strict';
const L = require('./_lib');
const Pay = require('./_pay');
const G = require('./_gift');
const Mail = require('./_mail');

/* The payment provider calls this when a checkout is paid or expires. It is the only thing that marks an order paid
   or activates (and emails) a gift card. Requests are verified with the provider's signature. */
module.exports = async function (req, res) {
  const pay = Pay.active();
  if (pay && pay.name === 'test') return testPage(req, res, pay);
  if (req.method !== 'POST') { res.statusCode = 405; return res.end(); }
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

/* the fake payment page for PAYMENT_PROVIDER=test */
async function testPage(req, res, pay) {
  const q = new URL(req.url, 'http://x').searchParams;
  let t; try { t = JSON.parse(Buffer.from(q.get('t') || '', 'base64url').toString()); } catch (e) { res.statusCode = 400; return res.end('Bad link'); }
  const esc = function (s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };
  if (req.method === 'POST') {
    const raw = await L.readRaw(req, 4096);
    const go = new URLSearchParams(raw).get('go');
    if (go === 'pay') {
      const ev = { event: 'paid', kind: t.kind, id: t.id, cents: t.cents, sessionId: 'test_' + Date.now() };
      if (t.kind === 'giftcard') await giftcard(ev, pay, req); else await order(ev, pay);
      res.statusCode = 303; res.setHeader('Location', t.ok); return res.end();
    }
    if (go === 'cancel' && t.kind === 'order') await order({ event: 'expired', kind: 'order', id: t.id, cents: t.cents, sessionId: 'test' }, pay);
    if (go === 'cancel' && t.kind === 'giftcard') await giftcard({ event: 'expired', kind: 'giftcard', id: t.id, cents: t.cents }, pay, req);
    res.statusCode = 303; res.setHeader('Location', t.no); return res.end();
  }
  res.statusCode = 200; res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.setHeader('Cache-Control', 'no-store'); res.setHeader('X-Robots-Tag', 'noindex');
  res.end('<!doctype html><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Test payment</title><body style="font-family:system-ui,sans-serif;background:#f4f7fb;margin:0;display:grid;place-items:center;min-height:100vh"><form method="post" style="background:#fff;border:1px solid #e1e7ef;border-radius:18px;padding:30px;width:min(420px,92vw);text-align:center">' +
    '<div style="background:#fff3d6;color:#8a6100;font-weight:700;font-size:12px;letter-spacing:.1em;text-transform:uppercase;padding:7px;border-radius:8px;margin-bottom:18px">Test mode - no real money</div>' +
    '<h1 style="font-size:20px;margin:0 0 6px">' + esc(t.label) + '</h1><p style="font-size:34px;font-weight:800;margin:8px 0 22px">$' + (t.cents / 100).toFixed(2) + '</p>' +
    '<button name="go" value="pay" style="width:100%;padding:14px;border:0;border-radius:999px;background:#E00A1E;color:#fff;font-weight:700;font-size:16px;cursor:pointer">Pay (simulated)</button>' +
    '<button name="go" value="cancel" style="width:100%;margin-top:10px;padding:12px;border:1.5px solid #e1e7ef;border-radius:999px;background:#fff;font-weight:600;font-size:15px;cursor:pointer">Cancel</button></form>');
}
