// Date maths, streaks, wins and randomizer weighting.
// No screen code in here, so it can all be tested.

// Dates are plain 'YYYY-MM-DD' text in the computer's own time zone.
export function dateStr(d = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function parseDate(str) {
  const [y, m, d] = str.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function dayDiff(from, to) {
  return Math.round((parseDate(to) - parseDate(from)) / 86400000);
}

// Monday-to-Friday days strictly between two dates.
export function weekdaysBetween(from, to) {
  let count = 0;
  const d = parseDate(from);
  d.setDate(d.getDate() + 1);
  const end = parseDate(to);
  while (d < end) {
    const day = d.getDay();
    if (day !== 0 && day !== 6) count++;
    d.setDate(d.getDate() + 1);
  }
  return count;
}

export function playedDays(plays) {
  return [...new Set(plays.map((p) => p.date))].sort();
}

// A streak is a run of played days with no missed weekday in between.
// Weekends never break a streak, and today doesn't break it until it's over.
export function streaks(plays, today = dateStr()) {
  const days = playedDays(plays).filter((d) => d <= today);
  if (!days.length) return { current: 0, longest: 0, days: 0 };
  let run = 1;
  let longest = 1;
  for (let i = 1; i < days.length; i++) {
    run = weekdaysBetween(days[i - 1], days[i]) === 0 ? run + 1 : 1;
    longest = Math.max(longest, run);
  }
  const last = days[days.length - 1];
  const alive = last === today || weekdaysBetween(last, today) === 0;
  return { current: alive ? run : 0, longest, days: days.length };
}

// { playerId: numberOfWins }. A shared win counts for everyone who shared it.
export function winsByPlayer(plays) {
  const wins = {};
  for (const p of plays) for (const id of p.winners ?? []) wins[id] = (wins[id] ?? 0) + 1;
  return wins;
}

export function lastPlayed(gameId, plays) {
  return plays.filter((p) => p.gameId === gameId).reduce((max, p) => (p.date > max ? p.date : max), '');
}

// The longer since a game was played, the bigger its slice of the wheel
// (capped at two weeks; never-played games get the biggest slice).
export function wheelWeight(gameId, plays, today = dateStr()) {
  const last = lastPlayed(gameId, plays);
  if (!last) return 15;
  return Math.min(Math.max(dayDiff(last, today), 0), 14) + 1;
}

// Picks up to n different games, favouring bigger weights.
export function pickGames(games, plays, today, n, random = Math.random) {
  const pool = games.map((g) => ({ game: g, weight: wheelWeight(g.id, plays, today) }));
  const picks = [];
  while (picks.length < n && pool.length) {
    let roll = random() * pool.reduce((sum, p) => sum + p.weight, 0);
    let i = pool.findIndex((p) => (roll -= p.weight) < 0);
    if (i < 0) i = pool.length - 1;
    picks.push(pool.splice(i, 1)[0].game);
  }
  return picks;
}
