# Add a Guess the Link puzzle

All puzzles live in one plain-text file: `data/link/puzzles.txt`.

## Steps

1. **Think of four things with one clear connection**, and check each fact or spelling trick.
   - Aim for hard. A plain category (four pasta shapes, four Bond films) is too easy. Better links are about the words themselves (a hidden word, an anagram, a spelling or sound pattern), a missing word ("words that go before moon"), or one word with several meanings ("things with a bridge": a song, a ship, a violin, a nose).
   - The first two clues appear together, so pick two that don't give it away on their own.
2. **Add a block** to the file, with a blank line before and after:

   ```
   link: Things with keys
   accept: key | keys
   clues: Florida ; A map ; A piano ; A keyboard
   note: The Florida Keys, a map key, piano keys and keyboard keys.
   ```

   - `link` is the answer shown at the end.
   - `clues`: exactly four, separated by `;`, **hardest first**. The game shows the first two together, then one more at a time. A good first clue could belong to several groups; the last one should nearly give it away.
   - `accept`: the key words that count as right, separated by `|`. A guess is right if it contains any of them, so "famous things with keys" matches `keys`.
     - Small typos are forgiven on words of five letters or more, but plurals are not added for you: list both `key` and `keys`.
     - Keep them specific. `cards` would wrongly accept "card games" for a puzzle about suits.
     - No clue may contain an accepted word.
   - `note` (optional) explains the link when the answer is shown.
3. **Run the check:** `zsh tests/run.sh`. It fails if a puzzle doesn't have four clues, if typing the link itself wouldn't be accepted, or if a clue gives the answer away.

Keep the knowledge needed general: the difficulty should come from spotting the link, not from football or UK-celebrity trivia. The team plays together: a round is 8 puzzles, and prefers ones the team hasn't seen.
