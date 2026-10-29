// One serverless function that runs the whole quiz. Data lives in Upstash Redis (REST API, no npm packages).
const crypto = require("crypto");
const DEFQ = require("./_questions.js");

const URL_ = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
const TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
const ADMIN_USER = process.env.ADMIN_USER || "alliance";
const ADMIN_PASS = process.env.ADMIN_PASS || "infinity80929";
const SECRET = process.env.ADMIN_SECRET || "secret:" + ADMIN_PASS;
const DEFAULT_STATE = { code: "", phase: "lobby", q: 0, t0: 0, dur: 60, gid: "" };

const E = (m, c = 400) => Object.assign(new Error(m), { code: c });

async function R(...cmd) {
  const r = await fetch(URL_, { method: "POST", headers: { Authorization: "Bearer " + TOKEN }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw E("Database error: " + j.error, 500);
  return j.result;
}

const adminToken = () => crypto.createHmac("sha256", SECRET).update("adm:" + ADMIN_USER + ":" + ADMIN_PASS).digest("hex");
function isAdmin(t) {
  if (typeof t !== "string") return false;
  const a = Buffer.from(t), b = Buffer.from(adminToken());
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

// Short-lived cache so many players polling at once do not each hit the database.
let cache = null;
async function load(fresh) {
  if (!fresh && cache && Date.now() - cache.at < 1200) return cache;
  const [s, q, h] = await Promise.all([R("GET", "state"), R("GET", "questions"), R("HGETALL", "players")]);
  const P = {};
  for (let i = 0; i < (h || []).length; i += 2) P[h[i]] = JSON.parse(h[i + 1]);
  cache = { at: Date.now(), S: s ? JSON.parse(s) : { ...DEFAULT_STATE }, Q: q ? JSON.parse(q) : DEFQ, P };
  return cache;
}
const saveState = async (S) => { await R("SET", "state", JSON.stringify(S)); cache = null; };
const cmp = (x, y) => y.s - x.s || x.tt - y.tt;
const genCode = () => { const A = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; return Array.from(crypto.randomBytes(6), (b) => A[b % A.length]).join(""); };

async function archive(S, Q, P) {
  const L = Object.values(P).sort(cmp);
  if (!S.gid || !L.length) return;
  const rec = {
    gid: S.gid, at: Date.now(), code: S.code, qs: Q,
    players: L.map((p) => ({ n: p.n, s: p.s, c: Q.map((_, i) => (p.a[i] ? p.a[i].c : -1)), p: Q.map((_, i) => (p.a[i] ? p.a[i].p : 0)) })),
  };
  await R("HSET", "results", S.gid, JSON.stringify(rec));
}

function validQuestions(list) {
  if (!Array.isArray(list) || !list.length || list.length > 100) throw E("Provide 1 to 100 questions");
  return list.map((q, i) => {
    const t = String((q && q.t) || "").trim().slice(0, 500);
    const o = Array.isArray(q && q.o) ? q.o.map((x) => String(x).trim().slice(0, 200)) : [];
    const c = Number(q && q.c);
    if (!t || o.length !== 4 || o.some((x) => !x) || !(c >= 0 && c < 4)) throw E("Question " + (i + 1) + " needs text, four options and a correct answer");
    return { t, o, c };
  });
}

async function run(b) {
  if (!URL_ || !TOKEN) throw E("Database not connected. Add the Upstash Redis integration (see README).", 500);
  const a = b.a, now = Date.now();
  if (a === "login") {
    if (b.u === ADMIN_USER && b.p === ADMIN_PASS) return { t: adminToken() };
    throw E("Wrong username or password", 401);
  }
  const adm = isAdmin(b.t);
  if (b.t && !adm) throw E("Session expired, sign in again", 401);

  if (a === "answer") {
    const [sRaw, meRaw] = await Promise.all([R("GET", "state"), R("HGET", "players", String(b.pid || ""))]);
    const S = sRaw ? JSON.parse(sRaw) : { ...DEFAULT_STATE };
    if (!meRaw) throw E("You are not in this game", 404);
    const me = JSON.parse(meRaw), { Q } = await load();
    if (S.phase !== "question") throw E("This question is closed");
    const el = now - S.t0, tot = S.dur * 1000;
    if (el >= tot + 1500) throw E("Time is up");
    if (me.a[S.q]) return { ok: 1 };
    const c = Number(b.c);
    if (!(c >= 0 && c < 4)) throw E("Bad choice");
    const ok = c === Q[S.q].c;
    const p = ok ? 1000 - Math.floor((500 * Math.min(el, tot)) / tot) : 0;
    me.a[S.q] = { c, p, t: el };
    me.s += p;
    if (ok) me.tt += el;
    await R("HSET", "players", b.pid, JSON.stringify(me));
    return { ok: 1 };
  }

  if (a === "join") {
    const { S } = await load(true);
    if (!S.code || String(b.code || "").trim().toUpperCase() !== S.code) throw E("Wrong game code");
    const n = String(b.name || "").trim().slice(0, 20);
    if (!n) throw E("Enter your name");
    const { P } = await load(true);
    if (Object.values(P).some((p) => p.n.toLowerCase() === n.toLowerCase())) throw E("That name is already taken, add an initial");
    const id = crypto.randomBytes(8).toString("hex");
    await R("HSET", "players", id, JSON.stringify({ n, s: 0, tt: 0, a: {} }));
    cache = null;
    return { pid: id, name: n };
  }

  if (a === "state") {
    const { S, Q, P } = await load();
    const ids = Object.keys(P), cnt = ids.length, q = S.q;
    const answered = ids.filter((i) => P[i].a[q]).length;
    let ph = S.phase;
    if (ph === "question" && (now >= S.t0 + S.dur * 1000 || (cnt && answered >= cnt))) ph = "reveal";
    const L = ids.map((i) => ({ id: i, ...P[i] })).sort(cmp);
    const out = { now, phase: ph, q, n: Q.length, dur: S.dur, t0: S.t0, count: cnt };
    if (ph === "question" || ph === "reveal") out.question = { t: Q[q].t, o: Q[q].o };
    const showBoard = ph === "reveal" || ph === "done";
    if (adm) {
      out.admin = true; out.code = S.code; out.answered = answered;
      out.names = L.map((p) => ({ n: p.n, s: p.s, done: !!p.a[q] }));
      if (ph === "question" || ph === "reveal") out.correct = Q[q].c;
      if (showBoard) out.board = L.slice(0, ph === "done" ? 50 : 10).map((p) => ({ n: p.n, s: p.s }));
      if (ph === "done") out.review = Q.map(({ t, o, c }) => ({ t, o, c }));
      return out;
    }
    const me = P[b.pid];
    if (!me) { out.gone = true; delete out.question; return out; }
    out.name = me.n; out.score = me.s; out.rank = L.findIndex((p) => p.id === b.pid) + 1;
    out.myAns = me.a[q] ? { c: me.a[q].c } : null;
    if (ph === "reveal") { out.correct = Q[q].c; out.myAns = me.a[q] || null; }
    if (showBoard) out.board = L.slice(0, ph === "done" ? 50 : 10).map((p) => ({ n: p.n, s: p.s }));
    return out;
  }

  if (!adm) throw E("Admin sign in required", 401);
  const { S, Q, P } = await load(true);

  if (a === "newgame") {
    if (S.phase !== "lobby" && Object.keys(P).length) await archive(S, Q, P);
    await R("DEL", "players");
    await saveState({ code: genCode(), phase: "lobby", q: 0, t0: 0, dur: S.dur || 60, gid: "g" + now });
    return { ok: 1 };
  }
  if (!S.code) throw E("Create a game first");
  if (a === "start") {
    if (!Object.keys(P).length) throw E("Wait for at least one player");
    S.phase = "question"; S.q = 0; S.t0 = now; S.dur = Math.min(300, Math.max(5, Number(b.dur) || 60));
    await saveState(S); return { ok: 1 };
  }
  if (a === "reveal") { S.phase = "reveal"; await saveState(S); return { ok: 1 }; }
  if (a === "next") {
    if (S.q + 1 >= Q.length) { S.phase = "done"; await saveState(S); await archive(S, Q, P); }
    else { S.q += 1; S.phase = "question"; S.t0 = now; await saveState(S); }
    return { ok: 1 };
  }
  if (a === "getq") return { list: Q };
  if (a === "saveq") {
    if (S.phase !== "lobby") throw E("Edit questions only in the lobby");
    await R("SET", "questions", JSON.stringify(validQuestions(b.list))); cache = null; return { ok: 1 };
  }
  if (a === "resetq") { await R("DEL", "questions"); cache = null; return { ok: 1 }; }
  if (a === "results") {
    const h = (await R("HGETALL", "results")) || [], out = [];
    for (let i = 1; i < h.length; i += 2) out.push(JSON.parse(h[i]));
    return { list: out.sort((x, y) => y.at - x.at) };
  }
  if (a === "delresult") { await R("HDEL", "results", String(b.id)); return { ok: 1 }; }
  throw E("Unknown action");
}

module.exports = async (req, res) => {
  res.setHeader("Cache-Control", "no-store");
  try {
    if (req.method !== "POST") return res.status(405).json({ e: "POST only" });
    const b = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    res.status(200).json(await run(b));
  } catch (e) {
    res.status(e.code || 500).json({ e: e.message || "Server error" });
  }
};
