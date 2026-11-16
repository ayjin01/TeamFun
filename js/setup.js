// Pieces every built-in game shares: choosing who is playing, the scoreboard,
// the winner bar, and writing the result to the tracker.

import * as db from './db.js';
import { el, colorFor, attempt, toast } from './ui.js';
import { rosterDialog } from './dialogs.js';
import { dateStr } from './stats.js';

const LAST_PLAYERS_KEY = 'teamfun.lastPlayers';

export function shuffle(items) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export async function fetchText(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load ${path}`);
  return res.text();
}

// Things the team hasn't played yet come first (shuffled), then the rest.
export function freshFirst(ids, usedIds) {
  const used = new Set(usedIds);
  return [...shuffle(ids.filter((id) => !used.has(id))), ...shuffle(ids.filter((id) => used.has(id)))];
}

function lastPlayerIds() {
  try {
    return JSON.parse(localStorage.getItem(LAST_PLAYERS_KEY)) ?? [];
  } catch {
    return [];
  }
}

// The "Who's playing?" tick-boxes. take() returns the ticked players in a
// random order (and remembers them for next time), or null with a message
// if fewer than two are ticked.
export function playerPicker(players, onRosterChange) {
  const remembered = lastPlayerIds();
  const boxes = players.map((p, i) => {
    const input = el('input', { type: 'checkbox', value: p.id, checked: remembered.includes(p.id) });
    return el('label', { class: 'choice', vars: { '--chosen': colorFor(i) } }, input, el('span', { text: p.name }));
  });
  const node = [
    el('h2', { text: "Who's playing?", style: { marginBottom: '14px' } }),
    players.length
      ? el('div', { class: 'choices' }, boxes)
      : el('p', { class: 'muted', text: 'Add your teammates to get started.' }),
    el('button', {
      class: 'btn btn-small',
      style: { marginTop: '16px' },
      text: 'Edit team roster',
      onclick: () => rosterDialog({ onDone: onRosterChange }),
    }),
  ];
  const take = () => {
    const ids = boxes.map((b) => b.querySelector('input')).filter((i) => i.checked).map((i) => i.value);
    if (ids.length < 2) {
      toast('Tick at least two players', 'bad');
      return null;
    }
    try {
      localStorage.setItem(LAST_PLAYERS_KEY, JSON.stringify(ids));
    } catch {
      /* ignore */
    }
    return shuffle(players.filter((p) => ids.includes(p.id)));
  };
  return { node, take };
}

// One row per player: name, score and an optional line underneath.
// options: { turnId, outIds, winners, sub: (player) => text or elements }
export function scoreRows(players, totals, { turnId, outIds = [], winners = [], sub } = {}) {
  return players.map((p, i) =>
    el(
      'div',
      {
        class: `player${turnId === p.id ? ' is-turn' : ''}${outIds.includes(p.id) ? ' is-out' : ''}`,
        vars: { '--player-color': colorFor(i) },
      },
      el('span', { class: 'player-name', text: p.name }),
      el('span', { class: 'player-score', text: String(totals[p.id] ?? 0) }),
      el('span', { class: 'player-dots' }, sub?.(p), winners.includes(p.id) ? ' Winner' : ''),
    ),
  );
}

// The yellow bar shown when a round is over.
export function winnerBar({ names, summary, saved, onSave, onAgain, onLeave }) {
  return el(
    'div',
    { class: 'winner' },
    el('h2', { text: names.length > 1 ? `Shared win: ${names.join(' & ')}` : `${names[0]} wins!` }),
    el('span', { style: { fontWeight: 700 }, text: summary }),
    !saved && el('button', { class: 'btn', text: 'Save result', onclick: onSave }),
    el('button', { class: 'btn', text: 'Play another', onclick: onAgain }),
    el('a', { class: 'btn', href: 'index.html', text: 'Back to the hub', onclick: onLeave }),
  );
}

// Writes a finished round to the tracker. Returns the saved entry, or
// undefined if saving failed (the caller keeps its "Save result" button).
export function savePlay({ round, gameId, gameName, totals, label, details }) {
  const nameOf = (id) => round.players.find((p) => p.id === id)?.name ?? '?';
  const line = round.players.map((p) => `${p.name} ${totals[p.id]}`).join(', ');
  return attempt(() =>
    db.save('plays', {
      id: round.playId,
      date: round.date ?? dateStr(),
      gameId,
      gameName,
      outcome: 'won',
      winners: round.winners,
      winnerNames: round.winners.map(nameOf),
      score: label ? `${label}: ${line}` : line,
      details: {
        ...details,
        results: round.players.map((p) => ({ id: p.id, name: p.name, points: totals[p.id] })),
      },
      createdAt: new Date().toISOString(),
    }),
  );
}
