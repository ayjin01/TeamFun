import { test, assert, done } from './tiny.mjs';
import { dayDiff, weekdaysBetween, streaks, winsByPlayer, wheelWeight, pickGames } from '../js/stats.js';

// 2026-11-09 is a Monday.
const play = (date, gameId = 'g1', winners) => ({ date, gameId, winners });

test('day maths', () => {
  assert.equal(dayDiff('2026-11-09', '2026-11-12'), 3);
  assert.equal(weekdaysBetween('2026-11-13', '2026-11-16'), 0); // Fri -> Mon
  assert.equal(weekdaysBetween('2026-11-12', '2026-11-16'), 1); // Thu -> Mon skips Fri
});

test('streak counts consecutive weekdays and ignores weekends', () => {
  const plays = ['2026-11-11', '2026-11-12', '2026-11-13', '2026-11-16'].map((d) => play(d));
  assert.deepEqual(streaks(plays, '2026-11-16'), { current: 4, longest: 4, days: 4 });
});

test('today not played yet does not break the streak, a missed weekday does', () => {
  const plays = ['2026-11-09', '2026-11-10'].map((d) => play(d));
  assert.equal(streaks(plays, '2026-11-11').current, 2);
  assert.equal(streaks(plays, '2026-11-12').current, 0);
  assert.equal(streaks(plays, '2026-11-12').longest, 2);
});

test('a gap restarts the run; several plays in one day count once', () => {
  const plays = ['2026-11-02', '2026-11-03', '2026-11-04', '2026-11-09', '2026-11-09'].map((d) => play(d));
  assert.deepEqual(streaks(plays, '2026-11-09'), { current: 1, longest: 3, days: 4 });
  assert.deepEqual(streaks([], '2026-11-09'), { current: 0, longest: 0, days: 0 });
});

test('wins tally includes shared wins', () => {
  const plays = [play('2026-11-09', 'g1', ['a']), play('2026-11-10', 'g1', ['a', 'b']), play('2026-11-10', 'g2')];
  assert.deepEqual(winsByPlayer(plays), { a: 2, b: 1 });
});

test('wheel favours games not played lately', () => {
  const plays = [play('2026-11-09', 'g1'), play('2026-11-02', 'g2')];
  assert.equal(wheelWeight('g1', plays, '2026-11-09'), 1);
  assert.equal(wheelWeight('g2', plays, '2026-11-09'), 8);
  assert.equal(wheelWeight('never', plays, '2026-11-09'), 15);
});

test('picks are distinct, capped at the pool size, and follow the weights', () => {
  const games = [{ id: 'g1' }, { id: 'g2' }, { id: 'g3' }];
  const plays = [play('2026-11-09', 'g1'), play('2026-11-09', 'g2')];
  const picks = pickGames(games, plays, '2026-11-09', 5);
  assert.deepEqual(picks.map((g) => g.id).sort(), ['g1', 'g2', 'g3']);
  // weights are 1, 1, 15: a roll in the middle of the range lands on g3
  assert.equal(pickGames(games, plays, '2026-11-09', 1, () => 0.5)[0].id, 'g3');
  assert.equal(pickGames(games, plays, '2026-11-09', 1, () => 0)[0].id, 'g1');
  assert.deepEqual(pickGames([], plays, '2026-11-09', 2), []);
});

done();
