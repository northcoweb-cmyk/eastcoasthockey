'use strict';
const L = require('./_lib');

module.exports = function (req, res) {
  const s = L.session(req);
  if (!s) return L.json(res, 401, { error: 'Signed out' });
  return L.json(res, 200, { user: s.u, persistent: L.hasBlob, testLogin: L.USING_TEST_LOGIN });
};
