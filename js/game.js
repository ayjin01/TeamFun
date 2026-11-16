// Top 100 round rules, kept separate from the screen so they can be tested.
// A "round" is a plain object, so it can be saved and restored as-is.

import { findMatch } from './match.js';

export const GUESSES_EACH = 3;
export const MAX_TIEBREAKS = 3;

export function createRound(listSlug, players, guessesEach = GUESSES_EACH) {
  return {
    listSlug,
    players: players.map((p) => ({ id: p.id, name: p.name })),
    guessesEach,
    turns: [], // { playerId, guess, rank, answer, points, result, tiebreak }
    tiebreak: 0, // 0 = normal play, 1..3 = sudden-death round number
    tiebreakPlayers: [], // ids still fighting for the win
    status: 'playing', // 'playing' | 'finished'
    winners: [], // player ids, filled in when finished
  };
}

export function scores(round) {
  const totals = Object.fromEntries(round.players.map((p) => [p.id, 0]));
  for (const t of round.turns) totals[t.playerId] += t.points;
  return totals;
}

export function foundRanks(round) {
  return round.turns.filter((t) => t.result === 'correct').map((t) => t.rank);
}

function leaders(round, ids) {
  const totals = scores(round);
  const top = Math.max(...ids.map((id) => totals[id]));
  return ids.filter((id) => totals[id] === top);
}

// Whose turn it is, or null when the round is over.
export function currentPlayer(round) {
  if (round.status !== 'playing') return null;
  if (round.tiebreak === 0) {
    const taken = round.turns.length;
    return round.players[taken % round.players.length];
  }
  const done = round.turns.filter((t) => t.tiebreak === round.tiebreak).map((t) => t.playerId);
  const nextId = round.tiebreakPlayers.find((id) => !done.includes(id));
  return round.players.find((p) => p.id === nextId) ?? null;
}

export function guessesLeft(round, playerId) {
  const used = round.turns.filter((t) => t.playerId === playerId && !t.tiebreak).length;
  return Math.max(0, round.guessesEach - used);
}

// Records a guess for the current player and moves the round on.
// Returns the turn that was recorded (result: 'correct' | 'wrong' | 'duplicate').
export function applyGuess(round, guess, items) {
  const player = currentPlayer(round);
  if (!player) throw new Error('Round is over');

  const item = findMatch(guess, items);
  const turn = {
    playerId: player.id,
    guess: String(guess).trim(),
    rank: null,
    answer: null,
    points: 0,
    result: 'wrong',
    tiebreak: round.tiebreak,
  };
  if (item) {
    turn.rank = item.rank;
    turn.answer = item.answer;
    if (foundRanks(round).includes(item.rank)) {
      turn.result = 'duplicate';
    } else {
      turn.result = 'correct';
      turn.points = item.rank; // the 90th answer is worth 90 points
    }
  }
  round.turns.push(turn);
  advance(round);
  return turn;
}

function advance(round) {
  const allIds = round.players.map((p) => p.id);

  if (round.tiebreak === 0) {
    if (round.turns.length < round.players.length * round.guessesEach) return;
    const top = leaders(round, allIds);
    if (top.length === 1) return finish(round, top);
    round.tiebreak = 1;
    round.tiebreakPlayers = top;
    return;
  }

  const done = round.turns.filter((t) => t.tiebreak === round.tiebreak).length;
  if (done < round.tiebreakPlayers.length) return;
  const top = leaders(round, round.tiebreakPlayers);
  if (top.length === 1 || round.tiebreak >= MAX_TIEBREAKS) return finish(round, top);
  round.tiebreak += 1;
  round.tiebreakPlayers = top;
}

function finish(round, winnerIds) {
  round.status = 'finished';
  round.winners = winnerIds;
}
