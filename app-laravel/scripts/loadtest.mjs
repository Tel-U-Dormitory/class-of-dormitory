// Uji beban alur ujian. Butuh peserta NIM 13590001–1359NNNN dengan token TEST-TOKN dan satu ujian yang dibuka.
// Contoh: BASE=https://cod.example.id USERS=150 DURATION=60 THINK=2000 node scripts/loadtest.mjs
// Simulasi N peserta: login → mulai ujian → observasi → menjawab terus-menerus.
const BASE = process.env.BASE ?? 'http://127.0.0.1:8100';
const USERS = Number(process.env.USERS ?? 150);
const DURATION_MS = Number(process.env.DURATION ?? 60) * 1000;
const THINK_MS = Number(process.env.THINK ?? 2000);

const stats = { answer: [], heartbeat: [], login: [], session: [], errors: {} };
const err = (k) => (stats.errors[k] = (stats.errors[k] ?? 0) + 1);

class Client {
  constructor() { this.jar = new Map(); }
  cookieHeader() { return [...this.jar].map(([k, v]) => `${k}=${v}`).join('; '); }
  store(res) {
    for (const c of res.headers.getSetCookie?.() ?? []) {
      const [pair] = c.split(';');
      const i = pair.indexOf('=');
      this.jar.set(pair.slice(0, i), pair.slice(i + 1));
    }
  }
  xsrf() { return decodeURIComponent(this.jar.get('XSRF-TOKEN') ?? ''); }
  async req(method, path, { json, form, accept = 'text/html' } = {}) {
    const headers = { Cookie: this.cookieHeader(), Accept: accept, 'X-XSRF-TOKEN': this.xsrf() };
    let body;
    if (json) { headers['Content-Type'] = 'application/json'; headers['X-Requested-With'] = 'XMLHttpRequest'; body = JSON.stringify(json); }
    if (form) { headers['Content-Type'] = 'application/x-www-form-urlencoded'; body = new URLSearchParams(form).toString(); }
    const t = performance.now();
    const res = await fetch(BASE + path, { method, headers, body, redirect: 'manual' });
    this.store(res);
    const text = await res.text();
    return { status: res.status, text, ms: performance.now() - t };
  }
}

function pageProps(html) {
  const m = html.match(/data-page="([^"]*)"/);
  if (!m) return null;
  const json = m[1].replace(/&quot;/g, '"').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#039;/g, "'");
  return JSON.parse(json).props;
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function participant(i, deadline) {
  const c = new Client();
  const nim = `1359${String(i).padStart(4, '0')}`;
  await c.req('GET', '/masuk');
  const login = await c.req('POST', '/masuk', { form: { nim, token: 'TEST-TOKN' } });
  stats.login.push(login.ms);
  if (login.status !== 302) return err('login ' + login.status);

  const start = await c.req('POST', '/ujian/mulai', { form: {} });
  if (start.status !== 302) return err('start ' + start.status);

  let s = await c.req('GET', '/ujian/sesi');
  stats.session.push(s.ms);
  let props = pageProps(s.text);
  if (!props?.current) return err('session props');

  for (const g of props.current.groups.filter((g) => g.observation.state === 'pending')) {
    await c.req('POST', `/ujian/observasi/${g.id}/mulai`, { form: {} });
    await c.req('POST', `/ujian/observasi/${g.id}/selesai`, { form: {} });
  }
  s = await c.req('GET', '/ujian/sesi');
  props = pageProps(s.text);
  const questions = props.current.groups.flatMap((g) => g.questions).filter((q) => !q.locked);
  let lastBeat = Date.now();

  await sleep(Math.random() * THINK_MS);
  while (Date.now() < deadline) {
    const q = questions[Math.floor(Math.random() * questions.length)];
    const opt = q.options[Math.floor(Math.random() * q.options.length)];
    const r = await c.req('POST', `/ujian/jawaban/${q.id}`, { json: { option_id: opt.id }, accept: 'application/json' });
    if (r.status === 200) stats.answer.push(r.ms); else err('answer ' + r.status);

    if (Date.now() - lastBeat > 30000) {
      const h = await c.req('POST', '/ujian/heartbeat', { json: {}, accept: 'application/json' });
      if (h.status === 200) stats.heartbeat.push(h.ms); else err('heartbeat ' + h.status);
      lastBeat = Date.now();
    }
    await sleep(THINK_MS * (0.5 + Math.random()));
  }
}

const pct = (arr, p) => { const s = [...arr].sort((a, b) => a - b); return s.length ? s[Math.min(s.length - 1, Math.floor((p / 100) * s.length))].toFixed(0) : '-'; };
const report = (name, arr) => console.log(`${name.padEnd(10)} n=${String(arr.length).padStart(5)}  p50=${pct(arr, 50)}ms  p95=${pct(arr, 95)}ms  p99=${pct(arr, 99)}ms  max=${pct(arr, 100)}ms`);

const t0 = Date.now();
const deadline = t0 + DURATION_MS;
// Login dicicil selama 10 detik, seperti peserta yang masuk hampir bersamaan.
await Promise.all(Array.from({ length: USERS }, (_, i) => sleep((i / USERS) * 10000).then(() => participant(i + 1, deadline).catch((e) => err('exception ' + e.message)))));
const secs = (Date.now() - t0) / 1000;

console.log(`${USERS} peserta, ${secs.toFixed(0)} detik, jeda pikir ~${THINK_MS}ms`);
report('login', stats.login);
report('sesi', stats.session);
report('jawaban', stats.answer);
report('heartbeat', stats.heartbeat);
console.log(`throughput jawaban: ${(stats.answer.length / secs).toFixed(1)} req/s`);
console.log('error:', JSON.stringify(stats.errors));
