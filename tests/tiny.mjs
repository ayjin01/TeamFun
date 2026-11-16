// A very small test helper, so the tests run without installing anything.
// Works in macOS's built-in JavaScript engine (jsc), in Node, and in a browser.

const log = (msg) => (typeof print === 'function' ? print(msg) : console.log(msg));
const show = (v) => JSON.stringify(v);
let passed = 0;
const failures = [];

export function test(name, fn) {
  try {
    fn();
    passed++;
    log(`ok   ${name}`);
  } catch (err) {
    failures.push(name);
    log(`FAIL ${name}\n       ${err.message}`);
  }
}

export const assert = {
  equal(actual, expected) {
    if (actual !== expected) throw new Error(`expected ${show(expected)}, got ${show(actual)}`);
  },
  deepEqual(actual, expected) {
    if (show(actual) !== show(expected)) throw new Error(`expected ${show(expected)}, got ${show(actual)}`);
  },
  throws(fn) {
    try {
      fn();
    } catch {
      return;
    }
    throw new Error('expected an error, but none was thrown');
  },
};

export function done() {
  log(`\n${passed} passed, ${failures.length} failed`);
  if (failures.length) throw new Error(`Failed: ${failures.join('; ')}`);
}
