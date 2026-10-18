'use strict';
const L = require('../_lib');

module.exports = async function (req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return L.json(res, 405, { error: 'Method not allowed' }); }
  const ip = L.clientIp(req);
  try {
    /* locked addresses are refused before the password is even checked */
    const mins = await L.lockedMinutes(ip);
    if (mins) return L.json(res, 429, { error: 'Too many wrong attempts. This device is locked out for about ' + (mins > 1 ? mins + ' more minutes' : 'a minute') + '.', locked: true });
    const b = await L.readBody(req, 4096);
    if (L.checkLogin(b.username, b.password)) {
      await L.clearFails(ip);
      L.setSession(res, String(b.username).trim());
      return L.json(res, 200, { ok: true });
    }
    const r = await L.noteFail(ip);
    if (r.locked) return L.json(res, 429, { error: 'Too many wrong attempts. This device is locked out for 1 hour.', locked: true });
    return L.json(res, 401, { error: 'Wrong username or password. ' + r.left + (r.left === 1 ? ' attempt' : ' attempts') + ' left before a 1 hour lockout.' });
  } catch (e) { console.error('login failed', e); return L.json(res, 400, { error: 'Bad request' }); }
};
