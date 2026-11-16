import { test, assert, done } from './tiny.mjs';
import * as g from '../js/closest-game.js';

const players = [{ id: 'a', name: 'Ana' }, { id: 'b', name: 'Ben' }, { id: 'c', name: 'Chidi' }];
const playQuestion = (round, guesses, answer) => {
  for (const p of g.guessOrder(round)) g.addGuess(round, guesses[p.id]);
  g.reveal(round, answer);
};

test('typed guesses become numbers', () => {
  assert.equal(g.parseGuess('1,665'), 1665);
  assert.equal(g.parseGuess(' 12.5 '), 12.5);
  assert.equal(g.parseGuess('-40'), -40);
  assert.equal(g.parseGuess('about 5'), null);
  assert.equal(g.parseGuess(''), null);
});

test('closest scores 2, second closest 1, the rest 0', () => {
  assert.deepEqual(g.scoreQuestion({ a: 90, b: 150, c: 500 }, 100), { a: 2, b: 1, c: 0 });
});

test('an exact guess earns a bonus point', () => {
  assert.deepEqual(g.scoreQuestion({ a: 100, b: 150, c: 500 }, 100), { a: 3, b: 1, c: 0 });
});

test('equally close guesses score the same', () => {
  assert.deepEqual(g.scoreQuestion({ a: 90, b: 110, c: 500 }, 100), { a: 2, b: 2, c: 1 });
});

test('with two players only the closest scores', () => {
  assert.deepEqual(g.scoreQuestion({ a: 90, b: 150 }, 100), { a: 2, b: 0 });
});

test('the first guesser rotates each question', () => {
  const round = g.createRound(['q1', 'q2'], players, []);
  assert.equal(g.nextGuesser(round).id, 'a');
  playQuestion(round, { a: 1, b: 2, c: 3 }, 1);
  g.next(round);
  assert.equal(g.nextGuesser(round).id, 'b');
});

test('the answer cannot be revealed until everyone has guessed', () => {
  const round = g.createRound(['q1'], players, []);
  g.addGuess(round, 5);
  assert.throws(() => g.reveal(round, 5));
});

test('a clear leader wins after the last question', () => {
  const round = g.createRound(['q1', 'q2'], players, ['s1']);
  playQuestion(round, { a: 10, b: 20, c: 30 }, 10);
  assert.equal(g.isLastQuestion(round), false);
  g.next(round);
  playQuestion(round, { a: 10, b: 20, c: 30 }, 10);
  assert.equal(g.isLastQuestion(round), true);
  g.next(round);
  assert.equal(round.status, 'finished');
  assert.deepEqual(round.winners, ['a']);
  assert.deepEqual(g.scores(round), { a: 6, b: 2, c: 0 });
});

test('a tie goes to sudden death between the tied players only', () => {
  const round = g.createRound(['q1'], players, ['s1', 's2']);
  playQuestion(round, { a: 9, b: 11, c: 50 }, 10);
  g.next(round);
  assert.equal(round.status, 'playing');
  assert.equal(round.tiebreak, 1);
  assert.equal(g.currentQuestionId(round), 's1');
  assert.deepEqual(g.guessOrder(round).map((p) => p.id).sort(), ['a', 'b']);
  playQuestion(round, { a: 5, b: 9 }, 10);
  g.next(round);
  assert.equal(round.status, 'finished');
  assert.deepEqual(round.winners, ['b']);
});

test('still tied when sudden-death questions run out: shared win', () => {
  const round = g.createRound(['q1'], players.slice(0, 2), ['s1']);
  playQuestion(round, { a: 9, b: 11 }, 10);
  g.next(round);
  playQuestion(round, { a: 9, b: 11 }, 10);
  g.next(round);
  assert.equal(round.status, 'finished');
  assert.deepEqual(round.winners, ['a', 'b']);
});

done();
