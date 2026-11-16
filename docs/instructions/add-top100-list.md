# Add a Top 100 list

Each category is one plain-text file in `data/lists/`.

## Steps

1. **Find a source** with a real ranking of at least 100 entries and a clear date. Read the ranking from the page itself; never fill gaps from memory. If only part of the page can be read, fetch the rest or choose another category.
2. **Create `data/lists/<short-name>.txt`** (lowercase, hyphens, no spaces):

   ```
   title: Most populous countries
   source: United Nations, via Wikipedia
   url: https://...
   asOf: July 2023
   note: Optional sentence shown before the round (rules of thumb, caveats).

   India
   United States | USA | America
   Espresso :: Sabrina Carpenter | Expresso
   ```

   - One answer per line, in order: line 1 is number 1. Exactly 100 answers.
   - After `|`, list other names people might type (nicknames, abbreviations, numbered sequels).
   - After `::`, add detail that is shown but never guessed (artist, year, state).
   - Capitals, accents, punctuation, a leading "The" and small typos are already forgiven, so they need no alias.
   - If two answers share a name (two films called "The Lion King"), make the names different and give the plain name to one of them as an alias.
3. **Add the short name** to `data/lists/index.json`.
4. **Run the check:** `zsh tests/run.sh`. It fails if a list doesn't have 100 answers, lacks a source or date, or has two answers that could be confused.
5. Say in the list's `note` if the ranking has a weakness (mixed years, ties).

## Sites that block automated reading

ssa.gov (baby names), inside.fifa.com (needs JavaScript) and transfermarkt.com could not be read in November 2026. For Wikipedia, long pages are cut off when fetched normally; fetching the raw text (`...index.php?title=PAGE&action=raw`, optionally `&section=N`) returns the full table.
