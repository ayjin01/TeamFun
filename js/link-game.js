// Guess the Link round rules, kept separate from the screen so they can be tested.
// Four clues share a hidden connection. The team works it out together:
// the fewer clues needed, the more the team scores.
// A "round" is a plain object, so it can be saved and restored as-is.

import { normalize, editDistance, allowedTypos } from './match.js';

export const PUZZLES_PER_ROUND = 8;
export const CLUES = 4;
export const START_CLUES = 2; // one clue alone could mean anything, so every puzzle opens with two
export const POINTS = [5, 3, 1]; // solved with 2, 3 or 4 clues showing

// What a correct answer is worth with this many clues showing.
export const pointsFor = (clues) => POINTS[Math.max(clues, START_CLUES) - START_CLUES];

const sameWord = (a, b) => {
  if (a === b) return true;
  if (/\d/.test(a) || /\d/.test(b)) return false; // numbers must be exact
  return editDistance(a, b) <= allowedTypos(Math.max(a.length, b.length));
};

// Does the guess contain one of the accepted key words or phrases?
// "famous things with keys" matches the accepted word "keys"; small typos are forgiven.
export function matchesLink(guess, accept) {
  const words = normalize(guess).split(' ').filter(Boolean);
  if (!words.length) return false;
  return accept.some((phrase) => {
    const want = normalize(phrase).split(' ').filter(Boolean);
    if (!want.length) return false;
    for (let i = 0; i + want.length <= words.length; i++) {
      if (want.every((w, j) => sameWord(words[i + j], w))) return true;
    }
    return false;
  });
}

// puzzleIds: the puzzles for this round, in order. The whole team plays
// together and shares one score.
export function createRound(puzzleIds) {
  return {
    puzzleIds: [...puzzleIds],
    turns: [], // finished puzzles: { puzzleId, guesses, cluesShown, solved, points }
    current: { cluesShown: START_CLUES, guesses: [] }, // guesses: [{ text, clues }]
    phase: 'playing', // 'playing' (clues on show) | 'revealed' (answer on show)
    status: 'playing', // 'playing' | 'finished'
  };
}

export const total = (round) => round.turns.reduce((sum, t) => sum + t.points, 0);
export const maxTotal = (round) => round.puzzleIds.length * POINTS[0];

// How many puzzles are completely finished (not counting one whose answer is on show).
const doneCount = (round) => round.turns.length - (round.phase === 'revealed' ? 1 : 0);

export function currentPuzzleId(round) {
  if (round.status !== 'playing') return null;
  return round.puzzleIds[doneCount(round)] ?? null;
}

function endTurn(round, solved, points) {
  const turn = {
    puzzleId: currentPuzzleId(round),
    guesses: round.current.guesses,
    cluesShown: round.current.cluesShown,
    solved,
    points,
  };
  round.turns.push(turn);
  round.current = { cluesShown: START_CLUES, guesses: [] };
  round.phase = 'revealed';
  return turn;
}

// Shows one more clue. Returns false if all four are already showing.
export function nextClue(round) {
  if (round.phase !== 'playing' || round.current.cluesShown >= CLUES) return false;
  round.current.cluesShown += 1;
  return true;
}

// The team's guess. Right: the puzzle ends with points for the number of
// clues showing. Wrong: the next clue appears, or after the fourth clue the
// puzzle ends with nothing. Returns 'correct' | 'wrong' | 'out'.
export function guess(round, text, accept) {
  if (round.status !== 'playing' || round.phase !== 'playing') throw new Error('No puzzle is waiting for a guess');
  const clues = round.current.cluesShown;
  round.current.guesses.push({ text: String(text).trim(), clues });
  if (matchesLink(text, accept)) {
    endTurn(round, true, pointsFor(clues));
    return 'correct';
  }
  if (clues < CLUES) {
    round.current.cluesShown += 1;
    return 'wrong';
  }
  endTurn(round, false, 0);
  return 'out';
}

export function giveUp(round) {
  if (round.status !== 'playing' || round.phase !== 'playing') throw new Error('No puzzle to give up on');
  return endTurn(round, false, 0);
}

// "We'll allow it": the team decides a guess the computer marked wrong was
// right after all. Scores as if it had been accepted when it was made.
export function allow(round, guessIndex) {
  if (round.phase !== 'revealed') throw new Error('Only once the answer is showing');
  const turn = round.turns[round.turns.length - 1];
  const made = turn.guesses[guessIndex];
  if (!made || turn.solved) return false;
  turn.solved = true;
  turn.allowed = true;
  turn.points = pointsFor(made.clues);
  return true;
}

// True when the puzzle just revealed was the last one (the next step is the result).
export const isLastPuzzle = (round) => round.phase === 'revealed' && round.turns.length >= round.puzzleIds.length;

// Moves on from a revealed answer: the next puzzle, or the end of the round.
export function next(round) {
  if (round.phase !== 'revealed') throw new Error('Finish the puzzle first');
  round.phase = 'playing';
  if (round.turns.length >= round.puzzleIds.length) round.status = 'finished';
}
