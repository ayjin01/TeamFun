// The Closest Guess screen: everyone secretly guesses a number,
// then the answer is revealed and the nearest guesses score.

import * as db from './db.js';
import { el, pageHeader, attempt, toast, colorFor, confirmDialog } from './ui.js';
import { playerPicker, scoreRows, winnerBar, savePlay, fetchText, freshFirst } from './setup.js';
import * as game from './closest-game.js';
import { dateStr } from './stats.js';
import { parseQuestions } from './lists.js';

const GAME = 'closest';
const app = document.getElementById('app');

let questions = [];
let players = [];
let plays = [];
let round = null;

const questionById = (id) => questions.find((q) => q.id === id);
const indexOfPlayer = (id) => round.players.findIndex((p) => p.id === id);
const nameOfPlayer = (id) => round.players.find((p) => p.id === id)?.name ?? '?';

// Years are shown without a thousands comma (1889, not 1,889).
function formatNumber(value, question) {
  if (question?.unit === 'year') return String(value);
  return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
}
const withUnit = (value, question) =>
  question.unit && question.unit !== 'year' ? `${formatNumber(value, question)} ${question.unit}` : formatNumber(value, question);

const save = () => db.storeRound(round, GAME);

// ---- setup screen ------------------------------------------------------------

function renderSetup() {
  document.body.classList.remove('game-page');
  const picker = playerPicker(players, init);
  const used = plays.filter((p) => p.gameId === GAME).flatMap((p) => p.details?.questionIds ?? []);
  const unused = questions.filter((q) => !used.includes(q.id)).length;

  const start = () => {
    if (questions.length < 2) return toast('No questions found', 'bad');
    const playing = picker.take();
    if (!playing) return;
    const order = freshFirst(questions.map((q) => q.id), used);
    const count = Math.min(game.QUESTIONS_PER_ROUND, order.length);
    round = game.createRound(order.slice(0, count), playing, order.slice(count));
    round.date = dateStr();
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
          el('div', { class: 'category-kicker', text: 'How many? How far? How old?' }),
          el('h1', { class: 'category-title', text: 'Closest Guess' }),
          el('p', { text: `${game.QUESTIONS_PER_ROUND} questions, each with a number for an answer. Nearest guess takes the points.` }),
          el('p', {
            class: 'muted',
            text: unused >= game.QUESTIONS_PER_ROUND
              ? `${unused} questions you haven't seen yet.`
              : "You've seen most of the questions, so some repeats are back in.",
          }),
        ),
        el(
          'section',
          { class: 'panel' },
          picker.node,
          el('h2', { text: 'How it works', style: { margin: '26px 0 10px' } }),
          el(
            'ul',
            { class: 'rules' },
            el('li', { text: 'Everyone types a guess in turn. Guesses stay hidden until all are in, so look away when it is not your go.' }),
            el('li', { text: `Closest scores ${game.POINTS_CLOSEST}. Second closest scores ${game.POINTS_SECOND} (with three or more players).` }),
            el('li', { text: `Exactly right? ${game.POINTS_EXACT_BONUS} bonus point.` }),
            el('li', { text: 'Equally close guesses score the same.' }),
            el('li', { text: 'A tie at the end goes to sudden death: one more question for the leaders.' }),
          ),
        ),
      ),
      el('div', { class: 'start-row' }, el('button', { class: 'btn btn-primary btn-big', text: 'Start round', onclick: start })),
    ),
  );
}

// ---- game screen -------------------------------------------------------------

function heading() {
  if (round.status === 'finished') return 'Final scores';
  if (round.tiebreak > 0) return `Sudden death ${round.tiebreak} of ${Math.min(game.MAX_TIEBREAKS, round.spareIds.length)}`;
  return `Question ${round.index + 1} of ${round.questionIds.length}`;
}

function numberLine(result, question) {
  const entries = Object.entries(result.guesses);
  const values = [...entries.map(([, v]) => v), result.answer];
  const min = Math.min(...values);
  const max = Math.max(...values);
  const at = (v) => (max === min ? 50 : ((v - min) / (max - min)) * 100);
  return el(
    'div',
    { class: 'numline', role: 'img', 'aria-label': 'Guesses and the answer on a number line' },
    el('div', { class: 'numline-track' }),
    el('div', { class: 'numline-answer', vars: { '--at': String(at(result.answer) / 100) } }, el('span', { text: 'Answer' })),
    entries.map(([id, v], i) =>
      el(
        'div',
        { class: `numline-guess row-${i % 3}`, vars: { '--at': String(at(v) / 100), '--player-color': colorFor(indexOfPlayer(id)) } },
        el('span', { text: nameOfPlayer(id) }),
      ),
    ),
    el('span', { class: 'numline-end numline-min', text: formatNumber(min, question) }),
    el('span', { class: 'numline-end numline-max', text: formatNumber(max, question) }),
  );
}

function revealPanel(result) {
  const question = questionById(result.questionId);
  const ranked = Object.entries(result.guesses)
    .map(([id, value]) => ({ id, value, off: Math.abs(value - result.answer), points: result.points[id] }))
    .sort((a, b) => a.off - b.off);
  return [
    el('p', { class: 'quiz-question is-small', text: question.question }),
    el('div', { class: 'quiz-answer' }, el('span', { class: 'muted', text: 'The answer is' }), el('b', { text: withUnit(result.answer, question) })),
    question.note && el('p', { class: 'quiz-note', text: question.note }),
    numberLine(result, question),
    el(
      'ol',
      { class: 'closest-list' },
      ranked.map((r) =>
        el(
          'li',
          { class: r.points ? 'is-scoring' : '', vars: { '--player-color': colorFor(indexOfPlayer(r.id)) } },
          el('span', { class: 'closest-name', text: nameOfPlayer(r.id) }),
          el('span', { class: 'closest-guess', text: formatNumber(r.value, question) }),
          el('span', { class: 'closest-off', text: r.off === 0 ? 'spot on!' : `off by ${formatNumber(r.off, {})}` }),
          el('span', { class: 'closest-points', text: r.points ? `+${r.points}` : '' }),
        ),
      ),
    ),
    el(
      'p',
      { class: 'source' },
      'Source: ',
      question.url ? el('a', { href: question.url, target: '_blank', rel: 'noopener', text: question.source }) : question.source,
      question.asOf ? ` · ${question.asOf}` : '',
    ),
  ];
}

function questionPanel(question) {
  const order = game.guessOrder(round);
  return [
    round.tiebreak > 0 && el('div', { class: 'tiebreak-banner', text: 'Sudden death' }),
    el('p', { class: 'quiz-question', text: question.question }),
    question.unit && el('p', { class: 'quiz-unit', text: question.unit === 'year' ? 'Answer with a year' : `Answer in ${question.unit}` }),
    el(
      'div',
      { class: 'lock-row' },
      order.map((p) =>
        el('span', {
          class: `lock${p.id in round.guesses ? ' is-in' : ''}`,
          vars: { '--player-color': colorFor(indexOfPlayer(p.id)) },
          text: p.id in round.guesses ? `${p.name}: locked in` : p.name,
        }),
      ),
    ),
  ];
}

function guessBar(guesser, question) {
  const input = el('input', {
    class: 'guess-input is-secret',
    autocomplete: 'off',
    inputmode: 'decimal',
    spellcheck: 'false',
    placeholder: 'Type a number (it stays hidden)',
    'aria-label': `${guesser.name}'s guess`,
  });
  const submit = (e) => {
    e.preventDefault();
    const value = game.parseGuess(input.value);
    if (value === null) {
      input.value = '';
      return toast('Type a number, for example 1500 or 2.5', 'bad');
    }
    game.addGuess(round, value);
    save();
    renderGame();
  };
  return el(
    'div',
    { class: 'guess-bar', vars: { '--turn-color': colorFor(indexOfPlayer(guesser.id)) } },
    el(
      'div',
      {},
      el('div', { class: 'guess-prompt', text: `${guesser.name}, your guess` }),
      el('div', { class: 'muted', text: 'Everyone else: eyes off the keyboard' }),
    ),
    el('form', { class: 'guess-form', onsubmit: submit }, input, el('button', { class: 'btn btn-primary', text: 'Lock in' })),
  );
}

function actionBar(prompt, label, run) {
  return el(
    'div',
    { class: 'guess-bar' },
    el('div', { class: 'guess-prompt', text: prompt }),
    el('button', { class: 'btn btn-primary btn-big next-btn', text: label, onclick: run }),
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

async function saveResult() {
  if (!round || round.saved || round.status !== 'finished') return;
  const saved = await savePlay({
    round,
    gameId: GAME,
    gameName: 'Closest Guess',
    totals: game.scores(round),
    details: { questionIds: round.results.map((r) => r.questionId) },
  });
  if (!saved) return;
  round.saved = true;
  round.playId = saved.id;
  save();
  toast('Result saved to the tracker', 'good');
  renderGame();
}

function renderGame() {
  document.body.classList.add('game-page');
  const finished = round.status === 'finished';
  const revealed = finished || round.phase === 'revealed';
  const lastResult = round.results[round.results.length - 1];
  const question = questionById(game.currentQuestionId(round));
  const guesser = game.nextGuesser(round);
  const totals = game.scores(round);

  let bar;
  if (finished) {
    bar = winnerBar({
      names: round.winners.map(nameOfPlayer),
      summary: `${Math.max(...Object.values(totals))} points`,
      saved: round.saved,
      onSave: saveResult,
      onAgain: again,
      onLeave: () => round.saved && db.clearRound(GAME),
    });
  } else if (revealed) {
    const last = game.isLastQuestion(round);
    bar = actionBar(last ? "That's the last one" : 'Ready for the next one?', last ? 'See the result' : 'Next question', () => {
      game.next(round);
      save();
      renderGame();
      if (round.status === 'finished') saveResult();
    });
  } else if (guesser) {
    bar = guessBar(guesser, question);
  } else {
    bar = actionBar("Everyone's in", 'Reveal the answer', () => {
      game.reveal(round, question.answer);
      save();
      renderGame();
    });
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
      el(
        'aside',
        { class: 'scoreboard' },
        scoreRows(round.players, totals, {
          turnId: guesser?.id,
          outIds: round.tiebreak > 0 && !finished ? round.players.map((p) => p.id).filter((id) => !round.tiebreakPlayers.includes(id)) : [],
          winners: round.winners,
          sub: (p) => (revealed && lastResult?.points[p.id] ? `+${lastResult.points[p.id]} this question` : ''),
        }),
      ),
      el('section', { class: 'panel quiz-stage' }, revealed ? revealPanel(lastResult) : questionPanel(question)),
      bar,
    ),
  );
  (app.querySelector('.guess-input') ?? app.querySelector('.next-btn'))?.focus();
}

// ---- start -------------------------------------------------------------------

async function init() {
  await attempt(async () => {
    const [text, p, pl] = await Promise.all([fetchText('data/closest/questions.txt'), db.list('players'), db.list('plays')]);
    questions = parseQuestions(text).filter((q) => Number.isFinite(q.answer));
    players = p;
    plays = pl;
  });

  round = db.loadRound(GAME);
  const ids = round ? [...round.questionIds, ...round.spareIds, ...round.results.map((r) => r.questionId)] : [];
  if (round?.saved || ids.some((id) => !questionById(id))) {
    // a finished round left over from last time, or one whose questions have since changed
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
