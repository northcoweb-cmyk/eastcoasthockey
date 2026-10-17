/* Keeps the visible address/phone and the structured data (JSON-LD) in step with what the owner saves in the admin.
   The static HTML is the baseline; this only adjusts it when the saved content differs. */
(function () {
  'use strict';
  var CITY = { 'Laurel': 'Laurel', 'Rockville': 'Rockville', 'Piney Orchard': 'Odenton' };
  fetch('/api/content', { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : null; }).then(function (c) {
    if (!c || !c.locations) return;
    var scripts = [].slice.call(document.querySelectorAll('script[type="application/ld+json"]'));
    var docs = scripts.map(function (s) { try { return JSON.parse(s.textContent); } catch (e) { return null; } });
    c.locations.forEach(function (l) {
      [].slice.call(document.querySelectorAll('[data-loc="' + l.n + '"]')).forEach(function (e) {
        var f = e.getAttribute('data-f');
        if (f === 'addr') e.textContent = l.a;
        else if (f === 'phone') e.textContent = l.p;
        else if (f === 'tel') e.setAttribute('href', 'tel:' + l.tel);
      });
      var m = /^(.*?),\s*([^,]+),\s*([A-Za-z]{2})\s+(\d{5})/.exec(l.a || '');
      docs.forEach(function (d) {
        if (!d || !d['@graph']) return;
        d['@graph'].forEach(function (n) {
          if (n['@type'] !== 'SportingGoodsStore' || !n.address) return;
          var base = CITY[l.n];
          if (n.address.addressLocality !== base && n.address._synced !== l.n) return;
          n.telephone = l.tel;
          if (m) { n.address.streetAddress = m[1]; n.address.addressLocality = m[2]; n.address.addressRegion = m[3].toUpperCase(); n.address.postalCode = m[4]; }
          n.address._synced = l.n;
        });
      });
    });
    scripts.forEach(function (s, i) {
      if (!docs[i]) return;
      (docs[i]['@graph'] || []).forEach(function (n) { if (n.address) delete n.address._synced; });
      s.textContent = JSON.stringify(docs[i]);
    });
  }).catch(function () { /* keep the static markup */ });
})();
