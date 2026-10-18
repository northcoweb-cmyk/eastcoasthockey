/* Builds and flips the gift card. ecGiftCard(el, {amount:'$50.00', code:'XXXX-XXXX-XXXX', sample:true|false}) */
(function () {
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  var SAMPLE = 'EXAMPLE22222';
  window.ecGiftCard = function (el, o) {
    var raw = o.sample ? SAMPLE : String(o.code || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    var shown = o.sample ? 'XXXX-XXXX-XXXX' : raw.slice(0, 4) + '-' + raw.slice(4, 8) + '-' + raw.slice(8);
    el.className = 'gcf'; el.setAttribute('tabindex', '0'); el.setAttribute('role', 'button'); el.setAttribute('aria-pressed', 'false');
    el.setAttribute('aria-label', 'Gift card. Press to turn it over.');
    el.innerHTML =
      '<div class="gcf-in">' +
      '<div class="gcf-face gcf-front"><img class="lg" src="assets/logo.webp" alt="East Coast Hockey &amp; Skating Supply">' +
      '<div class="bot"><div class="ttl">Gift card</div><div class="amt" data-amt>' + esc(o.amount || '') + '</div>' +
      '<div class="dom"><b>EAST COAST</b> HOCKEY &amp; SKATING</div>' +
      '<div class="soc" aria-hidden="true"><i class="ti ti-brand-facebook-filled"></i><i class="ti ti-brand-instagram"></i><i class="ti ti-brand-x"></i></div></div></div>' +
      '<div class="gcf-face gcf-back"><div class="hd"><div><h3>Gift card</h3><div class="dom"><b>eastcoast</b>hockeyandskating.com</div></div><img class="lg" src="assets/logo.webp" alt=""></div>' +
      '<p class="tx">Use this card at any East Coast Hockey &amp; Skating Supply shop, or enter the code at checkout in our online team stores. ' +
      'Treat it like cash. Show the barcode below to a team member to pay, or read them the code.</p>' +
      '<div class="bc"><img src="/api/barcode?s=2&c=' + raw + '" alt="Gift card barcode" width="187" height="40"><div class="cd">' + shown + '</div>' + (o.sample ? '<div class="sm">Sample. Yours arrives by email</div>' : '') + '</div></div>' +
      '</div>';
    function flip() { var f = el.classList.toggle('flip'); el.setAttribute('aria-pressed', f ? 'true' : 'false'); }
    el.addEventListener('click', flip);
    el.addEventListener('keydown', function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); flip(); } });
    return { setAmount: function (t) { var a = el.querySelector('[data-amt]'); if (a) a.textContent = t || ''; } };
  };
})();
