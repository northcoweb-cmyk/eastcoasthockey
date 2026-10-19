'use strict';
const L = require('../_lib');
const Pay = require('../_pay');
const G = require('../_gift');

/* Public: tells the page whether online payment and gift cards are switched on. */
module.exports = async function (req, res) {
  const p = Pay.active();
  let gift = false;
  try { gift = !!(p && (await L.getContent()).store.giftEnabled); } catch (e) { /* off */ }
  try { if ((await L.getContent()).store.mode !== 'direct') { gift = false; } } catch (e) { /* default */ }
  res.setHeader('Cache-Control', 'public, max-age=0, s-maxage=30, stale-while-revalidate=120');
  res.statusCode = 200; res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ payments: !!p, giftcards: gift, giftMin: G.MIN, giftMax: G.MAX }));
};
