'use strict';
/* Shared helpers for the admin API: auth, storage and input cleaning. */
const crypto = require('crypto');
const fs = require('fs');
const os = require('os');
const path = require('path');
const DEFAULTS = require('./defaults.json');

const COOKIE = 'ec_admin';
const SESSION_HOURS = 12;

/* ---- credentials -------------------------------------------------------
   TEST PROFILE: Mike / 1234. In production set ADMIN_USER and ADMIN_PASSWORD
   (and ADMIN_SECRET) in the Vercel project settings; these then override the
   defaults below. */
const ADMIN_USER = process.env.ADMIN_USER || 'Mike';
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || '1234';
const SECRET = process.env.ADMIN_SECRET || crypto.createHash('sha256').update('ec-admin::' + ADMIN_USER + '::' + ADMIN_PASSWORD).digest('hex');
const USING_TEST_LOGIN = !process.env.ADMIN_PASSWORD;

/* ---- Blob token: Vercel names it BLOB_READ_WRITE_TOKEN, but a custom prefix (e.g. STORAGE_READ_WRITE_TOKEN) is possible ---- */
const TOKEN_KEY = process.env.BLOB_READ_WRITE_TOKEN ? 'BLOB_READ_WRITE_TOKEN' : Object.keys(process.env).find(function (k) { return /_READ_WRITE_TOKEN$/.test(k) && process.env[k]; });
const BLOB_TOKEN = TOKEN_KEY ? process.env[TOKEN_KEY] : '';
const hasBlob = !!BLOB_TOKEN || !!process.env.BLOB_STORE_ID;
const T = BLOB_TOKEN ? { token: BLOB_TOKEN } : {};

function sha(s) { return crypto.createHash('sha256').update(String(s)).digest(); }
function safeEqual(a, b) { return crypto.timingSafeEqual(sha(a), sha(b)); }
function checkLogin(user, pass) {
  /* evaluate both so timing does not reveal which one was wrong */
  const u = safeEqual(String(user || '').trim().toLowerCase(), ADMIN_USER.toLowerCase());
  const p = safeEqual(pass || '', ADMIN_PASSWORD);
  return u && p;
}

/* ---- session cookie (HMAC signed) ---- */
function b64(s) { return Buffer.from(s).toString('base64url'); }
function sign(payload) {
  const body = b64(JSON.stringify(payload));
  const mac = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  return body + '.' + mac;
}
function verify(token) {
  if (!token || token.indexOf('.') < 0) return null;
  const [body, mac] = token.split('.');
  const good = crypto.createHmac('sha256', SECRET).update(body).digest('base64url');
  if (mac.length !== good.length || !crypto.timingSafeEqual(Buffer.from(mac), Buffer.from(good))) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString());
    return p.exp > Date.now() ? p : null;
  } catch (e) { return null; }
}
function cookies(req) {
  const out = {};
  String(req.headers.cookie || '').split(';').forEach(function (c) {
    const i = c.indexOf('=');
    if (i > 0) out[c.slice(0, i).trim()] = decodeURIComponent(c.slice(i + 1).trim());
  });
  return out;
}
function setSession(res, user) {
  const exp = Date.now() + SESSION_HOURS * 3600 * 1000;
  const tok = sign({ u: user, exp });
  const secure = process.env.VERCEL ? '; Secure' : '';
  res.setHeader('Set-Cookie', COOKIE + '=' + tok + '; Path=/; HttpOnly; SameSite=Strict; Max-Age=' + SESSION_HOURS * 3600 + secure);
}
function clearSession(res) {
  const secure = process.env.VERCEL ? '; Secure' : '';
  res.setHeader('Set-Cookie', COOKIE + '=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0' + secure);
}
function session(req) { return verify(cookies(req)[COOKIE]); }

/* writes must come from our own admin page */
function requireAdmin(req, res) {
  const s = session(req);
  if (!s) { json(res, 401, { error: 'Please sign in.' }); return null; }
  if (req.method !== 'GET' && req.headers['x-admin-request'] !== '1') { json(res, 403, { error: 'Blocked request.' }); return null; }
  return s;
}

/* ---- login lockout: 5 wrong passwords from one address locks it out for 1 hour ----
   The counter is stored in the Blob store (when connected) so it survives serverless restarts,
   with an in-memory copy as a backstop. */
const MAX_FAILS = 5;
const LOCK_MS = 60 * 60 * 1000;
const memFails = {};

function ipKey(ip) { return crypto.createHash('sha256').update('ec-lock::' + ip).digest('hex').slice(0, 32); }
function clientIp(req) {
  const h = req.headers;
  return String(h['x-vercel-forwarded-for'] || h['x-forwarded-for'] || h['x-real-ip'] || (req.socket && req.socket.remoteAddress) || 'unknown').split(',')[0].trim();
}
async function readLock(key) {
  const mem = memFails[key] || null;
  let disk = null;
  try {
    if (hasBlob) {
      const { get } = require('@vercel/blob');
      const r = await get('security/' + key + '.json', Object.assign({ access: ACCESS, useCache: false }, T));
      if (r && r.stream) disk = JSON.parse(await streamText(r.stream));
    } else {
      disk = JSON.parse(fs.readFileSync(path.join(os.tmpdir(), 'ec-lock-' + key + '.json'), 'utf8'));
    }
  } catch (e) { disk = null; }
  /* take the stricter of the two records */
  const rec = [mem, disk].filter(Boolean).sort(function (a, b) { return (b.lockedUntil || 0) - (a.lockedUntil || 0) || (b.n || 0) - (a.n || 0); })[0];
  return rec || { n: 0, first: 0, lockedUntil: 0 };
}
async function writeLock(key, rec) {
  memFails[key] = rec;
  try {
    if (hasBlob) {
      const { put } = require('@vercel/blob');
      await put('security/' + key + '.json', JSON.stringify(rec), Object.assign({ access: ACCESS, contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true }, T));
    } else {
      fs.writeFileSync(path.join(os.tmpdir(), 'ec-lock-' + key + '.json'), JSON.stringify(rec));
    }
  } catch (e) { console.error('lock write failed', e); }
}
/* returns minutes left if locked, else 0 */
async function lockedMinutes(ip) {
  const rec = await readLock(ipKey(ip));
  return rec.lockedUntil > Date.now() ? Math.ceil((rec.lockedUntil - Date.now()) / 60000) : 0;
}
/* records a wrong password; returns { locked, left } */
async function noteFail(ip) {
  const key = ipKey(ip), rec = await readLock(key), now = Date.now();
  if (!rec.first || now - rec.first > LOCK_MS) { rec.n = 0; rec.first = now; rec.lockedUntil = 0; }
  rec.n++;
  if (rec.n >= MAX_FAILS) rec.lockedUntil = now + LOCK_MS;
  await writeLock(key, rec);
  return { locked: rec.n >= MAX_FAILS, left: Math.max(0, MAX_FAILS - rec.n) };
}
async function clearFails(ip) {
  const key = ipKey(ip), rec = await readLock(key);
  if (rec.n || rec.lockedUntil) await writeLock(key, { n: 0, first: 0, lockedUntil: 0 });
}

/* ---- http helpers ---- */
function json(res, status, obj) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(obj));
}
function readBody(req, limit) {
  limit = limit || 200 * 1024;
  return new Promise(function (resolve, reject) {
    if (req.body && typeof req.body === 'object') return resolve(req.body);
    let size = 0; const chunks = [];
    req.on('data', function (c) { size += c.length; if (size > limit) { reject(new Error('Too large')); req.destroy(); } else chunks.push(c); });
    req.on('end', function () {
      try { resolve(JSON.parse(Buffer.concat(chunks).toString() || '{}')); } catch (e) { reject(new Error('Bad JSON')); }
    });
    req.on('error', reject);
  });
}

/* ---- storage: Vercel Blob when connected, local temp file otherwise ----
   Works with both private and public Blob stores. Set BLOB_ACCESS=public if your store is public;
   the default is private. Uploaded images are always served through /api/img so they work either way. */
const BLOB_PATH = 'site/content.json';
const TMP_FILE = path.join(os.tmpdir(), 'ec-content.json');
const ACCESS = process.env.BLOB_ACCESS === 'public' ? 'public' : 'private';

async function streamText(stream) { return new Response(stream).text(); }

async function loadSaved() {
  if (hasBlob) {
    const { get } = require('@vercel/blob');
    const r = await get(BLOB_PATH, Object.assign({ access: ACCESS, useCache: false }, T));
    if (!r || !r.stream) return null;
    try { return JSON.parse(await streamText(r.stream)); } catch (e) { return null; }
  }
  try { return JSON.parse(fs.readFileSync(TMP_FILE, 'utf8')); } catch (e) { return null; }
}
async function saveContent(obj) {
  const text = JSON.stringify(obj);
  if (hasBlob) {
    const { put } = require('@vercel/blob');
    await put(BLOB_PATH, text, Object.assign({ access: ACCESS, contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true }, T));
  } else {
    fs.writeFileSync(TMP_FILE, text);
  }
}
async function resetContent() {
  if (hasBlob) {
    const { list, del } = require('@vercel/blob');
    const r = await list(Object.assign({ prefix: BLOB_PATH, limit: 5 }, T));
    if (r.blobs.length) await del(r.blobs.map(function (b) { return b.url; }), T);
  } else { try { fs.unlinkSync(TMP_FILE); } catch (e) { /* none */ } }
}
async function putImage(name, buf, type) {
  const { put } = require('@vercel/blob');
  await put('uploads/' + name, buf, Object.assign({ access: ACCESS, contentType: type, addRandomSuffix: false }, T));
  return '/api/img?p=uploads/' + name;
}
async function getImage(pathname) {
  const { get } = require('@vercel/blob');
  return get(pathname, Object.assign({ access: ACCESS }, T));
}
/* ---- small private JSON store for orders (Blob in production, temp files locally) ---- */
const ORDERS_DIR = path.join(os.tmpdir(), 'ec-orders');
const store = {
  async put(pathname, obj) {
    if (hasBlob) {
      const { put } = require('@vercel/blob');
      await put(pathname, JSON.stringify(obj), Object.assign({ access: ACCESS, contentType: 'application/json', addRandomSuffix: false, allowOverwrite: true }, T));
    } else {
      fs.mkdirSync(ORDERS_DIR, { recursive: true });
      fs.writeFileSync(path.join(ORDERS_DIR, pathname.replace(/\//g, '__')), JSON.stringify(obj));
    }
  },
  async get(pathname) {
    try {
      if (hasBlob) {
        const { get } = require('@vercel/blob');
        const r = await get(pathname, Object.assign({ access: ACCESS, useCache: false }, T));
        return r && r.stream ? JSON.parse(await streamText(r.stream)) : null;
      }
      return JSON.parse(fs.readFileSync(path.join(ORDERS_DIR, pathname.replace(/\//g, '__')), 'utf8'));
    } catch (e) { return null; }
  },
  async list(prefix) {
    if (hasBlob) {
      const { list } = require('@vercel/blob');
      const out = []; let cursor;
      do {
        const r = await list(Object.assign({ prefix: prefix, limit: 200, cursor: cursor }, T));
        r.blobs.forEach(function (b) { out.push(b.pathname); });
        cursor = r.hasMore ? r.cursor : null;
      } while (cursor && out.length < 1000);
      return out;
    }
    try { return fs.readdirSync(ORDERS_DIR).map(function (f) { return f.replace(/__/g, '/'); }).filter(function (p) { return p.indexOf(prefix) === 0; }); } catch (e) { return []; }
  },
  async del(pathname) {
    if (hasBlob) {
      const { list, del } = require('@vercel/blob');
      const r = await list(Object.assign({ prefix: pathname, limit: 2 }, T));
      const b = r.blobs.filter(function (x) { return x.pathname === pathname; });
      if (b.length) await del(b.map(function (x) { return x.url; }), T);
    } else { try { fs.unlinkSync(path.join(ORDERS_DIR, pathname.replace(/\//g, '__'))); } catch (e) { /* none */ } }
  }
};

async function getContent() {
  const saved = await loadSaved();
  return saved ? clean(saved) : JSON.parse(JSON.stringify(DEFAULTS));
}

/* ---- validation: keep edits small, safe and well-formed ---- */
function str(v, max, fallback) {
  if (typeof v !== 'string') return fallback || '';
  return v.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, max);
}
function url(v) {
  v = str(v, 500);
  if (!v) return '';
  if (/^https:\/\//i.test(v) || /^assets\/[\w\-./]+$/.test(v) || /^\/assets\/[\w\-./]+$/.test(v) || /^\/api\/img\?p=uploads\/[a-f0-9]{16}\.(webp|png|jpg)$/.test(v)) return v;
  if (/^http:\/\//i.test(v)) return 'https://' + v.slice(7);
  return '';
}
function link(v) { v = url(v); return v; }
function money(v) { const n = Math.round(Number(v) * 100) / 100; return isFinite(n) ? Math.min(Math.max(n, 0), 2000) : 0; }
function digits(p) { const d = String(p || '').replace(/\D/g, ''); return d.length === 10 ? '+1' + d : d.length === 11 && d[0] === '1' ? '+' + d : ''; }
function pretty(p) { const d = String(p || '').replace(/\D/g, '').replace(/^1(?=\d{10}$)/, ''); return d.length === 10 ? '(' + d.slice(0, 3) + ') ' + d.slice(3, 6) + '-' + d.slice(6) : str(p, 24); }
const ICONS = ['ti-shirt-sport', 'ti-shoe', 'ti-jacket', 'ti-hanger', 'ti-shirt', 'ti-star', 'ti-briefcase'];

function clean(c) {
  const D = DEFAULTS;
  c = c && typeof c === 'object' ? c : {};
  const out = { version: 1 };
  const a = c.announce || {};
  out.announce = { on: !!a.on, text: str(a.text, 160), link: link(a.link) };
  const h = c.hero || {};
  out.hero = { lead: str(h.lead, 80, D.hero.lead) || D.hero.lead, accent: str(h.accent, 60, D.hero.accent) || D.hero.accent, sub: str(h.sub, 320, D.hero.sub) || D.hero.sub };
  out.contact = { email: /^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(str(c.contact && c.contact.email, 120)) ? str(c.contact.email, 120) : D.contact.email };
  out.locations = D.locations.map(function (d, i) {
    const l = (c.locations && c.locations[i]) || {};
    const p = digits(l.p) ? pretty(l.p) : d.p;
    return { n: d.n, a: str(l.a, 140, d.a) || d.a, p: p, tel: digits(p) || d.tel };
  });
  out.shop = D.shop.map(function (d, i) {
    const s = (c.shop && c.shop[i]) || {};
    return { t: str(s.t, 40, d.t) || d.t, d: str(s.d, 140, d.d) || d.d, img: url(s.img) || d.img };
  });
  const seen = {};
  out.teams = (Array.isArray(c.teams) ? c.teams : D.teams).slice(0, 40).map(function (t, ti) {
    t = t || {};
    let id = str(t.id, 40).toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-') || 'team-' + (ti + 1);
    while (seen[id]) id += '-x';
    seen[id] = 1;
    const color = function (v, f) { return /^#[0-9a-fA-F]{6}$/.test(v || '') ? v : f; };
    const ks = {};
    return {
      id: id, n: str(t.n, 60) || 'New team', cat: str(t.cat, 30) || 'Youth hockey',
      status: t.status === 'soon' ? 'soon' : 'open', logo: url(t.logo), dark: !!t.dark,
      c1: color(t.c1, '#12305C'), c2: color(t.c2, '#2C6FC4'), url: '',
      note: str(t.note, 240), hidden: !!t.hidden,
      items: (Array.isArray(t.items) ? t.items : []).slice(0, 40).map(function (it, ii) {
        it = it || {};
        let k = str(it.k, 40).toLowerCase().replace(/[^a-z0-9-]/g, '-') || 'item-' + (ii + 1);
        while (ks[k]) k += '-x';
        ks[k] = 1;
        return { k: k, n: str(it.n, 60) || 'New item', ic: ICONS.indexOf(it.ic) >= 0 ? it.ic : 'ti-shirt-sport', img: url(it.img), price: money(it.price), tag: str(it.tag, 20), pers: !!it.pers, hidden: !!it.hidden };
      })
    };
  });
  return out;
}

module.exports = { sign, verify, json, readBody, checkLogin, setSession, clearSession, session, requireAdmin, lockedMinutes, noteFail, clearFails, clientIp,
  store, getContent, saveContent, resetContent, putImage, getImage, clean, hasBlob, TOKEN_KEY, USING_TEST_LOGIN, DEFAULTS };
