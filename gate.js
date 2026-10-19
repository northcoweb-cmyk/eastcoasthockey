/* Private preview gate. While GATE_HASH is set, visitors must type the preview password before the page shows.
   This is a soft lock for a work-in-progress site (it keeps casual visitors out). Change or remove it with:
   node tools/set-gate.js "new password"      node tools/set-gate.js off */
(function () {
  var GATE_HASH = 'c5e591e7da102c6c5e0e4d266ef3d9e4aeea8555bd95a461726aee1bb57f6aa1';
  var SALT = 'ec-preview::';
  if (!GATE_HASH) return;
  var K = 'ec_preview_ok';
  try { if (sessionStorage.getItem(K) === GATE_HASH) return; } catch (e) { /* ask again */ }
  var root = document.documentElement;
  var st = document.createElement('style');
  st.textContent = 'html.gate-on body{visibility:hidden!important}html.gate-on{overflow:hidden}' +
    '#ecGate{position:fixed;inset:0;z-index:2147483647;display:grid;place-items:center;padding:20px;background:#f4f7fb;font-family:Outfit,system-ui,sans-serif;color:#041634;visibility:visible}' +
    '#ecGate form{background:#fff;border:1px solid #e1e7ef;border-radius:20px;padding:30px;width:min(400px,100%);text-align:center;box-shadow:0 30px 60px -34px rgba(4,22,52,.4)}' +
    '#ecGate img{height:78px;width:auto;margin-bottom:10px}#ecGate h1{font-size:22px;margin:0 0 6px}#ecGate p{margin:0 0 18px;color:#5a6b7c;font-size:15px;line-height:1.5}' +
    '#ecGate input{width:100%;min-height:46px;padding:10px 14px;border:1.5px solid #e1e7ef;border-radius:12px;font:inherit;font-size:16px;text-align:center;outline:0}' +
    '#ecGate input:focus{border-color:#2c6fc4}#ecGate button{margin-top:12px;width:100%;min-height:46px;border:0;border-radius:999px;background:#041634;color:#fff;font:inherit;font-weight:600;font-size:15px;cursor:pointer}' +
    '#ecGate .e{color:#b00816;font-size:13.5px;min-height:20px;margin-top:10px}';
  document.head.appendChild(st);
  root.classList.add('gate-on');
  var box = document.createElement('div');
  box.id = 'ecGate';
  box.innerHTML = '<form><img src="/assets/logo.webp" alt="East Coast Hockey &amp; Skating Supply"><h1>Private preview</h1>' +
    '<p>This website is almost ready. Enter the preview password to take a look.</p>' +
    '<input type="password" autocomplete="current-password" aria-label="Preview password" placeholder="Password" autofocus>' +
    '<button type="submit">View the site</button><div class="e" role="alert"></div></form>';
  root.appendChild(box);
  var f = box.querySelector('form'), inp = box.querySelector('input'), err = box.querySelector('.e');
  function hex(buf) { return Array.prototype.map.call(new Uint8Array(buf), function (b) { return ('0' + b.toString(16)).slice(-2); }).join(''); }
  f.addEventListener('submit', function (e) {
    e.preventDefault();
    if (!window.crypto || !crypto.subtle) { err.textContent = 'Please open this page over a secure connection.'; return; }
    crypto.subtle.digest('SHA-256', new TextEncoder().encode(SALT + inp.value.trim())).then(function (h) {
      if (hex(h) === GATE_HASH) {
        try { sessionStorage.setItem(K, GATE_HASH); } catch (x) { /* fine */ }
        root.classList.remove('gate-on'); box.remove();
      } else { err.textContent = 'That password is not right. Please try again.'; inp.select(); }
    });
  });
})();
