'use strict';
const L = require('./_lib');

module.exports = async function (req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return L.json(res, 405, { error: 'Method not allowed' }); }
  const ip = L.clientIp(req);
  if (L.throttled(ip)) return L.json(res, 429, { error: 'Too many attempts. Wait a minute and try again.' });
  try {
    const b = await L.readBody(req, 4096);
    if (L.checkLogin(b.username, b.password)) {
      L.clearFails(ip);
      L.setSession(res, String(b.username).trim());
      return L.json(res, 200, { ok: true });
    }
    L.noteFail(ip);
    return L.json(res, 401, { error: 'Wrong username or password.' });
  } catch (e) { return L.json(res, 400, { error: 'Bad request' }); }
};
