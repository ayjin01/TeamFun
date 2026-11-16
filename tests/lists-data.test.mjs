// Checks every real list file: 100 answers, a source, and no two answers
// that could be confused with each other. Run after adding or editing a list.
// (Reads files with the macOS engine's readFile, so it runs via tests/run.sh.)

import { test, assert, done } from './tiny.mjs';
import { parseList } from '../js/lists.js';
import { normalize, findMatch } from '../js/match.js';

const slugs = JSON.parse(readFile('../data/lists/index.json'));

test('the catalogue has no repeats', () => {
  assert.equal(new Set(slugs).size, slugs.length);
});

for (const slug of slugs) {
  test(`list: ${slug}`, () => {
    const list = parseList(readFile(`../data/lists/${slug}.txt`));
    if (!list.title || !list.source || !list.asOf) throw new Error('missing title, source or asOf line');
    assert.equal(list.items.length, 100);

    const owner = new Map();
    for (const item of list.items) {
      for (const name of [item.answer, ...item.aliases]) {
        const key = normalize(name);
        if (!key) throw new Error(`"${name}" (number ${item.rank}) has no letters or digits`);
        if (owner.has(key) && owner.get(key) !== item.rank) {
          throw new Error(`"${name}" is used by both number ${owner.get(key)} and number ${item.rank}`);
        }
        owner.set(key, item.rank);
      }
    }
    for (const item of list.items) {
      for (const name of [item.answer, ...item.aliases]) {
        const found = findMatch(name, list.items);
        if (found?.rank !== item.rank) {
          throw new Error(`typing "${name}" finds number ${found?.rank ?? 'nothing'}, not number ${item.rank}`);
        }
      }
    }
  });
}

done();
