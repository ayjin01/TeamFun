// Closest Guess round rules, kept separate from the screen so they can be tested.
// Everyone guesses a number; the nearest guesses score.
// A "round" is a plain object, so it can be saved and restored as-is.

export const QUESTIONS_PER_ROUND = 8;
export const MAX_TIEBREAKS = 3;
export const POINTS_CLOSEST = 2;
export const POINTS_SECOND = 1; // only when three or more are guessing
export const POINTS_EXACT_BONUS = 1;

// questionIds: the questions for the round, in order.
// spareIds: extra questions held back for sudden death (up to MAX_TIEBREAKS).
export function createRound(questionIds, players, spareIds = []) {
  return {
    players: players.map((p) => ({ id: p.id, name: p.name })),
    questionIds: [...questionIds],
    spareIds: spareIds.slice(0, MAX_TIEBREAKS),
    index: 0, // how many questions have been finished
    guesses: {}, // the current question: { playerId: number }
    phase: 'guessing', // 'guessing' | 'revealed'
    results: [], // { questionId, answer, guesses, points, tiebreak }
    tiebreak: 0, // 0 = normal play, 1..3 = sudden-death question number
    tiebreakPlayers: [],
    status: 'playing', // 'playing' | 'finished'
    winners: [],
  };
}

// Turns typed text into a number: "1,665", " 12.5 " and "-40" all work.
// Returns null for anything that isn't a plain number.
export function parseGuess(text) {
  const cleaned = String(text ?? '').replace(/[,\s_]/g, '');
  if (!/^-?(\d+\.?\d*|\.\d+)$/.test(cleaned)) return null;
  const value = Number(cleaned);
  return Number.isFinite(value) ? value : null;
}

export function currentQuestionId(round) {
  if (round.status !== 'playing') return null;
  if (round.tiebreak === 0) return round.questionIds[round.index] ?? null;
  return round.spareIds[round.tiebreak - 1] ?? null;
}

// Who guesses on the current question, in order. The starting player moves
// round one place each question so nobody always goes first.
export function guessOrder(round) {
  const active =
    round.tiebreak === 0 ? round.players : round.players.filter((p) => round.tiebreakPlayers.includes(p.id));
  if (!active.length) return [];
  const offset = round.index % active.length;
  return [...active.slice(offset), ...active.slice(0, offset)];
}

// The next player who still has to guess, or null when everyone is in.
export function nextGuesser(round) {
  if (round.status !== 'playing' || round.phase !== 'guessing') return null;
  return guessOrder(round).find((p) => !(p.id in round.guesses)) ?? null;
}

export function addGuess(round, value) {
  const player = nextGuesser(round);
  if (!player) throw new Error('Nobody is waiting to guess');
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error('A guess must be a number');
  round.guesses[player.id] = value;
  return player;
}

// Points for one question. Nearest scores 2, next nearest 1 (three or more
// players only), and an exactly right guess earns 1 extra. Players the same
// distance away score the same.
export function scoreQuestion(guesses, answer) {
  const ids = Object.keys(guesses);
  const points = Object.fromEntries(ids.map((id) => [id, 0]));
  const distance = (id) => Math.abs(guesses[id] - answer);
  const distances = [...new Set(ids.map(distance))].sort((a, b) => a - b);
  for (const id of ids) {
    if (distance(id) === distances[0]) points[id] += POINTS_CLOSEST;
    else if (ids.length >= 3 && distance(id) === distances[1]) points[id] += POINTS_SECOND;
    if (distance(id) === 0) points[id] += POINTS_EXACT_BONUS;
  }
  return points;
}

export function scores(round) {
  const totals = Object.fromEntries(round.players.map((p) => [p.id, 0]));
  for (const result of round.results) {
    for (const [id, pts] of Object.entries(result.points)) totals[id] += pts;
  }
  return totals;
}

// Shows the answer and hands out the points for the current question.
export function reveal(round, answer) {
  if (round.phase !== 'guessing' || nextGuesser(round)) throw new Error('Not everyone has guessed yet');
  const result = {
    questionId: currentQuestionId(round),
    answer,
    guesses: round.guesses,
    points: scoreQuestion(round.guesses, answer),
    tiebreak: round.tiebreak,
  };
  round.results.push(result);
  round.guesses = {};
  round.phase = 'revealed';
  return result;
}

function leaders(round, ids) {
  const totals = scores(round);
  const top = Math.max(...ids.map((id) => totals[id]));
  return ids.filter((id) => totals[id] === top);
}

function finish(round, winnerIds) {
  round.status = 'finished';
  round.winners = winnerIds;
}

// True when the question just revealed was the last one (the next step is the result).
export function isLastQuestion(round) {
  const copy = JSON.parse(JSON.stringify(round));
  next(copy);
  return copy.status === 'finished';
}

// Moves on from a revealed answer: next question, sudden death, or the end.
export function next(round) {
  if (round.phase !== 'revealed') throw new Error('Reveal the answer first');
  round.phase = 'guessing';
  round.index += 1;
  if (round.tiebreak === 0 && round.index < round.questionIds.length) return;

  const contenders = round.tiebreak === 0 ? round.players.map((p) => p.id) : round.tiebreakPlayers;
  const top = leaders(round, contenders);
  const outOfQuestions = round.tiebreak >= Math.min(MAX_TIEBREAKS, round.spareIds.length);
  if (top.length === 1 || outOfQuestions) return finish(round, top);
  round.tiebreak += 1;
  round.tiebreakPlayers = top;
}
