// Reads a Top 100 list file (data/lists/<name>.txt).
//
// A list file is plain text. A few "name: value" lines at the top describe
// the list, then there is one answer per line, in ranked order (line 1 = number 1):
//
//   title: Most populous countries
//   source: United Nations
//   url: https://...
//   asOf: July 2023
//   note: Optional extra sentence shown before the round.
//
//   India
//   United States | USA | America        <- other accepted names after each |
//   Espresso :: Sabrina Carpenter         <- extra detail after ::  (shown, never guessed)
//
// Blank lines and lines starting with # are ignored.

const HEADER = /^(title|source|url|asof|note)\s*:\s*(.*)$/i;

export function parseList(text) {
  const list = { title: '', source: '', url: '', asOf: '', note: '', items: [] };
  let inHeader = true;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const header = inHeader && line.match(HEADER);
    if (header) {
      const key = header[1].toLowerCase() === 'asof' ? 'asOf' : header[1].toLowerCase();
      list[key] = header[2].trim();
      continue;
    }
    inHeader = false;
    const [first, ...aliases] = line.split('|').map((part) => part.trim());
    const [answer, detail = ''] = first.split('::').map((part) => part.trim());
    if (!answer) continue;
    list.items.push({ rank: list.items.length + 1, answer, detail, aliases: aliases.filter(Boolean) });
  }
  return list;
}

// ---- Closest Guess and Guess the Link files -----------------------------------
//
// Both are plain text made of small blocks separated by blank lines.
// Each line in a block is "name: value". Lines starting with # are ignored.

function parseBlocks(text) {
  const blocks = [];
  let block = null;
  for (const raw of String(text).split(/\r?\n/)) {
    const line = raw.trim();
    if (!line) {
      block = null;
      continue;
    }
    if (line.startsWith('#')) continue;
    const at = line.indexOf(':');
    if (at < 1) continue;
    if (!block) blocks.push((block = {}));
    block[line.slice(0, at).trim().toLowerCase()] = line.slice(at + 1).trim();
  }
  return blocks;
}

// A short, stable name for a question or puzzle, made from its text, so the
// hub can remember which ones the team has already played.
export function slug(text) {
  return String(text)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
}

// data/closest/questions.txt
//
//   q: How many steps lead to the top of the Eiffel Tower?
//   a: 1665
//   unit: steps
//   source: Eiffel Tower official website
//   url: https://...
//   asOf: 2026
export function parseQuestions(text) {
  return parseBlocks(text)
    .filter((b) => b.q)
    .map((b) => ({
      id: slug(b.q),
      question: b.q,
      answer: b.a === undefined || b.a === '' ? NaN : Number(b.a.replace(/,/g, '')),
      unit: b.unit ?? '',
      source: b.source ?? '',
      url: b.url ?? '',
      asOf: b.asof ?? '',
      note: b.note ?? '',
    }));
}

// data/link/puzzles.txt
//
//   link: Things with keys
//   accept: key | keys
//   clues: Florida ; A map ; A piano ; A keyboard      <- hardest clue first
//   note: Optional explanation shown with the answer.
export function parsePuzzles(text) {
  return parseBlocks(text)
    .filter((b) => b.link)
    .map((b) => ({
      id: slug(b.link),
      link: b.link,
      accept: (b.accept ?? '').split('|').map((s) => s.trim()).filter(Boolean),
      clues: (b.clues ?? '').split(';').map((s) => s.trim()).filter(Boolean),
      note: b.note ?? '',
    }));
}
