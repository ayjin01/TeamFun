# Add a Closest Guess question

All questions live in one plain-text file: `data/closest/questions.txt`.

## Steps

1. **Find a fact with one clear number for an answer.** Look the number up on a source you would trust (an official site, a reference work); never write it from memory. Skip facts where good sources disagree or the number keeps changing (follower counts, populations, "about 300").
2. **Add a block** to the file, with a blank line before and after:

   ```
   q: How many steps are there from the ground to the top of the Eiffel Tower?
   a: 1665
   unit: steps
   note: Visitors can only climb the first 674.
   source: Eiffel Tower official website
   url: https://...
   asOf: checked Nov 2026
   ```

   - `q` must end with a question mark and say exactly what is being counted (from where to where, rounded how).
   - `a` is the number only. Commas and decimals are fine (`21,196` or `45.52`).
   - `unit` is shown as "Answer in ...". For a year, write `unit: year` so it shows as 1992, not 1,992. Leave it out if there is no unit.
   - `note` (optional) is shown with the answer. `source` and `asOf` are required; `url` is optional.
   - For sums anyone can check, use `source: Arithmetic` and `asOf: always`.
3. **Run the check:** `zsh tests/run.sh`. It fails if a question has no number, no source or no date, or appears twice.

A round uses 8 questions plus up to 3 for sudden death, and prefers ones the team hasn't seen.
