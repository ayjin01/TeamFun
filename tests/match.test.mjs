import { test, assert, done } from './tiny.mjs';
import { normalize, editDistance, findMatch } from '../js/match.js';
import { createRound, applyGuess, currentPlayer, scores, guessesLeft } from '../js/game.js';

const items = [
  { rank: 1, answer: 'New York City', aliases: ['NYC', 'New York'] },
  { rank: 2, answer: 'Beyoncé' },
  { rank: 3, answer: 'The Beatles' },
  { rank: 4, answer: 'Iran' },
  { rank: 5, answer: 'Iraq' },
  { rank: 6, answer: 'Toy Story 2' },
  { rank: 7, answer: 'Toy Story 3' },
  { rank: 90, answer: 'Guns N\' Roses', aliases: ['Guns and Roses'] },
  { rank: 100, answer: 'AT&T' },
];
const rankOf = (guess) => findMatch(guess, items)?.rank ?? null;

test('normalize strips case, accents, punctuation and leading "the"', () => {
  assert.equal(normalize('  The BEYONCÉ! '), 'beyonce');
  assert.equal(normalize("St. John's"), 'st johns');
  assert.equal(normalize('AT&T'), 'at and t');
});

test('editDistance counts typos, with swapped letters as one', () => {
  assert.equal(editDistance('beatles', 'beatles'), 0);
  assert.equal(editDistance('beetles', 'beatles'), 1);
  assert.equal(editDistance('baetles', 'beatles'), 1);
});

test('exact, accent and alias matches', () => {
  assert.equal(rankOf('beyonce'), 2);
  assert.equal(rankOf('nyc'), 1);
  assert.equal(rankOf('new york'), 1);
  assert.equal(rankOf('beatles'), 3);
  assert.equal(rankOf('guns and roses'), 90);
  assert.equal(rankOf('AT and T'), 100);
});

test('small typos are forgiven on longer answers', () => {
  assert.equal(rankOf('beyonse'), 2);
  assert.equal(rankOf('new yrok city'), 1);
  assert.equal(rankOf('the beetles'), 3);
});

test('short answers and numbers must be exact', () => {
  assert.equal(rankOf('Iram'), null);
  assert.equal(rankOf('Iraq'), 5);
  assert.equal(rankOf('toy story 3'), 7);
  assert.equal(rankOf('toy story 4'), null);
  assert.equal(rankOf('toy story'), null);
});

test('nonsense and empty guesses do not match', () => {
  assert.equal(rankOf(''), null);
  assert.equal(rankOf('zzzzzz'), null);
});

const A = { id: 'a', name: 'Ana' };
const B = { id: 'b', name: 'Ben' };

test('rank is the score; wrong and duplicate guesses score 0 but use the turn', () => {
  const r = createRound('demo', [A, B], 2);
  assert.equal(currentPlayer(r).id, 'a');
  assert.equal(applyGuess(r, 'guns n roses', items).points, 90);
  assert.equal(currentPlayer(r).id, 'b');
  assert.equal(applyGuess(r, 'Guns and Roses', items).result, 'duplicate');
  assert.equal(applyGuess(r, 'zzzz', items).result, 'wrong');
  assert.equal(guessesLeft(r, 'a'), 0);
  applyGuess(r, 'nyc', items);
  assert.deepEqual(scores(r), { a: 90, b: 1 });
  assert.equal(r.status, 'finished');
  assert.deepEqual(r.winners, ['a']);
  assert.throws(() => applyGuess(r, 'iran', items));
});

test('a tie goes to sudden death between the tied players only', () => {
  const C = { id: 'c', name: 'Cy' };
  const r = createRound('demo', [A, B, C], 1);
  applyGuess(r, 'iran', items); // a: 4
  applyGuess(r, 'iran', items); // b: duplicate, 0
  applyGuess(r, 'toy story 2', items); // c: 6 ... not a tie
  assert.deepEqual(r.winners, ['c']);

  const t = createRound('demo', [A, B, C], 1);
  applyGuess(t, 'xx', items);
  applyGuess(t, 'yy', items);
  applyGuess(t, 'nyc', items); // c: 1, wins outright
  assert.deepEqual(t.winners, ['c']);

  const u = createRound('demo', [A, B, C], 1);
  applyGuess(u, 'iraq', items); // a: 5
  applyGuess(u, 'xx', items); // b: 0
  applyGuess(u, 'xx', items); // c: 0
  assert.deepEqual(u.winners, ['a']);

  const v = createRound('demo', [A, B, C], 1);
  applyGuess(v, 'xx', items); // a: 0
  applyGuess(v, 'xx', items); // b: 0
  applyGuess(v, 'xx', items); // c: 0 -> three-way tie
  assert.equal(v.status, 'playing');
  assert.equal(v.tiebreak, 1);
  applyGuess(v, 'iran', items); // a: 4
  applyGuess(v, 'iraq', items); // b: 5
  assert.equal(currentPlayer(v).id, 'c');
  applyGuess(v, 'xx', items); // c: 0
  assert.deepEqual(v.winners, ['b']);
});

test('still tied after 3 sudden-death rounds means a shared win', () => {
  const r = createRound('demo', [A, B], 1);
  for (let i = 0; i < 2 + 3 * 2; i++) {
    assert.equal(r.status, 'playing');
    applyGuess(r, 'xx', items);
  }
  assert.equal(r.status, 'finished');
  assert.deepEqual(r.winners, ['a', 'b']);
});

test('a round survives being saved and restored', () => {
  const r = createRound('demo', [A, B], 1);
  applyGuess(r, 'iran', items);
  const restored = JSON.parse(JSON.stringify(r));
  assert.equal(currentPlayer(restored).id, 'b');
  applyGuess(restored, 'iraq', items);
  assert.deepEqual(restored.winners, ['b']);
});

done();
