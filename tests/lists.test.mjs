import { test, assert, done } from './tiny.mjs';
import { parseList } from '../js/lists.js';
import { findMatch } from '../js/match.js';

const sample = `title: Demo list
source: Somewhere
url: https://example.com/a:b
asOf: May 2026

# a comment
India
United States | USA | America

Espresso :: Sabrina Carpenter | expresso
note: this is an answer, not a header
`;

test('reads the header and ranks answers by line order', () => {
  const list = parseList(sample);
  assert.equal(list.title, 'Demo list');
  assert.equal(list.url, 'https://example.com/a:b');
  assert.equal(list.asOf, 'May 2026');
  assert.equal(list.items.length, 4);
  assert.deepEqual(list.items[1], { rank: 2, answer: 'United States', detail: '', aliases: ['USA', 'America'] });
  assert.deepEqual(list.items[2], { rank: 3, answer: 'Espresso', detail: 'Sabrina Carpenter', aliases: ['expresso'] });
  assert.equal(list.items[3].answer, 'note: this is an answer, not a header');
});

test('parsed items work with guess matching', () => {
  const { items } = parseList(sample);
  assert.equal(findMatch('america', items).rank, 2);
  assert.equal(findMatch('Sabrina Carpenter', items), null);
});

done();
