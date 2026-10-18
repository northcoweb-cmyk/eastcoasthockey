'use strict';
const L = require('../_lib');

module.exports = function (req, res) {
  L.clearSession(res);
  return L.json(res, 200, { ok: true });
};
