'use strict';
/* Transactional email through Resend (https://resend.com). Optional: nothing is sent until these are set in Vercel:
   RESEND_API_KEY, MAIL_FROM (e.g. "East Coast Hockey <orders@eastcoasthockeyandskating.com>" - the domain must be
   verified in Resend), and SHOP_NOTIFY_TO (comma-separated inboxes that get new-order and contact alerts). */
const KEY = process.env.RESEND_API_KEY || '';
const FROM = process.env.MAIL_FROM || '';
const NOTIFY = (process.env.SHOP_NOTIFY_TO || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
const configured = !!(KEY && FROM);

function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }

async function send(opt) {
  if (!configured) { console.log('[mail] not configured, skipped:', opt.subject); return { sent: false, reason: 'not configured' }; }
  const to = [].concat(opt.to).filter(Boolean);
  if (!to.length) return { sent: false, reason: 'no recipient' };
  try {
    const r = await fetch((process.env.MAIL_API_BASE || 'https://api.resend.com') + '/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: FROM, to: to, subject: opt.subject, html: opt.html, text: opt.text, reply_to: opt.replyTo || undefined })
    });
    if (!r.ok) { console.error('[mail] failed', r.status, await r.text().catch(function () { return ''; })); return { sent: false, reason: 'provider error ' + r.status }; }
    return { sent: true };
  } catch (e) { console.error('[mail] error', e); return { sent: false, reason: 'network' }; }
}

function money(n) { return '$' + Number(n).toFixed(2); }
function itemLine(i) {
  const who = [i.first, i.last].filter(Boolean).join(' ') + (i.num ? ' #' + i.num : '');
  return i.qty + ' x ' + i.team + ' - ' + i.name + (i.size ? ' (' + i.size + ')' : '') + (who ? ' - ' + who : '') + ' - ' + money(i.price * i.qty);
}
function summaryText(o) {
  const t = o.totals;
  return o.items.map(itemLine).join('\n') + '\n\nSubtotal: ' + money(t.subtotal) + '\nTax: ' + money(t.tax) + '\nShipping: ' + money(t.shipping) + '\nTotal: ' + money(t.total) + (t.giftCard ? '\nGift card: -' + money(t.giftCard) + '\nPaid by card: ' + money(t.due) : '') +
    '\n\n' + (o.fulfillment === 'ship' ? 'Ship to: ' + [o.shipping.name, o.shipping.address1, o.shipping.address2, o.shipping.city + ', ' + o.shipping.state + ' ' + o.shipping.zip].filter(Boolean).join(', ') : 'Pickup: ' + o.pickupShop);
}
function summaryHtml(o) {
  const t = o.totals;
  return '<ul>' + o.items.map(function (i) { return '<li>' + esc(itemLine(i)) + '</li>'; }).join('') + '</ul>' +
    '<p>Subtotal ' + money(t.subtotal) + ' &middot; Tax ' + money(t.tax) + ' &middot; Shipping ' + money(t.shipping) + '<br><strong>Total ' + money(t.total) + '</strong>' + (t.giftCard ? '<br>Gift card -' + money(t.giftCard) + '<br>Paid by card ' + money(t.due) : '') + '</p>' +
    '<p>' + esc(o.fulfillment === 'ship' ? 'Ship to: ' + [o.shipping.name, o.shipping.address1, o.shipping.address2, o.shipping.city + ', ' + o.shipping.state + ' ' + o.shipping.zip].filter(Boolean).join(', ') : 'Pickup: ' + o.pickupShop) + '</p>';
}
const paid = function (o) { return o.payment && o.payment.status === 'paid'; };
const ref = function (o) { return '#' + o.id.slice(-6).toUpperCase(); };

function orderReceived(o) {
  return send({ to: o.contact.email, replyTo: NOTIFY[0], subject: 'We received your team order ' + ref(o),
    text: 'Hi ' + o.contact.name + ',\n\nThanks for your team order (' + ref(o) + '). ' + (paid(o) ? 'Your payment went through. We will email you when it is ready.' : 'Nothing has been charged yet. We will contact you to confirm the details and arrange payment.') + '\n\n' + summaryText(o) + '\n\nEast Coast Hockey & Skating Supply',
    html: '<p>Hi ' + esc(o.contact.name) + ',</p><p>Thanks for your team order <strong>' + ref(o) + '</strong>. ' + (paid(o) ? 'Your payment went through. We will email you when it is ready.' : 'Nothing has been charged yet. We will contact you to confirm the details and arrange payment.') + '</p>' + summaryHtml(o) + '<p>East Coast Hockey &amp; Skating Supply</p>' });
}
function orderAlert(o) {
  return send({ to: NOTIFY, replyTo: o.contact.email, subject: (paid(o) ? 'PAID team order ' : 'New team order ') + ref(o) + ' - ' + o.contact.name,
    text: 'New team order ' + ref(o) + '\n' + o.contact.name + ' | ' + o.contact.email + ' | ' + (o.contact.phone || 'no phone') + '\n\n' + summaryText(o) + (o.contact.notes ? '\n\nNotes: ' + o.contact.notes : ''),
    html: '<p><strong>New team order ' + ref(o) + '</strong><br>' + esc(o.contact.name) + ' &middot; ' + esc(o.contact.email) + ' &middot; ' + esc(o.contact.phone || 'no phone') + '</p>' + summaryHtml(o) + (o.contact.notes ? '<p>Notes: ' + esc(o.contact.notes) + '</p>' : '') });
}
function statusUpdate(o) {
  const t = o.tracking && o.tracking.number ? '\nTracking: ' + (o.tracking.carrier ? o.tracking.carrier + ' ' : '') + o.tracking.number : '';
  const msg = o.status === 'ready' ? 'Your order ' + ref(o) + ' is ready for pickup at ' + o.pickupShop + '.' : o.status === 'shipped' ? 'Your order ' + ref(o) + ' has shipped.' + t : null;
  if (!msg) return Promise.resolve({ sent: false });
  return send({ to: o.contact.email, replyTo: NOTIFY[0], subject: 'Order ' + ref(o) + ' update', text: 'Hi ' + o.contact.name + ',\n\n' + msg + '\n\nEast Coast Hockey & Skating Supply', html: '<p>Hi ' + esc(o.contact.name) + ',</p><p>' + esc(msg).replace(/\n/g, '<br>') + '</p><p>East Coast Hockey &amp; Skating Supply</p>' });
}
function contactAlert(m) {
  return send({ to: NOTIFY, replyTo: m.email, subject: 'Website message: ' + (m.topic || 'General') + ' - ' + m.name,
    text: m.name + ' | ' + m.email + ' | ' + (m.phone || 'no phone') + '\nTopic: ' + (m.topic || 'General') + '\n\n' + m.message,
    html: '<p><strong>' + esc(m.name) + '</strong> &middot; ' + esc(m.email) + ' &middot; ' + esc(m.phone || 'no phone') + '<br>Topic: ' + esc(m.topic || 'General') + '</p><p>' + esc(m.message).replace(/\n/g, '<br>') + '</p>' });
}

/* ---- gift cards ---- */
const pretty = function (c) { return c.slice(0, 4) + '-' + c.slice(4, 8) + '-' + c.slice(8); };
function giftHtml(c, base) {
  const amt = money(c.initialCents / 100);
  return '<div style="max-width:520px;margin:0 auto;font-family:Arial,Helvetica,sans-serif;color:#0b1f3a">' +
    '<div style="background:#0b1f3a;color:#fff;border-radius:14px 14px 0 0;padding:26px 28px"><div style="font-size:12px;letter-spacing:.14em;text-transform:uppercase;opacity:.7">East Coast Hockey &amp; Skating Supply</div><div style="font-size:34px;font-weight:800;margin-top:6px">' + amt + ' gift card</div></div>' +
    '<div style="border:1px solid #dfe5ee;border-top:0;border-radius:0 0 14px 14px;padding:26px 28px;background:#fff">' +
    (c.recipient.name ? '<p style="margin:0 0 6px;font-size:16px">Hi ' + esc(c.recipient.name) + ',</p>' : '') +
    '<p style="margin:0 0 16px;font-size:15px;line-height:1.5">' + (c.from ? '<strong>' + esc(c.from) + '</strong> sent you a gift card.' : 'Here is your gift card.') + '</p>' +
    (c.message ? '<blockquote style="margin:0 0 18px;padding:12px 16px;background:#f4f7fb;border-left:3px solid #d71920;font-size:15px;line-height:1.5">' + esc(c.message).replace(/\n/g, '<br>') + '</blockquote>' : '') +
    '<div style="text-align:center;padding:18px;border:1.5px dashed #b9c4d3;border-radius:12px"><div style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;color:#5b6b80">Gift card code</div>' +
    '<div style="font-size:26px;font-weight:800;letter-spacing:.08em;margin:6px 0 12px;font-family:Consolas,Menlo,monospace">' + pretty(c.code) + '</div>' +
    '<img src="' + base + '/api/barcode?c=' + c.code + '" alt="Gift card barcode" width="374" height="80" style="display:block;margin:0 auto;max-width:100%;background:#fff"></div>' +
    '<p style="margin:18px 0 0;font-size:14px;line-height:1.55;color:#33435a"><strong>How to use it:</strong> show this email at any of our three shops and we will scan the barcode, or enter the code at checkout in our online team stores. Keep this email like cash.</p>' +
    '<p style="margin:14px 0 0;font-size:13px;color:#5b6b80">Questions? Reply to this email or call the shop.</p></div></div>';
}
function giftText(c) {
  return money(c.initialCents / 100) + ' gift card - East Coast Hockey & Skating Supply\n\n' + (c.recipient.name ? 'Hi ' + c.recipient.name + ',\n\n' : '') + (c.from ? c.from + ' sent you a gift card.\n\n' : '') + (c.message ? c.message + '\n\n' : '') +
    'Gift card code: ' + pretty(c.code) + '\n\nShow this email at any of our three shops and we will scan it, or enter the code at checkout in our online team stores. Keep this email like cash.';
}
function giftCard(c, base) {
  return send({ to: c.recipient.email, replyTo: NOTIFY[0], subject: (c.from ? c.from + ' sent you' : 'Your') + ' a ' + money(c.initialCents / 100) + ' East Coast Hockey gift card', text: giftText(c), html: giftHtml(c, base) });
}
function giftReceipt(c) {
  const same = c.buyer.email && c.buyer.email === c.recipient.email;
  if (!c.buyer.email || same) return Promise.resolve({ sent: false });
  return send({ to: c.buyer.email, replyTo: NOTIFY[0], subject: 'Your gift card purchase - ' + money(c.initialCents / 100),
    text: 'Thanks for your purchase. Your ' + money(c.initialCents / 100) + ' gift card was emailed to ' + c.recipient.email + '.\n\nEast Coast Hockey & Skating Supply',
    html: '<p>Thanks for your purchase.</p><p>Your <strong>' + money(c.initialCents / 100) + '</strong> gift card was emailed to <strong>' + esc(c.recipient.email) + '</strong>.</p><p>East Coast Hockey &amp; Skating Supply</p>' });
}
function giftAlert(c) {
  return send({ to: NOTIFY, subject: 'Gift card sold ' + money(c.initialCents / 100) + ' - ' + (c.buyer.name || c.buyer.email),
    text: 'Online gift card sold: ' + money(c.initialCents / 100) + '\nBuyer: ' + c.buyer.name + ' <' + c.buyer.email + '>\nSent to: ' + c.recipient.email + '\nCode ending ' + c.code.slice(-4),
    html: '<p><strong>Online gift card sold: ' + money(c.initialCents / 100) + '</strong><br>Buyer: ' + esc(c.buyer.name) + ' &lt;' + esc(c.buyer.email) + '&gt;<br>Sent to: ' + esc(c.recipient.email) + '<br>Code ending ' + esc(c.code.slice(-4)) + '</p>' });
}
module.exports = { giftCard, giftReceipt, giftAlert, configured, send, orderReceived, orderAlert, statusUpdate, contactAlert, itemLine };
