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
    const r = await fetch('https://api.resend.com/emails', {
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
  return o.items.map(itemLine).join('\n') + '\n\nSubtotal: ' + money(t.subtotal) + '\nTax: ' + money(t.tax) + '\nShipping: ' + money(t.shipping) + '\nTotal: ' + money(t.total) +
    '\n\n' + (o.fulfillment === 'ship' ? 'Ship to: ' + [o.shipping.name, o.shipping.address1, o.shipping.address2, o.shipping.city + ', ' + o.shipping.state + ' ' + o.shipping.zip].filter(Boolean).join(', ') : 'Pickup: ' + o.pickupShop);
}
function summaryHtml(o) {
  const t = o.totals;
  return '<ul>' + o.items.map(function (i) { return '<li>' + esc(itemLine(i)) + '</li>'; }).join('') + '</ul>' +
    '<p>Subtotal ' + money(t.subtotal) + ' &middot; Tax ' + money(t.tax) + ' &middot; Shipping ' + money(t.shipping) + '<br><strong>Total ' + money(t.total) + '</strong></p>' +
    '<p>' + esc(o.fulfillment === 'ship' ? 'Ship to: ' + [o.shipping.name, o.shipping.address1, o.shipping.address2, o.shipping.city + ', ' + o.shipping.state + ' ' + o.shipping.zip].filter(Boolean).join(', ') : 'Pickup: ' + o.pickupShop) + '</p>';
}
const ref = function (o) { return '#' + o.id.slice(-6).toUpperCase(); };

function orderReceived(o) {
  return send({ to: o.contact.email, replyTo: NOTIFY[0], subject: 'We received your team order ' + ref(o),
    text: 'Hi ' + o.contact.name + ',\n\nThanks for your team order (' + ref(o) + '). Nothing has been charged yet. We will contact you to confirm the details and arrange payment.\n\n' + summaryText(o) + '\n\nEast Coast Hockey & Skating Supply',
    html: '<p>Hi ' + esc(o.contact.name) + ',</p><p>Thanks for your team order <strong>' + ref(o) + '</strong>. Nothing has been charged yet. We will contact you to confirm the details and arrange payment.</p>' + summaryHtml(o) + '<p>East Coast Hockey &amp; Skating Supply</p>' });
}
function orderAlert(o) {
  return send({ to: NOTIFY, replyTo: o.contact.email, subject: 'New team order ' + ref(o) + ' - ' + o.contact.name,
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
module.exports = { configured, send, orderReceived, orderAlert, statusUpdate, contactAlert, itemLine };
