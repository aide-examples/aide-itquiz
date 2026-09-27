// @ts-check
'use strict';

/**
 * itquiz — the player's page.
 *
 * It asks the server for a question, shows it, sends back what was picked, and
 * shows what the server says about it. It does NOT know which answer is right:
 * the server recomputes that from the facts when the answer arrives (see
 * server/routes.js), so the page cannot flatter the player and the log cannot
 * be talked into recording a wrong answer as correct.
 *
 * Two strings live here rather than in the database, and the boundary is worth
 * naming: the QUESTIONS are data, per language, because they are the subject
 * matter. The four words of chrome below are not — they belong to this page.
 */

(() => {
  const CHROME = {
    de: { next: 'Weiter', right: 'Richtig', wrong: 'Falsch', score: (r, n) => `${r}/${n}`, empty: 'Es lässt sich gerade keine Frage bilden.' },
    en: { next: 'Next', right: 'Correct', wrong: 'Wrong', score: (r, n) => `${r}/${n}`, empty: 'No question can be built right now.' },
  };

  // The page is served under <base>/sys/quiz/, so the API is two levels up. A leading
  // slash would break every installation mounted on a sub-path. Both routes are spelled
  // out rather than composed from a base: a path assembled at runtime is one that
  // `test-system-api-paths` cannot check, and a 404 in a page nobody looks at is exactly
  // what that detector exists to catch.
  const QUESTION_URL = '../../api/sys/itquiz/question';
  const ANSWER_URL = '../../api/sys/itquiz/answer';

  const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

  const state = {
    lang: (navigator.language || 'en').slice(0, 2) === 'de' ? 'de' : 'en',
    question: null,
    asked: 0,
    right: 0,
  };

  /** The chrome words for the language in play. */
  const words = () => CHROME[state.lang] || CHROME.en;

  /** Fetch the next question and paint it. */
  async function next() {
    $('q-verdict').hidden = true;
    $('q-options').innerHTML = '';
    $('q-text').textContent = '…';
    try {
      const r = await fetch(`${QUESTION_URL}?lang=${state.lang}`, { credentials: 'same-origin' });
      if (!r.ok) throw new Error(String(r.status));
      state.question = await r.json();
      paint();
    } catch (_) {
      state.question = null;
      $('q-text').textContent = words().empty;
    }
  }

  /** Draw the current question and its options. */
  function paint() {
    const q = state.question;
    $('q-text').textContent = q.text;
    const box = $('q-options');
    box.innerHTML = '';
    q.options.forEach((label, i) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'q-option';
      // The number is a keyboard shortcut and a reading aid, not decoration —
      // it is what the 1..4 keys below refer to.
      b.textContent = `${i + 1}. ${label}`;
      b.addEventListener('click', () => answer(label, b));
      box.appendChild(b);
    });
    /** @type {HTMLButtonElement|null} */ (box.querySelector('.q-option'))?.focus();
  }

  /**
   * Send the pick, then show the verdict the SERVER returned.
   *
   * The clicked button is coloured from that verdict rather than from a local
   * comparison, so what the player sees and what the log records are the same
   * judgement, made once.
   */
  async function answer(chosen, button) {
    const q = state.question;
    if (!q) return;
    const buttons = /** @type {NodeListOf<HTMLButtonElement>} */ ($('q-options').querySelectorAll('.q-option'));
    buttons.forEach((b) => { b.disabled = true; });
    try {
      const r = await fetch(ANSWER_URL, {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          template: q.template, language: q.language,
          subject: q.subject, object: q.object, chosen,
        }),
      });
      if (!r.ok) throw new Error(String(r.status));
      const verdict = await r.json();

      state.asked += 1;
      if (verdict.quality === 'correct') state.right += 1;
      $('q-score').textContent = words().score(state.right, state.asked);

      button.classList.add(verdict.quality === 'correct' ? 'is-right' : 'is-wrong');
      if (verdict.quality !== 'correct') {
        // Show where the right answer was. Without it a wrong answer teaches
        // only that it was wrong, which is the half that does not help.
        buttons.forEach((b) => {
          if (b.textContent.replace(/^\d+\.\s/, '') === verdict.correct) b.classList.add('is-right');
        });
      }
      $('q-explain').textContent = verdict.explanation || '';
      $('q-verdict').hidden = false;
      $('q-next').focus();
    } catch (_) {
      buttons.forEach((b) => { b.disabled = false; });
    }
  }

  /** Paint the language buttons from the state, so the two cannot disagree. */
  function paintLang() {
    document.querySelectorAll('.q-lang-btn').forEach((b) => {
      b.setAttribute('aria-pressed', String(b.getAttribute('data-lang') === state.lang));
    });
    $('q-next').textContent = words().next;
    document.documentElement.lang = state.lang;
  }

  document.querySelectorAll('.q-lang-btn').forEach((b) => {
    b.addEventListener('click', () => {
      state.lang = b.getAttribute('data-lang');
      try { localStorage.setItem('itquiz-lang', state.lang); } catch (_) { /* private window */ }
      paintLang();
      next();
    });
  });

  $('q-next').addEventListener('click', next);

  // Keyboard: the digits pick an option, Enter moves on. A quiz answered with
  // one hand on a keyboard should not need the mouse at all.
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !$('q-verdict').hidden) { next(); return; }
    const n = Number(e.key);
    if (n >= 1 && n <= 9 && $('q-verdict').hidden) {
      const b = /** @type {HTMLButtonElement|null} */ ($('q-options').querySelectorAll('.q-option')[n - 1]);
      if (b && !b.disabled) b.click();
    }
  });

  try {
    const kept = localStorage.getItem('itquiz-lang');
    if (kept === 'de' || kept === 'en') state.lang = kept;
  } catch (_) { /* private window — the browser language stands */ }

  paintLang();
  next();
})();
