// The tracker page: streaks, the wins tally and the day-by-day history.

import * as db from './db.js';
import { el, pageHeader, attempt, colorFor, niceDate, resultText } from './ui.js';
import { playDialog } from './dialogs.js';
import { dateStr, streaks, winsByPlayer } from './stats.js';

const app = document.getElementById('app');
let games = [];
let players = [];
let plays = [];

async function reload() {
  await attempt(async () => {
    [games, players, plays] = await Promise.all([db.list('games'), db.list('players'), db.list('plays')]);
  });
  render();
}

const playerName = (id) => players.find((p) => p.id === id)?.name;
const gameName = (play) => games.find((g) => g.id === play.gameId)?.name ?? play.gameName ?? 'A removed game';

const tile = (value, label) =>
  el('div', { class: 'tile' }, el('div', { class: 'tile-value', text: String(value) }), el('div', { class: 'tile-label', text: label }));

function winsSection() {
  const wins = winsByPlayer(plays);
  // people who have left the roster keep their wins, under the name saved at the time
  const formerNames = {};
  for (const p of plays) (p.winners ?? []).forEach((id, i) => (formerNames[id] ??= p.winnerNames?.[i]));
  const rows = [
    ...players.map((p, i) => ({ name: p.name, count: wins[p.id] ?? 0, color: colorFor(i) })),
    ...Object.keys(wins)
      .filter((id) => !playerName(id))
      .map((id) => ({ name: `${formerNames[id] ?? 'Former player'} (left)`, count: wins[id], color: 'var(--ink-dim)' })),
  ].sort((a, b) => b.count - a.count);
  if (!rows.length) {
    return el('p', { class: 'empty', text: 'No players yet. Add your team roster on the Games page.' });
  }
  const most = Math.max(1, ...rows.map((r) => r.count));
  return el(
    'div',
    { class: 'panel wins' },
    rows.map((r) =>
      el(
        'div',
        { class: 'win-row' },
        el('span', { text: r.name }),
        el(
          'div',
          { class: 'win-bar' },
          r.count > 0 && el('span', { style: { width: `${(r.count / most) * 100}%` }, vars: { '--bar-color': r.color } }),
        ),
        el('span', { class: 'win-count', text: String(r.count) }),
      ),
    ),
  );
}

function historySection() {
  if (!plays.length) {
    return el('p', { class: 'empty', text: 'Nothing logged yet. Play a game and its result will show up here.' });
  }
  const days = [...new Set(plays.map((p) => p.date))].sort().reverse();
  return days.map((day) =>
    el(
      'section',
      { class: 'day' },
      el('h3', { text: niceDate(day) }),
      plays
        .filter((p) => p.date === day)
        .sort((a, b) => (a.createdAt ?? '').localeCompare(b.createdAt ?? ''))
        .map((p) =>
          el(
            'div',
            { class: 'entry' },
            el('span', { class: 'entry-game', text: gameName(p) }),
            el('span', { class: 'entry-result', text: resultText(p, playerName) }),
            el('button', {
              class: 'btn btn-small btn-ghost',
              text: 'Edit',
              onclick: () => playDialog({ play: p, games: gamesFor(p), players, onDone: reload }),
            }),
          ),
        ),
    ),
  );
}

// When editing an entry for a game that has since been removed, keep it selectable.
function gamesFor(play) {
  if (games.some((g) => g.id === play.gameId)) return games;
  return [...games, { id: play.gameId, name: gameName(play), kind: play.winners?.length ? 'competitive' : 'collab' }];
}

function render() {
  const s = streaks(plays, dateStr());
  app.replaceChildren(
    pageHeader('tracker'),
    el(
      'main',
      { class: 'wrap' },
      el(
        'div',
        { class: 'tiles' },
        tile(s.current, 'Day streak'),
        tile(s.longest, 'Longest streak'),
        tile(s.days, 'Days played'),
        tile(plays.length, 'Games logged'),
      ),
      el('p', { class: 'muted', style: { marginTop: '10px' }, text: "Weekends don't break a streak." }),
      el('div', { class: 'section-title' }, el('h2', { text: 'Wins' })),
      winsSection(),
      el(
        'div',
        { class: 'section-title' },
        el('h2', { text: 'History' }),
        el('button', {
          class: 'btn btn-primary',
          text: 'Add an entry',
          disabled: !games.length,
          onclick: () => playDialog({ games, players, onDone: reload }),
        }),
      ),
      historySection(),
    ),
  );
}

reload();
