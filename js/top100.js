// The Top 100 game screen: choose players and a category, take turns
// guessing, then reveal the full list and record the winner.

import * as db from './db.js';
import { el, pageHeader, attempt, toast, colorFor, confirmDialog } from './ui.js';
import { playerPicker, winnerBar as sharedWinnerBar } from './setup.js';
import { createRound, applyGuess, currentPlayer, scores, guessesLeft, GUESSES_EACH, MAX_TIEBREAKS } from './game.js';
import { dateStr } from './stats.js';
import { parseList } from './lists.js';

const app = document.getElementById('app');

let catalogue = []; // list file names, without the .txt
let players = [];
let plays = [];
let round = null; // the round in progress, if any
let list = null; // the full list for the round or the category on offer
let offered = null; // slug of the category shown on the setup screen
let lastTurn = null;

async function fetchJson(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load ${path}`);
  return res.json();
}

async function loadList(slug) {
  const res = await fetch(`data/lists/${slug}.txt`, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Could not load the list "${slug}"`);
  return parseList(await res.text());
}

// Categories the team hasn't played yet (or all of them once every one is used).
function freshSlugs() {
  const used = new Set(plays.filter((p) => p.gameId === 'top100').map((p) => p.details?.listSlug));
  const fresh = catalogue.filter((slug) => !used.has(slug));
  return { slugs: fresh.length ? fresh : [...catalogue], allUsed: !fresh.length };
}

async function offerCategory(avoid) {
  const { slugs } = freshSlugs();
  const options = slugs.length > 1 ? slugs.filter((s) => s !== avoid) : slugs;
  offered = options[Math.floor(Math.random() * options.length)] ?? null;
  list = offered ? await attempt(() => loadList(offered)) : null;
}

const sourceLine = (l) =>
  el(
    'p',
    { class: 'source' },
    'Source: ',
    l.url ? el('a', { href: l.url, target: '_blank', rel: 'noopener', text: l.source }) : l.source,
    l.asOf ? ` · ${l.asOf}` : '',
  );

// ---- setup screen ------------------------------------------------------------

function renderSetup() {
  document.body.classList.remove('game-page');
  const picker = playerPicker(players, init);
  const { slugs, allUsed } = freshSlugs();

  const start = () => {
    if (!list) return toast('No category loaded', 'bad');
    const playing = picker.take();
    if (!playing) return;
    round = createRound(offered, playing);
    round.date = dateStr();
    lastTurn = null;
    db.storeRound(round);
    renderGame();
  };

  app.replaceChildren(
    pageHeader('top100'),
    el(
      'main',
      { class: 'wrap' },
      el(
        'div',
        { class: 'setup' },
        el(
          'section',
          { class: 'panel category-card' },
          el('div', { class: 'category-kicker', text: "Today's category" }),
          list
            ? [el('h1', { class: 'category-title', text: list.title }), list.note && el('p', { text: list.note }), sourceLine(list)]
            : el('p', { class: 'muted', text: 'No lists found.' }),
          el('button', {
            class: 'btn',
            text: 'Pick a different one',
            disabled: slugs.length < 2,
            onclick: async () => {
              await offerCategory(offered);
              renderSetup();
            },
          }),
          allUsed &&
            catalogue.length > 0 &&
            el('p', { class: 'muted', style: { marginTop: '12px' }, text: "You've played every list, so repeats are back in." }),
        ),
        el(
          'section',
          { class: 'panel' },
          picker.node,
          el('h2', { text: 'How it works', style: { margin: '26px 0 10px' } }),
          el(
            'ul',
            { class: 'rules' },
            el('li', { text: `Take turns. Everyone gets ${GUESSES_EACH} guesses.` }),
            el('li', { text: 'Name something on the list. Its position is your score: number 90 scores 90.' }),
            el('li', { text: 'Not on the list, or already found? No points, and the turn is gone.' }),
            el('li', { text: 'Small spelling slips are forgiven.' }),
            el('li', { text: 'A tie goes to sudden death: one extra guess each.' }),
          ),
        ),
      ),
      el('div', { class: 'start-row' }, el('button', { class: 'btn btn-primary btn-big', text: 'Start round', onclick: start })),
    ),
  );
}

// ---- game screen -------------------------------------------------------------

const indexOfPlayer = (id) => round.players.findIndex((p) => p.id === id);
const colorOfPlayer = (id) => colorFor(indexOfPlayer(id));
const nameOfPlayer = (id) => round.players.find((p) => p.id === id)?.name ?? '?';

function scoreboard(turnPlayer) {
  const totals = scores(round);
  return round.players.map((p) => {
    const left = guessesLeft(round, p.id);
    const out = round.tiebreak > 0 && round.status === 'playing' && !round.tiebreakPlayers.includes(p.id);
    return el(
      'div',
      {
        class: `player${turnPlayer?.id === p.id ? ' is-turn' : ''}${out ? ' is-out' : ''}`,
        vars: { '--player-color': colorOfPlayer(p.id) },
      },
      el('span', { class: 'player-name', text: p.name }),
      el('span', { class: 'player-score', text: String(totals[p.id]) }),
      el(
        'span',
        { class: 'player-dots', 'aria-label': `${left} guesses left` },
        Array.from({ length: round.guessesEach }, (_, i) =>
          el('span', { class: `dot${i < round.guessesEach - left ? ' is-used' : ''}` }),
        ),
        round.winners.includes(p.id) ? ' Winner' : '',
      ),
    );
  });
}

function detailOf(rank) {
  const detail = list.items.find((item) => item.rank === rank)?.detail;
  return detail ? ` (${detail})` : '';
}

function lastGuessBox() {
  if (!lastTurn) return el('div', { class: 'last-guess muted', text: 'Guesses will show up here.' });
  const who = nameOfPlayer(lastTurn.playerId);
  if (lastTurn.result === 'correct') {
    return el(
      'div',
      { class: 'last-guess last-correct' },
      el('b', { text: `+${lastTurn.points} points` }),
      `${who} found number ${lastTurn.rank}: ${lastTurn.answer}${detailOf(lastTurn.rank)}`,
    );
  }
  if (lastTurn.result === 'duplicate') {
    return el(
      'div',
      { class: 'last-guess last-duplicate' },
      el('b', { text: 'Already found' }),
      `${lastTurn.answer} is already on the board. No points for ${who}.`,
    );
  }
  return el(
    'div',
    { class: 'last-guess last-wrong' },
    el('b', { text: 'Not on the list' }),
    `"${lastTurn.guess}" scores nothing for ${who}.`,
  );
}

function board(finished) {
  const finder = new Map(round.turns.filter((t) => t.result === 'correct').map((t) => [t.rank, t.playerId]));
  return el(
    'div',
    { class: 'board' },
    list.items.map((item) => {
      const by = finder.get(item.rank);
      const isNew = lastTurn?.result === 'correct' && lastTurn.rank === item.rank;
      const cls = by ? `slot is-found${isNew ? ' is-new' : ''}` : finished ? 'slot is-missed' : 'slot';
      return el(
        'div',
        {
          class: cls,
          vars: by ? { '--slot-color': colorOfPlayer(by) } : null,
          title: by
            ? `${item.answer}${detailOf(item.rank)}, found by ${nameOfPlayer(by)}`
            : finished
              ? `${item.answer}${detailOf(item.rank)}`
              : null,
        },
        el('span', { class: 'slot-rank', text: String(item.rank) }),
        el('span', { class: 'slot-answer', text: by || finished ? item.answer : '' }),
      );
    }),
  );
}

function guessBar(turnPlayer) {
  const input = el('input', {
    class: 'guess-input',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    placeholder: 'Type a guess and press Enter',
    'aria-label': `${turnPlayer.name}'s guess`,
  });
  const submit = (e) => {
    e.preventDefault();
    const guess = input.value.trim();
    if (!guess) return;
    lastTurn = applyGuess(round, guess, list.items);
    db.storeRound(round);
    renderGame();
    if (round.status === 'finished') saveResult();
  };
  const left = guessesLeft(round, turnPlayer.id);
  return el(
    'div',
    { class: 'guess-bar', vars: { '--turn-color': colorOfPlayer(turnPlayer.id) } },
    el(
      'div',
      {},
      round.tiebreak > 0 &&
        el('div', { class: 'tiebreak-banner', text: `Sudden death ${round.tiebreak} of ${MAX_TIEBREAKS}` }),
      el('div', { class: 'guess-prompt', text: `${turnPlayer.name}, you're up` }),
      el('div', {
        class: 'muted',
        text: round.tiebreak > 0 ? 'One guess to break the tie' : `Guess ${round.guessesEach - left + 1} of ${round.guessesEach}`,
      }),
    ),
    el('form', { class: 'guess-form', onsubmit: submit }, input, el('button', { class: 'btn btn-primary', text: 'Guess' })),
  );
}

function winnerBar() {
  const names = round.winners.map(nameOfPlayer);
  const top = Math.max(...Object.values(scores(round)));
  const again = async () => {
    db.clearRound();
    round = null;
    lastTurn = null;
    await init();
  };
  return sharedWinnerBar({
    names,
    summary: `${top} points`,
    saved: round.saved,
    onSave: saveResult,
    onAgain: again,
    onLeave: () => round.saved && db.clearRound(),
  });
}

async function abandon() {
  const ok = await confirmDialog('Abandon this round?', "It won't count, and nothing is saved to the tracker.", 'Abandon');
  if (!ok) return;
  db.clearRound();
  round = null;
  lastTurn = null;
  await init();
}

// Writes the finished round to the tracker (once).
async function saveResult() {
  if (!round || round.saved || round.status !== 'finished') return;
  const totals = scores(round);
  const saved = await attempt(() =>
    db.save('plays', {
      id: round.playId,
      date: round.date ?? dateStr(),
      gameId: 'top100',
      gameName: 'Top 100',
      outcome: 'won',
      winners: round.winners,
      winnerNames: round.winners.map(nameOfPlayer),
      score: `${list.title}: ${round.players.map((p) => `${p.name} ${totals[p.id]}`).join(', ')}`,
      details: {
        listSlug: round.listSlug,
        listTitle: list.title,
        results: round.players.map((p) => ({ id: p.id, name: p.name, points: totals[p.id] })),
      },
      createdAt: new Date().toISOString(),
    }),
  );
  if (!saved) return; // the "Save result" button stays so it can be retried
  round.saved = true;
  round.playId = saved.id;
  db.storeRound(round);
  toast('Result saved to the tracker', 'good');
  renderGame();
}

function renderGame() {
  document.body.classList.add('game-page');
  const finished = round.status === 'finished';
  const turnPlayer = currentPlayer(round);
  app.replaceChildren(
    pageHeader('top100'),
    el(
      'main',
      { class: 'game' },
      el(
        'div',
        { class: 'game-top' },
        el('h1', { text: list.title }),
        sourceLine(list),
        !finished && el('button', { class: 'btn btn-small btn-ghost', text: 'Abandon round', onclick: abandon }),
      ),
      el('aside', { class: 'scoreboard' }, scoreboard(turnPlayer), lastGuessBox()),
      board(finished),
      finished ? winnerBar() : guessBar(turnPlayer),
    ),
  );
  app.querySelector('.guess-input')?.focus();
}

// ---- start -------------------------------------------------------------------

async function init() {
  await attempt(async () => {
    [catalogue, players, plays] = await Promise.all([
      fetchJson('data/lists/index.json'),
      db.list('players'),
      db.list('plays'),
    ]);
  });

  round = db.loadRound();
  if (round?.saved) {
    // a finished, saved round left over from last time: start fresh
    db.clearRound();
    round = null;
  }
  if (round) {
    list = await attempt(() => loadList(round.listSlug));
    if (list) {
      lastTurn = round.turns[round.turns.length - 1] ?? null;
      renderGame();
      if (round.status === 'finished') saveResult();
      return;
    }
    db.clearRound();
    round = null;
  }
  await offerCategory();
  renderSetup();
}

init();
