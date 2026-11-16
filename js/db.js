// Saving and loading for the whole hub.
// Three kinds of record: 'games', 'players' and 'plays'.
// With Supabase configured (js/config.js) they are shared online;
// otherwise they live in this browser's own storage.

import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

export const isOnline = Boolean(SUPABASE_URL && SUPABASE_KEY);
const PREFIX = 'teamfun.';
const PASSCODE_KEY = PREFIX + 'passcode';

export const DEFAULT_GAMES = [
  { id: 'top100', name: 'Top 100', url: 'top100.html', kind: 'competitive', builtin: true, inWheel: true },
  { id: 'closest', name: 'Closest Guess', url: 'closest.html', kind: 'competitive', builtin: true, inWheel: true },
  { id: 'link', name: 'Guess the Link', url: 'link.html', kind: 'collab', builtin: true, inWheel: true },
  { id: 'krillion', name: 'Krillion', url: 'https://krillion.io/', kind: 'collab', inWheel: true },
  { id: 'noillurk', name: 'Noillurk', url: '', kind: 'collab', inWheel: true },
  { id: 'crosstunes', name: 'Crosstunes', url: '', kind: 'collab', inWheel: true },
  { id: 'spotle', name: 'Spotle', url: 'https://spotle.io/', kind: 'collab', inWheel: true },
  { id: 'connections', name: 'NYT Connections', url: 'https://www.nytimes.com/games/connections', kind: 'collab', inWheel: true },
  { id: 'contexto', name: 'Contexto', url: 'https://contexto.me/', kind: 'collab', inWheel: true },
  { id: 'bonk', name: 'Bonk', url: 'https://bonk.io/', kind: 'competitive', inWheel: true },
  { id: 'geoguessr', name: 'GeoGuessr', url: 'https://www.geoguessr.com/', kind: 'collab', inWheel: true },
  { id: 'garticphone', name: 'Gartic Phone', url: 'https://garticphone.com/', kind: 'collab', inWheel: true },
];

// The starter cards the very first version shipped with. A browser that has
// saved games but no "seeded" note is assumed to have had exactly these.
const FIRST_SEED = ['top100', 'krillion', 'noillurk', 'crosstunes', 'spotle', 'connections', 'contexto'];

export const newId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

function readLocal(key, fallback) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeLocal(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* storage unavailable (private window): carry on without saving */
  }
}

// ---- passcode -------------------------------------------------------------

let askPasscode = async () => window.prompt('Team passcode');
export function setPasscodePrompt(fn) {
  askPasscode = fn;
}

function storedPasscode() {
  try {
    return localStorage.getItem(PASSCODE_KEY) || '';
  } catch {
    return '';
  }
}

function rememberPasscode(value) {
  try {
    if (value) localStorage.setItem(PASSCODE_KEY, value);
    else localStorage.removeItem(PASSCODE_KEY);
  } catch {
    /* ignore */
  }
}

// ---- online (Supabase) ----------------------------------------------------

const headers = () => ({
  apikey: SUPABASE_KEY,
  Authorization: `Bearer ${SUPABASE_KEY}`,
  'Content-Type': 'application/json',
});

let cache = null; // { games: [...], players: [...], plays: [...] }

async function loadOnline() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/records?select=kind,id,data`, { headers: headers() });
  if (!res.ok) throw new Error(`Could not load saved data (${res.status})`);
  const rows = await res.json();
  const all = { games: [], players: [], plays: [] };
  for (const row of rows) (all[row.kind] ??= []).push({ ...row.data, id: row.id });
  return all;
}

async function callOnline(fn, body) {
  for (let attempt = 0; attempt < 3; attempt++) {
    let passcode = storedPasscode();
    if (!passcode) {
      passcode = await askPasscode(attempt > 0);
      if (!passcode) throw new Error('A team passcode is needed to save changes.');
    }
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ p_passcode: passcode, ...body }),
    });
    if (res.ok) {
      rememberPasscode(passcode);
      return;
    }
    const text = await res.text();
    if (/bad passcode/i.test(text)) {
      rememberPasscode('');
      continue; // ask again
    }
    throw new Error(`Could not save (${res.status})`);
  }
  throw new Error('Wrong passcode.');
}

// ---- public API -----------------------------------------------------------

async function all() {
  if (cache) return cache;
  if (isOnline) {
    cache = await loadOnline();
  } else {
    cache = {
      games: readLocal('games', null),
      players: readLocal('players', []),
      plays: readLocal('plays', []),
    };
    // Add starter cards this browser has never been given. Each is only ever
    // added once, so a card the team deletes later does not come back.
    const seeded = readLocal('seeded', cache.games ? FIRST_SEED : []);
    cache.games ??= [];
    const missing = DEFAULT_GAMES.filter((g) => !seeded.includes(g.id));
    if (missing.length) {
      const have = new Set(cache.games.map((g) => g.id));
      const builtins = missing.filter((g) => g.builtin && !have.has(g.id));
      const links = missing.filter((g) => !g.builtin && !have.has(g.id));
      const lastBuiltin = cache.games.reduce((at, g, i) => (g.builtin ? i : at), -1);
      cache.games.splice(lastBuiltin + 1, 0, ...structuredClone(builtins));
      cache.games.push(...structuredClone(links));
      writeLocal('games', cache.games);
      writeLocal('seeded', DEFAULT_GAMES.map((g) => g.id));
    }
  }
  // Built-in games always follow the code: if one changes from versus to team
  // play (or its page moves), saved copies of its card pick that up.
  cache.games = cache.games.map((g) => {
    const builtin = g.builtin && DEFAULT_GAMES.find((d) => d.builtin && d.id === g.id);
    return builtin ? { ...g, kind: builtin.kind, url: builtin.url } : g;
  });
  return cache;
}

export async function list(kind) {
  return [...(await all())[kind]];
}

export async function save(kind, record) {
  const data = await all();
  const row = { ...record, id: record.id ?? newId() };
  if (isOnline) {
    const { id, ...rest } = row;
    await callOnline('tf_upsert', { p_kind: kind, p_id: id, p_data: rest });
  }
  const i = data[kind].findIndex((r) => r.id === row.id);
  if (i >= 0) data[kind][i] = row;
  else data[kind].push(row);
  if (!isOnline) writeLocal(kind, data[kind]);
  return row;
}

export async function remove(kind, id) {
  const data = await all();
  if (isOnline) await callOnline('tf_delete', { p_kind: kind, p_id: id });
  data[kind] = data[kind].filter((r) => r.id !== id);
  if (!isOnline) writeLocal(kind, data[kind]);
}

// ---- a round in progress (always kept on this computer) --------------------
// Each built-in game has its own slot, so a half-played round of one game
// is not lost by opening another.

const roundKey = (game) => (game === 'top100' ? 'round' : `round.${game}`);
export const loadRound = (game = 'top100') => readLocal(roundKey(game), null);
export const storeRound = (round, game = 'top100') => writeLocal(roundKey(game), round);
export function clearRound(game = 'top100') {
  try {
    localStorage.removeItem(PREFIX + roundKey(game));
  } catch {
    /* ignore */
  }
}
