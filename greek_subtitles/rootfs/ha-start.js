#!/usr/bin/env node
'use strict';
// Home Assistant app launcher shared by the "Greek Subtitles" and "AIOStreams" apps (keep both copies identical —
// CI checks it). It does what the Orange Pi installer did with nginx + systemd, inside the app container:
//
//   • HTTPS that Stremio accepts, with the free wildcard certificate of local-ip.sh:
//       home network  https://192-168-1-128.local-ip.sh:<port>
//       outside       https://<public-ip-with-dashes>.local-ip.sh:<public port>  (forward that port on the router)
//     or your own domain / tunnel (public_url). The certificate is refreshed automatically.
//   • A small TLS reverse proxy in front of the app (Node only — the AIOStreams image has no shell tools).
//   • Secrets generated once and kept in /data: configuration password, AIOStreams secret key and admin password.
//   • Clear log lines with the addresses and the router port-forwarding to set up.
//
// Usage: node ha-start.js subtitles | aiostreams

const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const crypto = require('crypto');
const { spawn } = require('child_process');

const MODE = process.argv[2];
const DATA = process.env.HA_APP_DATA || '/data'; // tests only; Home Assistant always uses /data
const OPTIONS = readJson(path.join(DATA, 'options.json')) || {};
const SUB_DIR = process.env.HA_APP_DIR || '/opt/app'; // tests only
const SECRETS_FILE = path.join(DATA, 'secrets.json');
const TLS_DIR = path.join(DATA, 'tls');

const APPS = {
  subtitles: {
    name: 'Greek Subtitles',
    httpsPort: 8453,               // container port (the host port is set on the app's Network tab)
    innerPort: 7000,
    command: () => [process.execPath, [path.join(SUB_DIR, 'server.js')]],
    cwd: SUB_DIR,
    health: '/health',
  },
  aiostreams: {
    name: 'AIOStreams',
    httpsPort: 8454,
    innerPort: 3000,
    command: () => [process.execPath, ['/app/packages/server/dist/server.js']],
    cwd: '/app',
    health: '/api/v1/status',
  },
};
const APP = APPS[MODE];
if (!APP) { console.error('usage: ha-start.js subtitles|aiostreams'); process.exit(2); }

const log = (...a) => console.log(`[${new Date().toISOString().slice(11, 19)}] ${APP.name}:`, ...a);
const warn = (...a) => console.warn(`[${new Date().toISOString().slice(11, 19)}] ${APP.name}: ⚠`, ...a);

function readJson(f) { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } }
function writePrivate(f, text) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, text, { mode: 0o600 }); }
const opt = (k, d = '') => (OPTIONS[k] === undefined || OPTIONS[k] === null ? d : OPTIONS[k]);
const dashed = (ip) => `${ip.replace(/\./g, '-')}.local-ip.sh`;
const withPort = (origin, port) => (port && Number(port) !== 443 ? `${origin}:${port}` : origin);

// ------------------------------------------------------------------------------------------- Supervisor API
async function supervisor(p) {
  const token = process.env.SUPERVISOR_TOKEN;
  if (!token) return null;
  try {
    const r = await fetch(`http://supervisor${p}`, { headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) return null;
    return (await r.json()).data;
  } catch { return null; }
}

/** The Home Assistant host's address on the home network (primary interface), unless set in the options. */
async function lanIp() {
  const manual = String(opt('lan_ip')).trim();
  if (/^\d+\.\d+\.\d+\.\d+$/.test(manual)) return manual;
  const net = await supervisor('/network/info');
  const ifs = (net && net.interfaces) || [];
  const pick = ifs.find((i) => i.primary && i.ipv4 && (i.ipv4.address || []).length) || ifs.find((i) => i.ipv4 && (i.ipv4.address || []).length);
  const a = pick && pick.ipv4.address[0];
  return a ? a.split('/')[0] : null;
}

/** The host port mapped to our HTTPS container port (Network tab), null when disabled. */
async function hostPort() {
  const info = await supervisor('/addons/self/info');
  const map = (info && info.network) || {};
  const v = map[`${APP.httpsPort}/tcp`];
  return v === undefined ? APP.httpsPort : v; // undefined: API not reachable → assume the default mapping
}

async function publicIp() {
  const v = String(opt('public_ip', 'auto')).trim();
  if (/^\d+\.\d+\.\d+\.\d+$/.test(v)) return v;
  for (const u of ['https://api.ipify.org', 'https://ifconfig.me/ip', 'https://icanhazip.com']) {
    try {
      const t = (await (await fetch(u, { signal: AbortSignal.timeout(8000) })).text()).trim();
      if (/^\d+\.\d+\.\d+\.\d+$/.test(t)) return t;
    } catch { /* next */ }
  }
  return null;
}

// ------------------------------------------------------------------------------------------- secrets
function secrets() {
  const s = readJson(SECRETS_FILE) || {};
  let changed = false;
  const ensure = (k, gen) => { if (!s[k]) { s[k] = gen(); changed = true; } return s[k]; };
  if (MODE === 'subtitles') ensure('config_password', () => crypto.randomBytes(12).toString('base64url').slice(0, 16));
  if (MODE === 'aiostreams') {
    ensure('secret_key', () => crypto.randomBytes(32).toString('hex')); // never changes after the first run
    ensure('admin_password', () => crypto.randomBytes(12).toString('base64url').slice(0, 16));
  }
  if (changed) writePrivate(SECRETS_FILE, JSON.stringify(s, null, 2));
  return s;
}

// ------------------------------------------------------------------------------------------- certificate
const PEM = path.join(TLS_DIR, 'server.pem');
const KEY = path.join(TLS_DIR, 'server.key');
async function refreshCert(force = false) {
  const age = fs.existsSync(PEM) ? Date.now() - fs.statSync(PEM).mtimeMs : Infinity;
  if (!force && age < 5 * 86400e3) return false;
  try {
    const [pem, key] = await Promise.all(['server.pem', 'server.key'].map(async (f) => {
      const r = await fetch(`https://local-ip.sh/${f}`, { signal: AbortSignal.timeout(30000) });
      if (!r.ok) throw new Error(`${f}: HTTP ${r.status}`);
      return r.text();
    }));
    if (!pem.includes('BEGIN CERTIFICATE') || !key.includes('PRIVATE KEY')) throw new Error('unexpected certificate download');
    writePrivate(PEM, pem); writePrivate(KEY, key);
    log('HTTPS certificate for *.local-ip.sh downloaded');
    return true;
  } catch (e) {
    if (fs.existsSync(PEM)) { warn(`certificate refresh failed (${e.message}); keeping the current one`); return false; }
    throw new Error(`Could not download the local-ip.sh HTTPS certificate (internet access needed): ${e.message}`);
  }
}

// ------------------------------------------------------------------------------------------- TLS proxy
function startProxy() {
  const server = https.createServer({ cert: fs.readFileSync(PEM), key: fs.readFileSync(KEY) }, (req, res) => {
    const headers = { ...req.headers, 'x-forwarded-proto': 'https', 'x-real-ip': req.socket.remoteAddress || '', 'x-forwarded-for': req.socket.remoteAddress || '' };
    const up = http.request({ host: '127.0.0.1', port: APP.innerPort, method: req.method, path: req.url, headers, timeout: 180000 }, (r) => {
      res.writeHead(r.statusCode || 502, r.headers);
      r.pipe(res);
    });
    up.on('timeout', () => up.destroy(new Error('upstream timeout')));
    up.on('error', () => { if (!res.headersSent) { res.writeHead(502, { 'content-type': 'text/plain' }); } res.end('Starting up — try again in a few seconds'); });
    req.pipe(up);
  });
  server.on('clientError', (err, socket) => socket.destroy());
  server.listen(APP.httpsPort, '0.0.0.0', () => log(`HTTPS listening on container port ${APP.httpsPort}`));
  // pick up a refreshed certificate without a restart
  setInterval(async () => {
    try { if (await refreshCert()) server.setSecureContext({ cert: fs.readFileSync(PEM), key: fs.readFileSync(KEY) }); } catch (e) { warn(e.message); }
  }, 12 * 3600e3).unref();
  return server;
}

// ------------------------------------------------------------------------------------------- child process
function run(env) {
  const [cmd, args] = APP.command();
  let stopping = false;
  let child;
  const start = () => {
    child = spawn(cmd, args, { cwd: APP.cwd, env: { ...process.env, ...env }, stdio: 'inherit' });
    child.on('exit', (code, sig) => {
      if (stopping) process.exit(0);
      warn(`stopped (${sig || code}); restarting in 5 s`);
      setTimeout(start, 5000);
    });
  };
  start();
  for (const s of ['SIGTERM', 'SIGINT']) process.on(s, () => { stopping = true; if (child) child.kill('SIGTERM'); setTimeout(() => process.exit(0), 8000).unref(); });
}

async function reachable(url) {
  try { const r = await fetch(url, { signal: AbortSignal.timeout(8000) }); return r.status < 500; } catch { return false; }
}

// ------------------------------------------------------------------------------------------- migration
// One-time import of an Orange Pi install of AIO-Streams&Subtitles-Greek. Set migrate_from to the URL of an
// archive made on the Pi with:
//   sudo tar czf migrate.tgz -C / opt/aio-streams-subtitles-greek/data etc/aio-streams-subtitles-greek.env \
//        opt/aiostreams/.env opt/aiostreams/data
// The secret keys come along, so existing install links, logins and saved configurations keep working.
// Whatever it replaces is moved to /data/pre-migration-<time>. Runs once per URL.
function untar(buf) {
  const files = [];
  let long = null;
  for (let o = 0; o + 512 <= buf.length;) {
    const h = buf.subarray(o, o + 512);
    if (h.every((b) => b === 0)) break;
    const str = (a, b) => h.toString('utf8', a, b).replace(/\0[\s\S]*$/, '');
    const size = parseInt(str(124, 136).trim() || '0', 8) || 0;
    const type = String.fromCharCode(h[156] || 48);
    const prefix = h.toString('latin1', 257, 263) === 'ustar\0' ? str(345, 500) : '';
    const name = long || (prefix ? prefix + '/' : '') + str(0, 100);
    long = null;
    const body = buf.subarray(o + 512, o + 512 + size);
    o += 512 + Math.ceil(size / 512) * 512;
    if (type === 'L') { long = body.toString('utf8').replace(/\0[\s\S]*$/, ''); continue; }
    if (type === 'x') { const m = /\d+ path=([^\n]*)\n/.exec(body.toString('utf8')); if (m) long = m[1]; continue; }
    if (type === '0' || type === '7') files.push({ name: name.replace(/^(\.\/)+|^\//, ''), body });
  }
  return files;
}

function parseEnv(text) {
  const e = {};
  for (const l of text.split(/\r?\n/)) {
    const m = /^\s*([A-Z0-9_]+)=(.*)$/.exec(l);
    if (m) e[m[1]] = m[2].trim().replace(/^(['"])(.*)\1$/, '$2');
  }
  return e;
}

async function migrate() {
  const url = String(opt('migrate_from')).trim();
  if (!url) return;
  const id = crypto.createHash('sha256').update(url).digest('hex');
  const mark = path.join(DATA, 'migrated.json');
  if ((readJson(mark) || {}).id === id) { log('Orange Pi import already done — you can clear migrate_from'); return; }
  log('importing the Orange Pi setup…');
  let files;
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(600000) });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    let buf = Buffer.from(await r.arrayBuffer());
    if (buf[0] === 0x1f && buf[1] === 0x8b) buf = require('zlib').gunzipSync(buf);
    files = untar(buf);
  } catch (e) { warn('Orange Pi import failed (' + e.message + ') — starting with the current settings'); return; }
  const envOf = (n) => { const x = files.find((f) => f.name === n); return x ? parseEnv(x.body.toString('utf8')) : null; };
  const backup = path.join(DATA, 'pre-migration-' + new Date().toISOString().replace(/[:.]/g, '-'));
  const stash = (rel) => {
    const src = path.join(DATA, rel);
    if (!fs.existsSync(src)) return;
    fs.mkdirSync(path.dirname(path.join(backup, rel)), { recursive: true });
    fs.renameSync(src, path.join(backup, rel));
  };
  const write = (root, rel, body) => {
    const dst = path.resolve(root, rel);
    if (!dst.startsWith(path.resolve(root) + path.sep)) return false;
    fs.mkdirSync(path.dirname(dst), { recursive: true });
    fs.writeFileSync(dst, body, { mode: 0o600 });
    return true;
  };
  const s = readJson(SECRETS_FILE) || {};
  const done = [];
  if (MODE === 'subtitles') {
    const pre = 'opt/aio-streams-subtitles-greek/data/';
    const data = files.filter((f) => f.name.startsWith(pre) && f.name.length > pre.length);
    if (data.length) {
      stash('app');
      let n = 0;
      for (const f of data) if (write(path.join(DATA, 'app'), f.name.slice(pre.length), f.body)) n++;
      done.push(n + ' data files (secret key, sign-ins, settings, cache)');
    }
    const e = envOf('etc/aio-streams-subtitles-greek.env');
    if (e && e.CONFIG_PASSWORD) { s.config_password = e.CONFIG_PASSWORD; done.push('configuration password'); }
  } else {
    const dbs = files.filter((f) => /^opt\/aiostreams\/data\/db\.sqlite(-wal|-shm|-journal)?$/.test(f.name));
    if (dbs.length) {
      for (const x of fs.readdirSync(DATA)) if (/^db\.sqlite/.test(x)) stash(x);
      for (const f of dbs) write(DATA, path.basename(f.name), f.body);
      done.push('database (users and saved configurations)');
    }
    const e = envOf('opt/aiostreams/.env');
    if (e && e.SECRET_KEY) { s.secret_key = e.SECRET_KEY; done.push('secret key'); }
    if (e && e.AIOSTREAMS_AUTH && e.AIOSTREAMS_AUTH.includes(':')) {
      const i = e.AIOSTREAMS_AUTH.indexOf(':');
      const user = e.AIOSTREAMS_AUTH.slice(0, i);
      s.admin_password = e.AIOSTREAMS_AUTH.slice(i + 1);
      done.push('admin login');
      if (user !== (String(opt('admin_user', 'admin')).trim() || 'admin')) warn('the Orange Pi login user was "' + user + '" — set admin_user to it to keep the same login');
    }
  }
  if (!done.length) { warn('the Orange Pi archive had nothing for this app — nothing changed'); return; }
  writePrivate(SECRETS_FILE, JSON.stringify(s, null, 2));
  writePrivate(mark, JSON.stringify({ id, at: new Date().toISOString(), imported: done, backup }, null, 2));
  log('✓ imported from the Orange Pi: ' + done.join(', '));
}

// ------------------------------------------------------------------------------------------- main
(async () => {
  await migrate();
  const s = secrets();
  const ip = await lanIp();
  const port = await hostPort();
  if (!ip) warn('could not detect the home-network address; set lan_ip in the configuration');
  if (port === null) warn(`the HTTPS port is disabled on the Network tab — Stremio needs it (container port ${APP.httpsPort})`);
  const lanUrl = ip && port ? withPort(`https://${dashed(ip)}`, port) : '';

  let extUrl = '';
  const custom = String(opt('public_url')).trim().replace(/\/+$/, '');
  if (opt('public_access', true)) {
    if (custom) {
      if (!/^https:\/\/[a-z0-9.-]+(:\d{1,5})?$/i.test(custom)) warn('public_url must be an https:// origin (Stremio requires HTTPS); ignoring it');
      else extUrl = custom;
    } else {
      const pub = await publicIp();
      if (!pub) warn('could not detect your public IP; set public_ip in the configuration');
      else extUrl = withPort(`https://${dashed(pub)}`, opt('public_port', port || APP.httpsPort));
    }
  }

  await refreshCert();
  startProxy();

  const env = { PORT: String(APP.innerPort) };
  if (MODE === 'subtitles') {
    fs.mkdirSync(path.join(DATA, 'app'), { recursive: true });
    Object.assign(env, {
      DATA_DIR: path.join(DATA, 'app'),
      PUBLIC_URL: lanUrl,
      EXTERNAL_URL: extUrl,
      CONFIG_PASSWORD: String(opt('config_password')).trim() || s.config_password,
      LOCAL_LLM_URL: String(opt('local_llm_url')).trim(),
      AIOSTREAMS_URL: String(opt('aiostreams_url')).trim(),
    });
    for (const k of Object.keys(env)) if (env[k] === '') delete env[k];
  } else {
    const user = String(opt('admin_user', 'admin')).trim() || 'admin';
    const pass = String(opt('admin_password')).trim() || s.admin_password;
    Object.assign(env, {
      BASE_URL: String(opt('base_url')).trim() || extUrl || lanUrl || `http://localhost:${APP.innerPort}`,
      SECRET_KEY: s.secret_key,
      DATABASE_URI: `sqlite://${path.join(DATA, 'db.sqlite')}`,
      AIOSTREAMS_AUTH: `${user}:${pass}`,
      TEMPLATE_URLS: JSON.stringify([
        'https://raw.githubusercontent.com/jfle/aio-streams-subtitles-greek/main/templates/aiostreams-tablet-greek.json',
        'https://raw.githubusercontent.com/jfle/aio-streams-subtitles-greek/main/templates/aiostreams-english-greek.json',
      ]),
    });
    if (opt('auth_required', false)) env.AIOSTREAMS_AUTH_REQUIRED = 'true';
    env.__LOGIN = `${user} / ${pass}`;
  }

  // what to do next, in the log
  const line = '─'.repeat(64);
  console.log(line);
  log(`home network: ${lanUrl || '(unknown — set lan_ip)'}${MODE === 'subtitles' ? '/configure' : ''}`);
  if (extUrl) {
    log(`outside:      ${extUrl}${MODE === 'subtitles' ? '/configure' : ''}`);
    if (!custom && ip && port) log(`router:       forward TCP ${opt('public_port', port)} → ${ip} port ${port}  ("port forwarding" / "virtual server")`);
  } else log('outside:      off (enable public_access to watch away from home)');
  if (MODE === 'subtitles') log(`configuration password: ${env.CONFIG_PASSWORD}  (needed through the outside address)`);
  else { log(`login: ${env.__LOGIN}`); delete env.__LOGIN; }
  console.log(line);

  run(env);
  if (MODE === 'aiostreams' && !fs.existsSync(path.join(DATA, 'db.sqlite'))) log('first start: AIOStreams downloads its reference data before its web page opens — this can take 5–15 minutes');

  if (extUrl) setTimeout(async () => {
    const ok = await reachable(`${extUrl}${APP.health}`);
    log(ok ? `✓ reachable through ${extUrl}` : `couldn't confirm ${extUrl} from inside your network (many routers don't loop back) — test it from mobile data`);
  }, 15000).unref();
})().catch((e) => { console.error(`${APP.name}: ${e.message}`); process.exit(1); });
