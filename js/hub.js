// The hub page: the wheel that picks today's games, and the game cards.

import * as db from './db.js';
import { el, pageHeader, attempt, colorFor, ago, niceDate, resultText } from './ui.js';
import { playDialog, gameDialog, rosterDialog } from './dialogs.js';
import { dateStr, streaks, lastPlayed, wheelWeight, pickGames } from './stats.js';

const app = document.getElementById('app');
const today = dateStr();
const PICKS_KEY = 'teamfun.picks';
const COUNT_KEY = 'teamfun.pickCount';
const SVG = 'http://www.w3.org/2000/svg';

let games = [];
let players = [];
let plays = [];
let spinning = false;

// Today's picks are remembered on this computer so a refresh doesn't lose them.
function loadPicks() {
  try {
    const saved = JSON.parse(localStorage.getItem(PICKS_KEY));
    return saved?.date === today ? saved.ids : [];
  } catch {
    return [];
  }
}

function storePicks(ids) {
  try {
    localStorage.setItem(PICKS_KEY, JSON.stringify({ date: today, ids }));
  } catch {
    /* ignore */
  }
}

function pickCount() {
  try {
    return Math.max(1, Number(localStorage.getItem(COUNT_KEY)) || 1);
  } catch {
    return 1;
  }
}

function storePickCount(n) {
  try {
    localStorage.setItem(COUNT_KEY, String(n));
  } catch {
    /* ignore */
  }
}

const colorOf = (game) => colorFor(Math.max(0, games.findIndex((g) => g.id === game.id)));
const playerName = (id) => players.find((p) => p.id === id)?.name;
const inWheel = () => games.filter((g) => g.inWheel !== false);
const todaysPlays = (gameId) => plays.filter((p) => p.gameId === gameId && p.date === today);

async function reload() {
  await attempt(async () => {
    [games, players, plays] = await Promise.all([db.list('games'), db.list('players'), db.list('plays')]);
  });
  render();
}

// ---- the wheel ---------------------------------------------------------------

const svgEl = (tag, attrs = {}) => {
  const node = document.createElementNS(SVG, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, v);
  return node;
};

// Angles are in degrees, clockwise from the top of the wheel.
const point = (angle, r) => {
  const rad = (angle * Math.PI) / 180;
  return `${(r * Math.sin(rad)).toFixed(2)},${(-r * Math.cos(rad)).toFixed(2)}`;
};

// Draws one slice per game, sized by how long since it was played.
// Returns where each slice sits so the spin can land on it.
function drawWheel(group, pool) {
  group.replaceChildren();
  group.style.transition = 'none';
  group.style.transform = 'rotate(0deg)';
  const slices = [];
  if (!pool.length) {
    group.append(svgEl('circle', { r: 190, fill: 'var(--panel-2)' }));
    return slices;
  }
  const weights = pool.map((g) => wheelWeight(g.id, plays, today));
  const total = weights.reduce((a, b) => a + b, 0);
  let start = 0;
  pool.forEach((game, i) => {
    const size = (weights[i] / total) * 360;
    const end = start + size;
    const fill = colorOf(game);
    if (pool.length === 1) {
      group.append(svgEl('circle', { r: 190, fill }));
    } else {
      group.append(
        svgEl('path', {
          d: `M0,0 L${point(start, 190)} A190,190 0 ${size > 180 ? 1 : 0} 1 ${point(end, 190)} Z`,
          fill,
          stroke: 'var(--panel)',
          'stroke-width': 2,
        }),
      );
    }
    if (size >= 9) {
      // labels on the left half are turned round so they aren't upside down
      const mid = start + size / 2;
      const flipped = mid > 180;
      const label = svgEl('text', {
        class: 'wheel-label',
        x: flipped ? -56 : 56,
        'text-anchor': flipped ? 'end' : 'start',
        'dominant-baseline': 'central',
        transform: `rotate(${(mid + (flipped ? 90 : -90)).toFixed(2)})`,
      });
      label.textContent = game.name.length > 15 ? `${game.name.slice(0, 14)}…` : game.name;
      group.append(label);
    }
    slices.push({ id: game.id, start, size });
    start = end;
  });
  group.append(svgEl('circle', { r: 22, fill: 'var(--panel)', stroke: 'var(--ink)', 'stroke-width': 1.5 }), svgEl('circle', { r: 5, fill: 'var(--ink)' }));
  return slices;
}

function spinTo(group, slice) {
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const seconds = reduced ? 0.2 : 4;
  // land somewhere inside the slice, not always dead centre
  const landing = slice.start + slice.size * (0.2 + Math.random() * 0.6);
  group.getBoundingClientRect(); // make the browser register the reset position first
  group.style.transition = `transform ${seconds}s cubic-bezier(0.12, 0.65, 0.1, 1)`;
  group.style.transform = `rotate(${360 * 6 - landing}deg)`;
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000 + 250));
}

async function spin(group, count) {
  if (spinning) return;
  const pool = inWheel();
  if (!pool.length) return;
  spinning = true;
  const picks = pickGames(pool, plays, today, count);
  const shown = [];
  let remaining = pool;
  storePicks([]);
  renderPicks(shown);
  document.getElementById('spin-btn').disabled = true;
  for (const pick of picks) {
    const slices = drawWheel(group, remaining);
    await spinTo(group, slices.find((s) => s.id === pick.id));
    shown.push(pick.id);
    storePicks(shown);
    renderPicks(shown);
    remaining = remaining.filter((g) => g.id !== pick.id);
    if (shown.length < picks.length) await new Promise((r) => setTimeout(r, 900));
  }
  spinning = false;
  document.getElementById('spin-btn').disabled = false;
}

// ---- pieces of the page ------------------------------------------------------

function playLink(game, label = 'Play') {
  if (!game.url) {
    return el('button', {
      class: 'btn btn-ghost',
      text: 'Add link',
      onclick: () => gameDialog({ game, onDone: reload }),
    });
  }
  return el('a', {
    class: 'btn btn-primary',
    href: game.url,
    target: game.builtin ? null : '_blank',
    rel: game.builtin ? null : 'noopener',
    text: label,
  });
}

function resultChips(game) {
  return todaysPlays(game.id).map((p) =>
    el('span', {
      class: `chip ${p.outcome === 'failed' ? 'chip-bad' : 'chip-good'}`,
      text: resultText(p, playerName),
    }),
  );
}

const logButton = (game, cls = 'btn') =>
  !game.builtin &&
  el('button', {
    class: cls,
    text: 'Log result',
    onclick: () => playDialog({ gameId: game.id, games, players, onDone: reload }),
  });

function renderPicks(ids) {
  const listEl = document.getElementById('picks');
  if (!listEl) return;
  const picked = ids.map((id) => games.find((g) => g.id === id)).filter(Boolean);
  listEl.replaceChildren(
    ...picked.map((game) =>
      el(
        'li',
        { class: 'pick', vars: { '--pick-color': colorOf(game) } },
        el('span', { class: 'pick-name', text: game.name }),
        resultChips(game),
        logButton(game, 'btn btn-small'),
        playLink(game),
      ),
    ),
  );
}

function stage() {
  const pool = inWheel();
  const group = svgEl('g', { class: 'wheel-spin' });
  const svg = svgEl('svg', { class: 'wheel-svg', viewBox: '-200 -200 400 400', role: 'img', 'aria-label': 'Game wheel' });
  svg.append(svgEl('circle', { r: 191, fill: 'none', stroke: 'var(--ink)', 'stroke-width': 1.5 }), group);
  drawWheel(group, pool);

  let count = Math.min(pickCount(), Math.max(1, pool.length));
  const output = el('output', { text: String(count) });
  const step = (delta) => {
    count = Math.min(Math.max(1, count + delta), Math.max(1, inWheel().length));
    output.textContent = String(count);
    storePickCount(count);
  };
  const streak = streaks(plays, today);

  return el(
    'section',
    { class: 'panel stage' },
    el('div', { class: 'wheel-box' }, svg, el('div', { class: 'wheel-pointer' })),
    el(
      'div',
      { class: 'stage-side' },
      el('h1', { text: "What are we playing?" }),
      el(
        'p',
        { class: 'stage-date' },
        niceDate(today),
        streak.current > 0 &&
          el('span', { class: 'streak-badge' }, ' · ', el('b', { text: String(streak.current) }), 'day streak'),
      ),
      el(
        'div',
        { class: 'spin-row' },
        el('button', {
          id: 'spin-btn',
          class: 'btn btn-pink btn-big',
          text: 'Spin',
          disabled: !pool.length,
          onclick: () => spin(group, count),
        }),
        el(
          'div',
          { class: 'stepper' },
          'Pick',
          el('button', { class: 'btn btn-small', text: '−', 'aria-label': 'Pick fewer games', onclick: () => step(-1) }),
          output,
          el('button', { class: 'btn btn-small', text: '+', 'aria-label': 'Pick more games', onclick: () => step(1) }),
          'to play',
        ),
      ),
      !pool.length && el('p', { class: 'muted', text: 'Tick "In the wheel" on at least one game below.' }),
      el('ul', { class: 'picks', id: 'picks' }),
    ),
  );
}

function card(game) {
  const toggle = el('input', {
    type: 'checkbox',
    checked: game.inWheel !== false,
    onchange: async () => {
      const ok = await attempt(async () => {
        await db.save('games', { ...game, inWheel: toggle.checked });
        return true;
      });
      if (!ok) toggle.checked = !toggle.checked;
      reload();
    },
  });
  return el(
    'article',
    { class: 'card', vars: { '--card-color': colorOf(game) } },
    el(
      'div',
      { class: 'card-top' },
      el('h3', { text: game.name }),
      el('span', {
        class: `chip ${game.kind === 'competitive' ? 'chip-versus' : 'chip-team'}`,
        text: game.kind === 'competitive' ? 'Versus' : 'Team',
      }),
    ),
    el('div', { class: 'card-meta' }, ago(lastPlayed(game.id, plays), today), resultChips(game)),
    el('div', { class: 'card-actions' }, playLink(game), logButton(game)),
    el(
      'div',
      { class: 'card-foot' },
      el('label', {}, toggle, ' In the wheel'),
      el('button', { class: 'icon-btn', text: 'Edit', onclick: () => gameDialog({ game, onDone: reload }) }),
    ),
  );
}

function render() {
  app.replaceChildren(
    pageHeader('hub'),
    el(
      'main',
      { class: 'wrap' },
      stage(),
      el(
        'div',
        { class: 'section-title' },
        el('h2', { text: 'All games' }),
        el('button', {
          class: 'btn',
          text: `Team roster (${players.length})`,
          onclick: () => rosterDialog({ onDone: reload }),
        }),
      ),
      el(
        'div',
        { class: 'cards' },
        games.map(card),
        el('button', {
          class: 'card card-add',
          text: '+ Add a game',
          onclick: () => gameDialog({ onDone: reload }),
        }),
      ),
    ),
  );
  renderPicks(loadPicks());
}

reload();
