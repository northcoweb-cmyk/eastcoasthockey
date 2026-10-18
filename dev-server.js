/* Local preview: serves the site and runs the /api handlers the same way Vercel does.
   Usage: node dev-server.js [port]. Not used in production. */
const http = require('http');
const fs = require('fs');
const path = require('path');
const port = +process.argv[2] || 3000;
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.json': 'application/json', '.css': 'text/css', '.webp': 'image/webp', '.png': 'image/png', '.jpg': 'image/jpeg', '.mp4': 'video/mp4', '.svg': 'image/svg+xml' };
const rewrites = (JSON.parse(fs.readFileSync(path.join(__dirname, 'vercel.json'), 'utf8')).rewrites || []);
http.createServer(function (req, res) {
  let u = new URL(req.url, 'http://x');
  const rw = rewrites.filter(function (r) { return r.source === u.pathname; })[0];
  if (rw) { const d = new URL(rw.destination, 'http://x'); u.searchParams.forEach(function (v, k) { d.searchParams.append(k, v); }); u = d; req.url = d.pathname + d.search; }
  const p = decodeURIComponent(u.pathname);
  if (p.startsWith('/api/')) {
    const name = p.slice(5).replace(/[^a-z]/g, '');
    const f = path.join(__dirname, 'api', name + '.js');
    if (!name || !fs.existsSync(f)) { res.statusCode = 404; return res.end('Not found'); }
    return require(f)(req, res);
  }
  let file = path.join(__dirname, p === '/' ? 'index.html' : p);
  if (!file.startsWith(__dirname)) { res.statusCode = 403; return res.end(); }
  if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
  else if (!fs.existsSync(file) && fs.existsSync(file + '.html')) file += '.html';
  if (!fs.existsSync(file)) { res.statusCode = 404; return res.end('Not found'); }
  res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
  fs.createReadStream(file).pipe(res);
}).listen(port, function () { console.log('http://localhost:' + port); });
