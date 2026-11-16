// Checks the real Closest Guess questions and Guess the Link puzzles.
// Run after adding or editing either file (via tests/run.sh).

import { test, assert, done } from './tiny.mjs';
import { parseQuestions, parsePuzzles } from '../js/lists.js';
import { matchesLink, CLUES } from '../js/link-game.js';
import { QUESTIONS_PER_ROUND, MAX_TIEBREAKS } from '../js/closest-game.js';

const questions = parseQuestions(readFile('../data/closest/questions.txt'));
const puzzles = parsePuzzles(readFile('../data/link/puzzles.txt'));

test('there are enough questions for a round plus sudden death', () => {
  if (questions.length < QUESTIONS_PER_ROUND + MAX_TIEBREAKS) throw new Error(`only ${questions.length} questions`);
});

test('every question has a number for an answer, a source and a date', () => {
  for (const q of questions) {
    if (!Number.isFinite(q.answer)) throw new Error(`no number answer: ${q.question}`);
    if (!q.source || !q.asOf) throw new Error(`missing source or asOf: ${q.question}`);
    if (!q.question.endsWith('?')) throw new Error(`not a question: ${q.question}`);
  }
});

test('no question appears twice', () => {
  assert.equal(new Set(questions.map((q) => q.id)).size, questions.length);
});

test('there are enough puzzles for three rounds without repeats', () => {
  if (puzzles.length < 24) throw new Error(`only ${puzzles.length} puzzles`);
});

test('every puzzle has exactly four clues and some accepted words', () => {
  for (const p of puzzles) {
    if (p.clues.length !== CLUES) throw new Error(`${p.link}: ${p.clues.length} clues`);
    if (!p.accept.length) throw new Error(`${p.link}: no accepted words`);
  }
});

test('typing the link itself is accepted', () => {
  for (const p of puzzles) {
    if (!matchesLink(p.link, p.accept)) throw new Error(`"${p.link}" is not matched by its own accepted words`);
  }
});

test('no clue gives the answer away', () => {
  for (const p of puzzles) {
    for (const clue of p.clues) {
      if (matchesLink(clue, p.accept)) throw new Error(`${p.link}: the clue "${clue}" contains an accepted word`);
    }
  }
});

test('no puzzle appears twice', () => {
  assert.equal(new Set(puzzles.map((p) => p.id)).size, puzzles.length);
});

done();
