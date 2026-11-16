// Pop-up forms used on more than one page:
// logging a result, editing a game, and managing the team roster.

import * as db from './db.js';
import { el, openDialog, confirmDialog, field, toast, colorFor } from './ui.js';
import { dateStr } from './stats.js';

const choice = (type, name, value, label, checked, color) =>
  el(
    'label',
    { class: 'choice', vars: color ? { '--chosen': color } : null },
    el('input', { type, name, value, checked }),
    el('span', { text: label }),
  );

// Add or edit one tracker entry. Pass `play` to edit, or `gameId` to log a new one.
export function playDialog({ play, gameId, games, players, onDone }) {
  const editing = Boolean(play?.id);
  const current = play ?? { date: dateStr(), gameId: gameId ?? games[0]?.id, outcome: '', winners: [], score: '' };

  const dateInput = el('input', { type: 'date', class: 'input', value: current.date, max: dateStr(), required: true });
  const gameSelect = el(
    'select',
    { class: 'input' },
    games.map((g) => el('option', { value: g.id, selected: g.id === current.gameId, text: g.name })),
  );
  const outcomes = el(
    'div',
    { class: 'choices' },
    choice('radio', 'outcome', 'solved', 'Solved it', current.outcome === 'solved', 'var(--green)'),
    choice('radio', 'outcome', 'failed', 'Failed', current.outcome === 'failed', 'var(--red)'),
    choice('radio', 'outcome', '', 'Just played', !current.outcome || current.outcome === 'won'),
  );
  const winners = el(
    'div',
    { class: 'choices' },
    players.length
      ? players.map((p, i) => choice('checkbox', 'winner', p.id, p.name, current.winners?.includes(p.id), colorFor(i)))
      : el('span', { class: 'muted', text: 'Add people to the team roster to record winners.' }),
  );
  const scoreInput = el('input', {
    class: 'input',
    value: current.score ?? '',
    maxlength: 80,
    placeholder: 'e.g. 4 mistakes, 7,000 m, guess 12',
  });

  const outcomeField = field('How did it go?', outcomes);
  const winnersField = field('Who won? (tick more than one for a shared win)', winners);
  const showForKind = () => {
    const competitive = games.find((g) => g.id === gameSelect.value)?.kind === 'competitive';
    outcomeField.hidden = competitive;
    winnersField.hidden = !competitive;
  };
  gameSelect.addEventListener('change', showForKind);
  showForKind();

  const actions = [
    { label: 'Cancel', kind: 'ghost' },
    {
      label: editing ? 'Save changes' : 'Save result',
      kind: 'primary',
      run: async () => {
        const game = games.find((g) => g.id === gameSelect.value);
        const competitive = game?.kind === 'competitive';
        const winnerIds = competitive
          ? [...winners.querySelectorAll('input:checked')].map((i) => i.value)
          : [];
        const saved = await db.save('plays', {
          ...current,
          date: dateInput.value || dateStr(),
          gameId: gameSelect.value,
          gameName: game?.name,
          outcome: competitive ? (winnerIds.length ? 'won' : '') : outcomes.querySelector('input:checked')?.value ?? '',
          winners: winnerIds,
          winnerNames: winnerIds.map((id) => players.find((p) => p.id === id)?.name),
          score: scoreInput.value.trim(),
          createdAt: current.createdAt ?? new Date().toISOString(),
        });
        toast('Saved', 'good');
        onDone?.(saved);
      },
    },
  ];
  if (editing) {
    actions.splice(1, 0, {
      label: 'Delete entry',
      kind: 'danger',
      run: async () => {
        if (!(await confirmDialog('Delete this entry?', 'It will be removed from the history and the tallies.', 'Delete'))) {
          return false;
        }
        await db.remove('plays', play.id);
        toast('Entry deleted');
        onDone?.(null);
      },
    });
  }

  openDialog({
    title: editing ? 'Edit entry' : 'Log a result',
    content: [
      field('Game', gameSelect),
      field('Date', dateInput),
      outcomeField,
      winnersField,
      field('Score or note (optional)', scoreInput),
    ],
    actions,
  });
}

// Add or edit a game card.
export function gameDialog({ game, onDone }) {
  const editing = Boolean(game?.id);
  const current = game ?? { name: '', url: '', kind: 'collab', inWheel: true };
  const nameInput = el('input', { class: 'input', value: current.name, maxlength: 40, required: true });
  const urlInput = el('input', {
    class: 'input',
    type: 'url',
    value: current.url,
    placeholder: 'https://…',
    disabled: current.builtin,
  });
  const kinds = el(
    'div',
    { class: 'choices' },
    choice('radio', 'kind', 'collab', 'Team (we solve it together)', current.kind !== 'competitive', 'var(--cyan)'),
    choice('radio', 'kind', 'competitive', 'Versus (someone wins)', current.kind === 'competitive', 'var(--pink)'),
  );

  const actions = [
    { label: 'Cancel', kind: 'ghost' },
    {
      label: editing ? 'Save changes' : 'Add game',
      kind: 'primary',
      run: async () => {
        const name = nameInput.value.trim();
        if (!name) return false;
        await db.save('games', {
          ...current,
          name,
          url: current.builtin ? current.url : urlInput.value.trim(),
          kind: current.builtin ? current.kind : kinds.querySelector('input:checked').value,
        });
        toast(editing ? 'Game updated' : 'Game added', 'good');
        onDone?.();
      },
    },
  ];
  if (editing && !current.builtin) {
    actions.splice(1, 0, {
      label: 'Remove game',
      kind: 'danger',
      run: async () => {
        const ok = await confirmDialog(
          `Remove ${current.name}?`,
          'The card goes away. Past results stay in the tracker history.',
          'Remove',
        );
        if (!ok) return false;
        await db.remove('games', current.id);
        toast('Game removed');
        onDone?.();
      },
    });
  }

  openDialog({
    title: editing ? `Edit ${current.name}` : 'Add a game',
    content: [
      field('Name', nameInput),
      field(current.builtin ? 'Link (built in)' : 'Link to the game', urlInput),
      !current.builtin && field('What kind of game is it?', kinds),
    ],
    actions,
  });
  nameInput.focus();
}

// Add and remove the people on the team.
export function rosterDialog({ onDone }) {
  const listEl = el('ul', { class: 'roster-list' });
  const nameInput = el('input', { class: 'input', placeholder: 'Name', maxlength: 24 });

  const draw = async () => {
    const players = await db.list('players');
    listEl.replaceChildren(
      ...(players.length
        ? players.map((p) =>
            el(
              'li',
              {},
              el('span', { text: p.name }),
              el('button', {
                type: 'button',
                class: 'icon-btn',
                text: 'Remove',
                onclick: async () => {
                  const ok = await confirmDialog(
                    `Remove ${p.name}?`,
                    'Their past wins stay in the history.',
                    'Remove',
                  );
                  if (!ok) return;
                  try {
                    await db.remove('players', p.id);
                  } catch (err) {
                    toast(err.message, 'bad');
                  }
                  draw();
                },
              }),
            ),
          )
        : [el('li', { class: 'muted', text: 'Nobody yet. Add your first teammate below.' })]),
    );
  };

  const add = async () => {
    const name = nameInput.value.trim();
    if (!name) return false;
    const players = await db.list('players');
    if (players.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      toast(`${name} is already on the team`, 'bad');
      return false;
    }
    await db.save('players', { name });
    nameInput.value = '';
    nameInput.focus();
    await draw();
    return false; // keep the dialog open for the next name
  };

  openDialog({
    title: 'Team roster',
    content: [listEl, field('Add a teammate', nameInput)],
    actions: [
      { label: 'Done', kind: 'ghost', run: () => onDone?.() },
      { label: 'Add', kind: 'primary', run: add },
    ],
  }).dialog.addEventListener('cancel', () => onDone?.());
  draw();
  nameInput.focus();
}
