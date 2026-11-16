// Checks that every page lists every script in its version block, so a
// browser can never mix old and new copies. If this fails, run: python3 tools/stamp.py

import { test, done } from './tiny.mjs';

const pages = ['index.html', 'top100.html', 'closest.html', 'link.html', 'tracker.html'];
const scripts = ['config', 'db', 'ui', 'dialogs', 'stats', 'match', 'lists', 'game', 'setup', 'hub', 'top100', 'tracker', 'closest', 'closest-game', 'link', 'link-game'];

for (const page of pages) {
  test(`${page} loads versioned copies of every script`, () => {
    const html = readFile(`../${page}`);
    const versions = new Set([...html.matchAll(/\?v=(\w+)/g)].map((m) => m[1]));
    if (versions.size !== 1) throw new Error(`expected one version code, found ${versions.size}`);
    for (const name of scripts) {
      if (!html.includes(`"./js/${name}.js": "./js/${name}.js?v=`)) throw new Error(`${name}.js is missing from the version block`);
    }
    if (!/src="js\/[\w-]+\.js\?v=/.test(html) || !/href="css\/styles\.css\?v=/.test(html)) throw new Error('script or stylesheet tag has no version');
  });
}

done();
