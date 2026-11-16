// The Guess the Link screen: two clues to start, then one more at a time, and the
// whole team works out what connects them, sharing one score.

import * as db from './db.js';
import { el, pageHeader, attempt, toast, confirmDialog } from './ui.js';
import { fetchText, freshFirst } from './setup.js';
import * as game from './link-game.js';
import { dateStr } from './stats.js';
import { parsePuzzles } from './lists.js';

const GAME = 'link';
const app = document.getElementById('app');

let puzzles = [];
let plays = [];
let round = null;
let lastWrong = null; // text of the wrong guess just made, for the message under the clues

const puzzleById = (id) => puzzles.find((p) => p.id === id);
const save = () => db.storeRound(round, GAME);
const points = (n) => `${n} point${n === 1 ? '' : 's'}`;

// The team's best score so far, as a share of the points on offer
// (rounds can differ in length), or null if this is the first round.
function bestBefore() {
  const past = plays.filter((p) => p.gameId === GAME && p.id !== round?.playId && p.details?.max > 0);
  if (!past.length) return null;
  return past.reduce((best, p) => (p.details.total / p.details.max > best.details.total / best.details.max ? p : best));
}

// ---- setup screen ------------------------------------------------------------

function renderSetup() {
  document.body.classList.remove('game-page');
  const used = plays.filter((p) => p.gameId === GAME).flatMap((p) => p.details?.puzzleIds ?? []);
  const unused = puzzles.filter((p) => !used.includes(p.id)).length;
  const count = Math.min(game.PUZZLES_PER_ROUND, puzzles.length);
  const best = bestBefore();

  const start = () => {
    if (!puzzles.length) return toast('No puzzles found', 'bad');
    round = game.createRound(freshFirst(puzzles.map((p) => p.id), used).slice(0, count));
    round.date = dateStr();
    lastWrong = null;
    save();
    renderGame();
  };

  app.replaceChildren(
    pageHeader(GAME),
    el(
      'main',
      { class: 'wrap' },
      el(
        'div',
        { class: 'setup' },
        el(
          'section',
          { class: 'panel category-card' },
          el('div', { class: 'category-kicker', text: 'Four clues, one connection' }),
          el('h1', { class: 'category-title', text: 'Guess the Link' }),
          el('p', { text: 'What do they have in common? Work it out together. The fewer clues you need, the more you score.' }),
          el('p', {
            class: 'muted',
            text: unused >= count ? `${unused} puzzles you haven't seen yet.` : "You've seen most of the puzzles, so some repeats are back in.",
          }),
          best && el('p', { class: 'muted', text: `Team best: ${best.details.total} of ${best.details.max}.` }),
        ),
        el(
          'section',
          { class: 'panel' },
          el('h2', { text: 'How it works', style: { marginBottom: '10px' } }),
          el(
            'ul',
            { class: 'rules' },
            el('li', { text: `One team, ${count} puzzles, one score.` }),
            el('li', { text: 'You start with two clues. Talk it over, then guess the link or ask for the next clue.' }),
            el('li', { text: `Solve it with two clues for ${game.POINTS[0]} points, three for ${game.POINTS[1]}, all four for ${game.POINTS[2]}.` }),
            el('li', { text: 'A wrong guess uses up that clue. Wrong after the fourth clue scores nothing.' }),
            el('li', { text: 'If the computer turns down a fair answer, press "We\'ll allow it".' }),
            el('li', { text: `Try to beat the team's best score. A perfect round is ${count * game.POINTS[0]}.` }),
          ),
        ),
      ),
      el('div', { class: 'start-row' }, el('button', { class: 'btn btn-primary btn-big', text: 'Start round', onclick: start })),
    ),
  );
}

// ---- game screen -------------------------------------------------------------

function heading() {
  if (round.status === 'finished') return 'Final score';
  const number = round.turns.length + (round.phase === 'revealed' ? 0 : 1);
  return `Puzzle ${number} of ${round.puzzleIds.length}`;
}

// The side panel: the team's score, and how each puzzle went.
function teamPanel() {
  const best = bestBefore();
  return [
    el(
      'div',
      { class: 'team-score' },
      el('span', { class: 'team-score-label', text: 'Team score' }),
      el('span', { class: 'team-score-value', text: String(game.total(round)) }),
      el('span', { class: 'muted', text: `of ${game.maxTotal(round)} possible` }),
      best && el('span', { class: 'muted', text: `Team best: ${best.details.total} of ${best.details.max}` }),
    ),
    el(
      'ol',
      { class: 'puzzle-log' },
      round.puzzleIds.map((id, i) => {
        const turn = round.turns[i];
        const isCurrent = !turn && i === round.turns.length && round.status === 'playing';
        return el(
          'li',
          { class: turn ? (turn.solved ? 'is-solved' : 'is-missed') : isCurrent ? 'is-current' : '' },
          el('span', { class: 'puzzle-log-name', text: turn ? puzzleById(id).link : `Puzzle ${i + 1}` }),
          el('span', { class: 'puzzle-log-points', text: turn ? (turn.solved ? `+${turn.points}` : '0') : '' }),
        );
      }),
    ),
  ];
}

function clueCards(puzzle, shown) {
  return el(
    'div',
    { class: 'clues' },
    puzzle.clues.slice(0, game.CLUES).map((clue, i) =>
      el(
        'div',
        { class: `clue${i < shown ? ' is-shown' : ''}${i === shown - 1 && shown > game.START_CLUES ? ' is-new' : ''}` },
        el('span', { class: 'clue-points', text: `${game.pointsFor(i + 1)} pt${game.pointsFor(i + 1) === 1 ? '' : 's'}` }),
        el('span', { class: 'clue-text', text: i < shown ? clue : '?' }),
      ),
    ),
  );
}

function playPanel(puzzle) {
  const shown = round.current.cluesShown;
  return [
    el('p', { class: 'quiz-unit', text: 'What links these?' }),
    clueCards(puzzle, shown),
    el('p', {
      class: `link-status${lastWrong ? ' is-wrong' : ''}`,
      text: lastWrong ? `"${lastWrong}" isn't it. Here's another clue.` : `Solve it now for ${points(game.pointsFor(shown))}.`,
    }),
  ];
}

function revealPanel(turn) {
  const puzzle = puzzleById(turn.puzzleId);
  return [
    clueCards(puzzle, game.CLUES),
    el('div', { class: 'quiz-answer' }, el('span', { class: 'muted', text: 'The link' }), el('b', { text: puzzle.link })),
    puzzle.note && el('p', { class: 'quiz-note', text: puzzle.note }),
    el('p', {
      class: `link-status ${turn.solved ? 'is-right' : 'is-wrong'}`,
      text: turn.solved ? `${points(turn.points)} for the team${turn.allowed ? ' (allowed)' : ''}.` : 'No points this time.',
    }),
    !turn.solved &&
      turn.guesses.length > 0 &&
      el(
        'div',
        { class: 'allow-box' },
        el('span', { class: 'muted', text: 'Was a guess close enough?' }),
        turn.guesses.map((g, i) =>
          el(
            'div',
            { class: 'allow-row' },
            el('span', { text: `"${g.text}"` }),
            el('button', {
              class: 'btn btn-small',
              text: `We'll allow it (+${game.pointsFor(g.clues)})`,
              onclick: () => {
                game.allow(round, i);
                save();
                renderGame();
              },
            }),
          ),
        ),
      ),
  ];
}

function guessBar(puzzle) {
  const input = el('input', {
    class: 'guess-input',
    autocomplete: 'off',
    autocapitalize: 'off',
    spellcheck: 'false',
    placeholder: 'What is the link?',
    'aria-label': "The team's guess",
  });
  const refresh = () => {
    save();
    renderGame();
  };
  const submit = (e) => {
    e.preventDefault();
    const text = input.value.trim();
    if (!text) return;
    const outcome = game.guess(round, text, puzzle.accept);
    lastWrong = outcome === 'wrong' ? text : null;
    refresh();
  };
  const allShown = round.current.cluesShown >= game.CLUES;
  return el(
    'div',
    { class: 'guess-bar' },
    el(
      'div',
      {},
      el('div', { class: 'guess-prompt', text: "Team, what's the link?" }),
      el('div', { class: 'muted', text: `${round.current.cluesShown} of ${game.CLUES} clues showing` }),
    ),
    el(
      'form',
      { class: 'guess-form', onsubmit: submit },
      input,
      el('button', { class: 'btn btn-primary', text: 'Guess' }),
      el('button', {
        type: 'button',
        class: 'btn',
        text: allShown ? 'Give up' : 'Next clue',
        onclick: () => {
          lastWrong = null;
          if (allShown) game.giveUp(round);
          else game.nextClue(round);
          refresh();
        },
      }),
    ),
  );
}

function resultBar() {
  const total = game.total(round);
  const max = game.maxTotal(round);
  const best = bestBefore();
  const isBest = best && total / max > best.details.total / best.details.max;
  return el(
    'div',
    { class: 'winner' },
    el('h2', { text: `${total} of ${max}` }),
    el('span', {
      style: { fontWeight: 700 },
      text: total === max ? 'A perfect round!' : isBest ? 'A new team best!' : best ? `Team best: ${best.details.total} of ${best.details.max}` : 'Your first score to beat',
    }),
    !round.saved && el('button', { class: 'btn', text: 'Save result', onclick: saveResult }),
    el('button', { class: 'btn', text: 'Play another', onclick: again }),
    el('a', { class: 'btn', href: 'index.html', text: 'Back to the hub', onclick: () => round.saved && db.clearRound(GAME) }),
  );
}

async function again() {
  db.clearRound(GAME);
  round = null;
  await init();
}

async function abandon() {
  const ok = await confirmDialog('Abandon this round?', "It won't count, and nothing is saved to the tracker.", 'Abandon');
  if (ok) again();
}

// Writes the finished round to the tracker (once), as a team result.
async function saveResult() {
  if (!round || round.saved || round.status !== 'finished') return;
  const total = game.total(round);
  const max = game.maxTotal(round);
  const saved = await attempt(() =>
    db.save('plays', {
      id: round.playId,
      date: round.date ?? dateStr(),
      gameId: GAME,
      gameName: 'Guess the Link',
      outcome: '',
      winners: [],
      score: `${total} of ${max} points`,
      details: { puzzleIds: round.turns.map((t) => t.puzzleId), points: round.turns.map((t) => t.points), total, max },
      createdAt: new Date().toISOString(),
    }),
  );
  if (!saved) return; // the "Save result" button stays so it can be retried
  round.saved = true;
  round.playId = saved.id;
  save();
  plays = await db.list('plays');
  toast('Result saved to the tracker', 'good');
  renderGame();
}

function renderGame() {
  document.body.classList.add('game-page');
  const finished = round.status === 'finished';
  const revealed = finished || round.phase === 'revealed';
  const lastTurn = round.turns[round.turns.length - 1];

  let bar;
  if (finished) {
    bar = resultBar();
  } else if (revealed) {
    const last = game.isLastPuzzle(round);
    bar = el(
      'div',
      { class: 'guess-bar' },
      el('div', { class: 'guess-prompt', text: last ? "That's the last one" : 'Ready for the next one?' }),
      el('button', {
        class: 'btn btn-primary btn-big next-btn',
        text: last ? 'See the result' : 'Next puzzle',
        onclick: () => {
          game.next(round);
          lastWrong = null;
          save();
          renderGame();
          if (round.status === 'finished') saveResult();
        },
      }),
    );
  } else {
    bar = guessBar(puzzleById(game.currentPuzzleId(round)));
  }

  app.replaceChildren(
    pageHeader(GAME),
    el(
      'main',
      { class: 'game' },
      el(
        'div',
        { class: 'game-top' },
        el('h1', { text: heading() }),
        !finished && el('button', { class: 'btn btn-small btn-ghost', text: 'Abandon round', onclick: abandon }),
      ),
      el('aside', { class: 'scoreboard' }, teamPanel()),
      el(
        'section',
        { class: 'panel quiz-stage' },
        revealed ? revealPanel(lastTurn) : playPanel(puzzleById(game.currentPuzzleId(round))),
      ),
      bar,
    ),
  );
  (app.querySelector('.guess-input') ?? app.querySelector('.next-btn'))?.focus();
}

// ---- start -------------------------------------------------------------------

async function init() {
  await attempt(async () => {
    const [text, pl] = await Promise.all([fetchText('data/link/puzzles.txt'), db.list('plays')]);
    puzzles = parsePuzzles(text).filter((x) => x.clues.length >= game.CLUES && x.accept.length);
    plays = pl;
  });

  round = db.loadRound(GAME);
  if (round && (round.saved || !Array.isArray(round.puzzleIds) || round.puzzleIds.some((id) => !puzzleById(id)))) {
    // a finished round left over from last time, one from the old head-to-head
    // version, or one whose puzzles have since changed
    db.clearRound(GAME);
    round = null;
  }
  if (round) {
    renderGame();
    if (round.status === 'finished') saveResult();
    return;
  }
  renderSetup();
}

init();
