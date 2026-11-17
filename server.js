require('dotenv').config();
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const express = require('express');
const mongoose = require('mongoose');
const jwt = require('jsonwebtoken');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const { MONGODB_URI, ADMIN_PASSWORD, JWT_SECRET, PORT = 3000 } = process.env;
if (!MONGODB_URI || !ADMIN_PASSWORD || !JWT_SECRET) {
  console.error('ERROR: MONGODB_URI, ADMIN_PASSWORD and JWT_SECRET must be set in .env.');
  process.exit(1);
}

/* ---------- data shape ---------- */
const FIELDS = {
  members: ['name', 'uid', 'yt', 'dc', 'img'],
  plans: ['title', 'time', 'details'],
  tournaments: ['title', 'date', 'prize', 'result'],
  achievements: ['title', 'detail', 'img'],
  channels: ['name', 'url', 'note'],
  posts: ['type', 'title', 'body', 'img'],
  join: ['name', 'uid', 'level', 'role', 'contact', 'msg'],
  regs: ['name', 'uid', 'tournament', 'contact'],
  msgs: ['name', 'contact', 'via', 'msg']
};
const REQUIRED = {
  members: ['name'], plans: ['title'], tournaments: ['title'], achievements: ['title'],
  channels: ['name'], posts: ['title'],
  join: ['name', 'uid', 'contact'], regs: ['name', 'uid', 'tournament', 'contact'], msgs: ['name', 'contact', 'msg']
};
const PUBLIC_READ = ['members', 'plans', 'tournaments', 'achievements', 'channels', 'posts'];
const PUBLIC_WRITE = ['join', 'regs', 'msgs'];
const SETTINGS = ['yt', 'ig', 'dc', 'other', 'guildId', 'leader', 'owner', 'guild', 'rules', 'recruit', 'logo'];
const IMG = new Set(['img', 'logo']);

function clean(keys, src) {
  const o = {};
  for (const k of keys) {
    let v = src && src[k] != null ? String(src[k]).trim() : '';
    if (IMG.has(k)) {
      const okType = /^data:image\/(jpeg|png|webp|gif);base64,/.test(v) || /^https:\/\//.test(v);
      if (!okType || v.length > 900000) v = '';
    } else {
      v = v.slice(0, 3000);
    }
    o[k] = v;
  }
  return o;
}
const LABEL = { name: 'name', uid: 'UID', tournament: 'tournament', contact: 'contact', msg: 'message', title: 'title' };
function validate(col, o) {
  for (const k of REQUIRED[col] || []) if (!o[k]) return `Please fill in the "${LABEL[k] || k}" field.`;
  if ((col === 'join' || col === 'regs') && !/^\d{6,14}$/.test(o.uid)) return 'UID must be 6 to 14 digits.';
  if (col === 'msgs' && !['Discord', 'YouTube'].includes(o.via)) o.via = 'Discord';
  return null;
}

/* ---------- models ---------- */
const Setting = mongoose.model('Setting', new mongoose.Schema({ _id: String, data: {} }, { minimize: false }));
const Item = mongoose.model('Item', new mongoose.Schema({ col: { type: String, index: true }, data: {} }, { timestamps: true, minimize: false }));
const out = d => ({ ...d.data, _id: String(d._id) });

async function seed() {
  if (await Setting.findById('main')) return;
  await Setting.create({ _id: 'main', data: { yt: 'https://www.youtube.com/@RealBanned' } });
  await Item.insertMany([
    { col: 'members', data: { name: 'BAN ZAXISS', uid: '6301393507', yt: 'https://www.youtube.com/@ZAXISSx', dc: '', img: '' } },
    { col: 'channels', data: { name: 'BANNED OFFICIAL', url: 'https://www.youtube.com/@RealBanned', note: 'Official guild channel' } }
  ]);
}

/* ---------- app ---------- */
const app = express();
app.set('trust proxy', 1);
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'", 'https://cdnjs.cloudflare.com'],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: ["'self'"],
      upgradeInsecureRequests: null
    }
  }
}));
app.use(compression());
app.use(express.json({ limit: '2mb' }));

const w = f => (req, res, next) => f(req, res, next).catch(next);
const hash = s => crypto.createHash('sha256').update(String(s)).digest();
const pwOk = p => crypto.timingSafeEqual(hash(p), hash(ADMIN_PASSWORD));
const limiter = (max, minutes) => rateLimit({
  windowMs: minutes * 60 * 1000, max, standardHeaders: true, legacyHeaders: false,
  message: { error: 'Too many attempts. Please try again in a few minutes.' }
});

function auth(req, res, next) {
  const t = (req.headers.authorization || '').replace(/^Bearer /, '');
  try { jwt.verify(t, JWT_SECRET); next(); }
  catch { res.status(401).json({ error: 'Session expired. Please sign in again.' }); }
}
const colOk = (req, res, next) => ALL.includes(req.params.col) ? next() : res.status(404).json({ error: 'Not found' });
const ALL = [...PUBLIC_READ, ...PUBLIC_WRITE];
const idOk = (req, res, next) => mongoose.isValidObjectId(req.params.id) ? next() : res.status(400).json({ error: 'Bad id' });

async function collect(cols) {
  const items = await Item.find({ col: { $in: cols } }).sort({ createdAt: 1 }).lean();
  const r = {};
  cols.forEach(c => (r[c] = []));
  items.forEach(i => r[i.col].push(out(i)));
  return r;
}

app.get('/healthz', (req, res) => res.send('ok'));

/* public: site content */
app.get('/api/public', w(async (req, res) => {
  const [s, items] = await Promise.all([Setting.findById('main').lean(), collect(PUBLIC_READ)]);
  res.json({ s: s ? s.data : {}, ...items });
}));

/* public: forms (join / registration / contact) */
app.post('/api/submit/:col', limiter(10, 15), (req, res, next) => PUBLIC_WRITE.includes(req.params.col) ? next() : res.status(404).json({ error: 'Not found' }),
  w(async (req, res) => {
    const col = req.params.col, data = clean(FIELDS[col], req.body);
    const err = validate(col, data);
    if (err) return res.status(400).json({ error: err });
    await Item.create({ col, data });
    res.json({ ok: true });
  }));

/* admin */
app.post('/api/admin/login', limiter(10, 15), (req, res) => {
  const p = req.body && req.body.password;
  if (typeof p !== 'string' || !pwOk(p)) return res.status(401).json({ error: 'Wrong password' });
  res.json({ token: jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '12h' }) });
});

app.get('/api/admin/all', auth, w(async (req, res) => {
  res.json(await collect(ALL));
}));

app.put('/api/admin/settings', auth, w(async (req, res) => {
  const data = clean(SETTINGS, req.body);
  await Setting.findByIdAndUpdate('main', { data }, { upsert: true });
  res.json({ ok: true });
}));

app.post('/api/admin/:col', auth, colOk, w(async (req, res) => {
  const col = req.params.col, data = clean(FIELDS[col], req.body);
  const err = validate(col, data);
  if (err) return res.status(400).json({ error: err });
  const d = await Item.create({ col, data });
  res.json(out(d));
}));

app.put('/api/admin/:col/:id', auth, colOk, idOk, w(async (req, res) => {
  const col = req.params.col, data = clean(FIELDS[col], req.body);
  const err = validate(col, data);
  if (err) return res.status(400).json({ error: err });
  const d = await Item.findOneAndUpdate({ _id: req.params.id, col }, { data }, { new: true });
  if (!d) return res.status(404).json({ error: 'Not found' });
  res.json(out(d));
}));

app.delete('/api/admin/:col/:id', auth, colOk, idOk, w(async (req, res) => {
  await Item.deleteOne({ _id: req.params.id, col: req.params.col });
  res.json({ ok: true });
}));

/* branded error page (404 / 500 / 503...) */
const ERR_FILE = path.join(__dirname, 'public', 'error.html');
function errorPage(res, code) {
  res.status(code).set({ 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow' });
  fs.readFile(ERR_FILE, 'utf8', (e, html) => {
    if (e) return res.type('text/plain').send(code === 404 ? 'Page not found' : 'Something went wrong');
    res.type('html').send(html.replace(/__CODE__/g, String(code)));
  });
}

/* admin dashboard lives on its own page: /admin */
app.get('/admin', (req, res, next) => {
  res.set('X-Robots-Tag', 'noindex, nofollow');
  res.sendFile(path.join(__dirname, 'public', 'admin.html'), e => e && next(e));
});

app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
app.use(express.static(path.join(__dirname, 'public')));

/* anything else (typos like /admn, unknown pages) -> nice 404 page */
app.use((req, res) => errorPage(res, 404));

/* errors: API gets JSON, normal pages get the error page */
app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  const code = err.status === 400 || err.status === 413 ? err.status : 500;
  if (code === 500) console.error(err);
  if (req.path.startsWith('/api')) {
    const msg = code === 413 ? 'Upload is too large.' : code === 400 ? 'Bad request.' : 'Server error';
    return res.status(code).json({ error: msg });
  }
  errorPage(res, code);
});

mongoose.connect(MONGODB_URI)
  .then(seed)
  .then(() => app.listen(PORT, () => console.log('Server running at http://localhost:' + PORT)))
  .catch(e => { console.error('Could not connect to MongoDB:', e.message); process.exit(1); });
