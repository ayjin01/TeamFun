import { test, assert, done } from './tiny.mjs';
import * as g from '../js/link-game.js';

const accept = ['key', 'keys'];
const ids = ['p1', 'p2', 'p3'];

test('a guess matches when it contains an accepted word', () => {
  assert.equal(g.matchesLink('Things that have KEYS', accept), true);
  assert.equal(g.matchesLink('key', accept), true);
  assert.equal(g.matchesLink('monkeys', accept), false);
  assert.equal(g.matchesLink('', accept), false);
});

test('small typos and multi-word answers are handled', () => {
  assert.equal(g.matchesLink('they are all planits', ['planet', 'planets']), true);
  assert.equal(g.matchesLink('james bond films', ['James Bond', '007']), true);
  assert.equal(g.matchesLink('bond james', ['James Bond']), false);
  assert.equal(g.matchesLink('008', ['007']), false);
});

test('every puzzle opens with two clues, and solving then scores 5', () => {
  const round = g.createRound(ids);
  assert.equal(round.current.cluesShown, 2);
  assert.equal(g.guess(round, 'keys', accept), 'correct');
  assert.equal(g.total(round), 5);
  assert.equal(round.phase, 'revealed');
});

test('asking for clues lowers the score: 3, then 1', () => {
  for (const [extra, points] of [[1, 3], [2, 1]]) {
    const round = g.createRound(ids);
    for (let i = 0; i < extra; i++) g.nextClue(round);
    g.guess(round, 'keys', accept);
    assert.equal(g.total(round), points);
  }
});

test('a wrong guess uses up the clue and shows the next', () => {
  const round = g.createRound(ids);
  assert.equal(g.guess(round, 'doors', accept), 'wrong');
  assert.equal(round.current.cluesShown, 3);
  g.guess(round, 'keys', accept);
  assert.equal(g.total(round), 3);
});

test('wrong after the fourth clue scores nothing', () => {
  const round = g.createRound(ids);
  for (let i = 0; i < 2; i++) g.guess(round, 'nope', accept);
  assert.equal(g.nextClue(round), false);
  assert.equal(g.guess(round, 'nope', accept), 'out');
  assert.equal(g.total(round), 0);
  assert.equal(round.phase, 'revealed');
});

test('"we\'ll allow it" scores the guess as if it had been accepted', () => {
  const round = g.createRound(ids);
  g.guess(round, 'lock openers', accept); // with two clues showing
  g.giveUp(round);
  assert.equal(g.allow(round, 0), true);
  assert.equal(g.total(round), 5);
  assert.equal(g.allow(round, 0), false);
});

test('the round works through every puzzle and adds up one team score', () => {
  const round = g.createRound(ids);
  assert.equal(g.maxTotal(round), 15);
  assert.equal(g.currentPuzzleId(round), 'p1');
  g.guess(round, 'keys', accept);
  assert.equal(g.currentPuzzleId(round), 'p1'); // still on show
  assert.equal(g.isLastPuzzle(round), false);
  g.next(round);
  assert.equal(g.currentPuzzleId(round), 'p2');
  g.nextClue(round);
  g.guess(round, 'keys', accept);
  g.next(round);
  g.giveUp(round);
  assert.equal(g.isLastPuzzle(round), true);
  g.next(round);
  assert.equal(round.status, 'finished');
  assert.equal(g.total(round), 8);
  assert.throws(() => g.guess(round, 'keys', accept));
});

done();
