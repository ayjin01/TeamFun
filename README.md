# TeamFun

The Team Fun Hub: one page for the team's daily games, shown on a shared screen.

- **Games** (`index.html`): cards for every game, and a wheel that picks what to play today.
- **Top 100** (`top100.html`): take turns naming things on a ranked list. Number 90 scores 90 points.
- **Closest Guess** (`closest.html`): everyone secretly guesses a number; the nearest guesses score.
- **Guess the Link** (`link.html`): four clues appear one at a time; the team works out together what connects them.
- **Tracker** (`tracker.html`): history, streaks and a wins tally.

## Run it on this computer

```
python3 -m http.server 8765
```

Then open http://localhost:8765. (Opening the files by double-clicking won't work; browsers block the page's scripts that way.)

## After changing code or styles

```
python3 tools/stamp.py
```

This gives every page a new version code, which makes browsers download the changed files instead of reusing old saved copies (mixing old and new copies breaks pages). Needed after any change in `js/` or `css/`; not needed for the lists, questions or puzzles in `data/`. `zsh tests/run.sh` fails if a page is missing a script from its version block.

## Where things are

| Path | What it is |
| --- | --- |
| `data/lists/` | The Top 100 lists, one text file each. See `docs/instructions/add-top100-list.md`. |
| `data/closest/questions.txt` | The Closest Guess questions. See `docs/instructions/add-closest-question.md`. |
| `data/link/puzzles.txt` | The Guess the Link puzzles. See `docs/instructions/add-link-puzzle.md`. |
| `js/` | The code. `game.js`, `closest-game.js`, `link-game.js`, `match.js`, `stats.js` and `lists.js` are the rules; the rest is screens. |
| `js/config.js` | Connection details for the shared online database. Empty = saved in this browser only. |
| `supabase/schema.sql` | One-time setup script for that database. |
| `tools/stamp.py` | Stamps the pages with a version code (see above). |
| `tests/` | Checks. Run `zsh tests/run.sh` (needs nothing installed on a Mac). |
| `tests/smoke.html` | Clicks through the real pages. Open http://localhost:8765/tests/smoke.html; it wipes the hub's saved data in that browser, so it only runs on localhost. |
