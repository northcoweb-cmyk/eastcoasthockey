'use strict';
/* Payments, kept behind one small interface so the processor can be swapped without touching the store or gift cards.

   A provider implements:
     configured                         true when its keys are present
     createCheckout(o)                  -> { url, sessionId }  o = { kind, id, email, lines:[{name,description,cents,qty}], successUrl, cancelUrl, description }
     parseWebhook(rawBody, headers)     -> { event:'paid'|'expired', kind, id, cents, sessionId } | null   (throws if the signature is bad)

   Stripe (hosted Checkout) is built in. Set in Vercel:  STRIPE_SECRET_KEY  and  STRIPE_WEBHOOK_SECRET.
   To use another processor (Square, PayPal, Clover...), add one provider object below and set PAYMENT_PROVIDER=<name>.
   Nothing else in the site changes: orders and gift cards only ever call createCheckout() and react to parseWebhook(). */
const crypto = require('crypto');

const form = function (obj) {
  const out = [];
  (function walk(prefix, v) {
    if (v === undefined || v === null) return;
    if (Array.isArray(v)) v.forEach(function (x, i) { walk(prefix + '[' + i + ']', x); });
    else if (typeof v === 'object') Object.keys(v).forEach(function (k) { walk(prefix ? prefix + '[' + k + ']' : k, v[k]); });
    else out.push(encodeURIComponent(prefix) + '=' + encodeURIComponent(String(v)));
  })('', obj);
  return out.join('&');
};

const stripe = {
  name: 'stripe',
  get configured() { return !!process.env.STRIPE_SECRET_KEY; },
  get base() { return process.env.STRIPE_API_BASE || 'https://api.stripe.com'; },
  async createCheckout(o) {
    const params = {
      mode: 'payment',
      success_url: o.successUrl, cancel_url: o.cancelUrl,
      customer_email: o.email || undefined,
      client_reference_id: o.id,
      metadata: { kind: o.kind, id: o.id },
      payment_intent_data: { description: o.description || undefined, metadata: { kind: o.kind, id: o.id } },
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
      line_items: o.lines.map(function (l) {
        return { quantity: l.qty || 1, price_data: { currency: 'usd', unit_amount: l.cents, product_data: { name: l.name.slice(0, 120), description: l.description ? l.description.slice(0, 300) : undefined } } };
      })
    };
    const r = await fetch(this.base + '/v1/checkout/sessions', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + process.env.STRIPE_SECRET_KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form(params)
    });
    const j = await r.json().catch(function () { return {}; });
    if (!r.ok || !j.url) { console.error('[pay] stripe error', r.status, j && j.error && j.error.message); throw new Error('Payment provider error'); }
    return { url: j.url, sessionId: j.id };
  },
  parseWebhook(raw, headers) {
    const secret = process.env.STRIPE_WEBHOOK_SECRET || '';
    const sig = String(headers['stripe-signature'] || '');
    const t = (sig.match(/(?:^|,)t=(\d+)/) || [])[1];
    const v1 = sig.split(',').filter(function (p) { return p.indexOf('v1=') === 0; }).map(function (p) { return p.slice(3); });
    if (!secret || !t || !v1.length) throw new Error('missing signature');
    if (Math.abs(Date.now() / 1000 - Number(t)) > 300) throw new Error('stale signature');
    const want = crypto.createHmac('sha256', secret).update(t + '.' + raw).digest('hex');
    const ok = v1.some(function (s) { return s.length === want.length && crypto.timingSafeEqual(Buffer.from(s), Buffer.from(want)); });
    if (!ok) throw new Error('bad signature');
    const ev = JSON.parse(raw), s = ev.data && ev.data.object;
    if (!s || s.object !== 'checkout.session') return null;
    const meta = s.metadata || {};
    if (!meta.kind || !meta.id) return null;
    if (ev.type === 'checkout.session.completed' || ev.type === 'checkout.session.async_payment_succeeded') {
      if (s.payment_status !== 'paid') return null;     /* delayed methods report paid later */
      return { event: 'paid', kind: meta.kind, id: meta.id, cents: s.amount_total, sessionId: s.id };
    }
    if (ev.type === 'checkout.session.expired' || ev.type === 'checkout.session.async_payment_failed') return { event: 'expired', kind: meta.kind, id: meta.id, cents: s.amount_total, sessionId: s.id };
    return null;
  }
};

/* TEST provider: a fake hosted payment page so the whole buying flow can be tried with no processor and no real money.
   Only active when PAYMENT_PROVIDER=test. Never leave this on in production. */
const test = {
  name: 'test',
  get configured() { return process.env.PAYMENT_PROVIDER === 'test'; },
  async createCheckout(o) {
    const cents = o.lines.reduce(function (n, l) { return n + l.cents * (l.qty || 1); }, 0);
    const t = Buffer.from(JSON.stringify({ kind: o.kind, id: o.id, cents: cents, ok: o.successUrl, no: o.cancelUrl, label: o.description || 'Order' })).toString('base64url');
    const base = o.successUrl.split('/?')[0];
    return { url: base + '/api/webhook?t=' + t, sessionId: 'test_' + require('crypto').randomBytes(6).toString('hex') };
  }
};
const providers = { stripe: stripe, test: test };
function active() {
  const want = (process.env.PAYMENT_PROVIDER || '').toLowerCase();
  const p = want ? providers[want] : (stripe.configured ? stripe : null);
  return p && p.configured ? p : null;
}
function origin(req) {
  if (process.env.SITE_URL) return process.env.SITE_URL.replace(/\/+$/, '');
  const proto = String(req.headers['x-forwarded-proto'] || 'https').split(',')[0];
  return proto + '://' + req.headers.host;
}
module.exports = { active: active, origin: origin, providers: providers };
