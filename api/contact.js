'use strict';
const crypto = require('crypto');
const L = require('./_lib');
const M = require('./_media');
const Mail = require('./_mail');

const hits = {};
function clip(v, n) { return typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f<>]/g, ' ').trim().slice(0, n) : ''; }
const TOPICS = ['Skate fitting or sizing', 'Sharpening, molding or repair', 'Gear or fitting question', 'Set up a team store', 'Team order help', 'Something else'];

/* Public contact form: saved for the admin and forwarded to the shop inbox(es) when email is configured. */
module.exports = async function (req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return L.json(res, 405, { error: 'Method not allowed' }); }
  if (!M.sameSite(req)) return L.json(res, 403, { error: 'Blocked request.' });
  const ip = L.clientIp(req), now = Date.now();
  hits[ip] = (hits[ip] || []).filter(function (t) { return now - t < 10 * 60 * 1000; });
  if (hits[ip].length >= 4) return L.json(res, 429, { error: 'Too many messages. Please call the shop.' });
  try {
    const b = await L.readBody(req, 10 * 1024);
    if (b.website) return L.json(res, 200, { ok: true });
    const m = { name: clip(b.name, 80), email: clip(b.email, 120).toLowerCase(), phone: clip(b.phone, 30), topic: TOPICS.indexOf(b.topic) >= 0 ? b.topic : 'Something else', message: clip(b.message, 3000) };
    if (m.name.length < 2) return L.json(res, 400, { error: 'Please enter your name.' });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(m.email)) return L.json(res, 400, { error: 'Please enter a valid email address.' });
    if (m.message.length < 5) return L.json(res, 400, { error: 'Please write a short message.' });
    const id = new Date().toISOString().replace(/[:.]/g, '-') + '-' + crypto.randomBytes(3).toString('hex');
    await L.store.put('messages/' + id + '.json', Object.assign({ id: id, createdAt: new Date().toISOString(), read: false }, m));
    hits[ip].push(now);
    Mail.contactAlert(m).catch(function () { /* never blocks the form */ });
    return L.json(res, 200, { ok: true });
  } catch (e) { console.error('contact failed', e); return L.json(res, 500, { error: 'We could not send your message. Please call the shop.' }); }
};
