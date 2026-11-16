// Small building blocks shared by every page: making elements,
// pop-up dialogs, toasts (brief messages) and the page header.

import { setPasscodePrompt, isOnline } from './db.js';
import { dateStr, parseDate, dayDiff } from './stats.js';

// el('button', { class: 'btn', onclick: fn }, 'Label') -> a <button>
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs ?? {})) {
    if (value == null || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2), value);
    else if (key === 'style') Object.assign(node.style, value);
    else if (key === 'vars') for (const [k, v] of Object.entries(value)) node.style.setProperty(k, v);
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, value);
  }
  for (const child of children.flat(Infinity)) {
    if (child != null && child !== false) node.append(child);
  }
  return node;
}

// Soft pastels: butter, sky, rose, sage, peach, lavender, mint, sand. Always used behind dark text.
export const PLAYER_COLORS = ['#f7da6b', '#b0d0ee', '#f3b3c3', '#b5d6a0', '#f6bf8f', '#c9b8e8', '#a8e0d0', '#dccfb0'];
export const colorFor = (index) => PLAYER_COLORS[index % PLAYER_COLORS.length];

export function toast(message, kind = 'info') {
  const node = el('div', { class: `toast toast-${kind}`, role: 'status', text: message });
  document.body.append(node);
  setTimeout(() => node.remove(), 3500);
}

// Runs something that might fail (e.g. saving) and shows the reason if it does.
export async function attempt(fn) {
  try {
    return await fn();
  } catch (err) {
    console.error(err);
    toast(err.message || 'Something went wrong', 'bad');
    return undefined;
  }
}

// actions: [{ label, kind: 'primary' | 'ghost' | 'danger', run: async () => keepOpen? }]
// The first 'primary' action also runs when Enter is pressed.
export function openDialog({ title, content, actions = [] }) {
  const dialog = el('dialog', { class: 'dialog' });
  const close = () => {
    dialog.close();
    dialog.remove();
  };
  const runAction = async (action) => {
    const keepOpen = await attempt(async () => (await action.run?.()) === false);
    if (keepOpen === false) close();
  };
  const primary = actions.find((a) => a.kind === 'primary');
  const form = el(
    'form',
    {
      method: 'dialog',
      onsubmit: (e) => {
        e.preventDefault();
        if (primary) runAction(primary);
      },
    },
    el('h2', { text: title }),
    el('div', { class: 'dialog-body' }, content),
    el(
      'div',
      { class: 'dialog-actions' },
      actions.map((a) =>
        el('button', {
          type: a === primary ? 'submit' : 'button',
          class: `btn btn-${a.kind ?? 'ghost'}`,
          text: a.label,
          onclick: a === primary ? null : () => runAction(a),
        }),
      ),
    ),
  );
  dialog.append(form);
  dialog.addEventListener('cancel', () => dialog.remove());
  document.body.append(dialog);
  dialog.showModal();
  return { dialog, close };
}

export function confirmDialog(title, message, confirmLabel = 'Yes') {
  return new Promise((resolve) => {
    openDialog({
      title,
      content: el('p', { text: message }),
      actions: [
        { label: 'Cancel', kind: 'ghost', run: () => resolve(false) },
        { label: confirmLabel, kind: 'danger', run: () => resolve(true) },
      ],
    }).dialog.addEventListener('cancel', () => resolve(false));
  });
}

export function field(label, input) {
  return el('label', { class: 'field' }, el('span', { class: 'field-label', text: label }), input);
}

// Ask for the team passcode in a proper dialog rather than a browser pop-up.
setPasscodePrompt(
  (wasWrong) =>
    new Promise((resolve) => {
      const input = el('input', { type: 'password', class: 'input', autocomplete: 'off', required: true });
      const { dialog } = openDialog({
        title: wasWrong ? 'That passcode was wrong' : 'Team passcode',
        content: [
          el('p', { text: 'Saving changes needs the team passcode. This computer will remember it.' }),
          field('Passcode', input),
        ],
        actions: [
          { label: 'Cancel', kind: 'ghost', run: () => resolve(null) },
          { label: 'Continue', kind: 'primary', run: () => resolve(input.value.trim()) },
        ],
      });
      dialog.addEventListener('cancel', () => resolve(null));
      input.focus();
    }),
);

export function pageHeader(active) {
  const link = (href, label, key) =>
    el('a', { href, class: `nav-link${active === key ? ' is-active' : ''}`, text: label });
  return el(
    'header',
    { class: 'site-header' },
    el('a', { href: 'index.html', class: 'brand' }, el('span', { class: 'brand-small', text: 'Team' }), ' Fun Hub'),
    el(
      'nav',
      { class: 'nav' },
      link('index.html', 'Games', 'hub'),
      link('top100.html', 'Top 100', 'top100'),
      link('closest.html', 'Closest Guess', 'closest'),
      link('link.html', 'Guess the Link', 'link'),
      link('tracker.html', 'Tracker', 'tracker'),
    ),
    !isOnline &&
      el('span', {
        class: 'chip chip-warn',
        title: 'The shared online database is not connected yet',
        text: 'Saved on this computer only',
      }),
  );
}

export function niceDate(str) {
  return parseDate(str).toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' });
}

export function ago(str, today = dateStr()) {
  if (!str) return 'Never played';
  const days = dayDiff(str, today);
  if (days <= 0) return 'Played today';
  if (days === 1) return 'Played yesterday';
  return `Played ${days} days ago`;
}

// One line describing how a logged game went.
export function resultText(play, playerName = (id) => id) {
  const parts = [];
  if (play.outcome === 'solved') parts.push('Solved');
  if (play.outcome === 'failed') parts.push('Failed');
  if (play.winners?.length) {
    const names = play.winners.map((id, i) => playerName(id) ?? play.winnerNames?.[i] ?? 'Someone');
    parts.push(`${names.join(' & ')} won`);
  }
  if (play.score) parts.push(play.score);
  return parts.join(' · ') || 'Played';
}
