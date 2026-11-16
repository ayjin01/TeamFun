// Guess matching for Top 100.
// Turns what someone typed into the list item they meant, forgiving
// capital letters, accents, punctuation and small typos.

export function normalize(text) {
  return String(text ?? '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents: é -> e
    .replace(/&/g, ' and ')
    .replace(/['’`.]/g, '') // drop apostrophes and dots: "St. John's" -> "st johns"
    .replace(/[^a-z0-9]+/g, ' ') // any other punctuation becomes a space
    .trim()
    .replace(/^the\s+/, '')
    .replace(/\s+/g, ' ');
}

// Number of single-letter edits (add, remove, swap one letter) between two strings.
export function editDistance(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      cur[j] = Math.min(prev[j] + 1, cur[j - 1] + 1, prev[j - 1] + cost);
      // treat two swapped neighbouring letters ("teh") as one typo
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) {
        cur[j] = Math.min(cur[j], prevPrev[j - 2] + 1);
      }
    }
    var prevPrev = prev;
    prev = cur;
  }
  return prev[b.length];
}

// Short answers must be exact; longer ones tolerate 1 or 2 typos.
export function allowedTypos(length) {
  if (length < 5) return 0;
  if (length <= 8) return 1;
  return 2;
}

const digitsOf = (s) => s.replace(/[^0-9]/g, '');

function namesOf(item) {
  return [item.answer, ...(item.aliases ?? [])].map(normalize).filter(Boolean);
}

// Returns the matching item, or null when nothing (or more than one thing) fits.
export function findMatch(guess, items) {
  const g = normalize(guess);
  if (!g) return null;

  for (const item of items) {
    if (namesOf(item).includes(g)) return item;
  }

  let best = null;
  let bestDistance = Infinity;
  let tied = false;
  for (const item of items) {
    for (const name of namesOf(item)) {
      // "Toy Story 2" must never match "Toy Story 3"
      if (digitsOf(name) !== digitsOf(g)) continue;
      const limit = allowedTypos(name.length);
      if (!limit || Math.abs(name.length - g.length) > limit) continue;
      const d = editDistance(g, name);
      if (d > limit) continue;
      if (d < bestDistance) {
        best = item;
        bestDistance = d;
        tied = false;
      } else if (d === bestDistance && item !== best) {
        tied = true;
      }
    }
  }
  return tied ? null : best;
}
