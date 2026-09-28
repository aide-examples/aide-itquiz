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
    de: {
      next: 'Weiter', right: 'Richtig', wrong: 'Falsch',
      look: '🔎 Im Katalog ansehen',
      lookWindow: 'Öffnet den Katalog in einem eigenen Fenster, bei diesem Eintrag. '
        + 'Das Fenster bleibt offen und springt bei der nächsten Frage weiter.',
      lookTab: 'Öffnet den Katalog bei diesem Eintrag — in einem neuen Tab, '
        + 'das Quiz bleibt daneben stehen.',
      score: (r, n) => `${r}/${n}`,
      empty: 'Es lässt sich gerade keine Frage bilden.',
      notRecorded: 'Stellvertreter-Modus: diese Antwort wird nicht mitgeschrieben.',
      failed: 'Die Antwort konnte nicht geprüft werden.',
    },
    en: {
      next: 'Next', right: 'Correct', wrong: 'Wrong',
      look: '🔎 Look it up',
      lookWindow: 'Opens the catalogue in a window of its own, at this entry. The window '
        + 'stays open and moves on with the next question.',
      lookTab: 'Opens the catalogue at this entry, in a new tab — the quiz stays where it is.',
      score: (r, n) => `${r}/${n}`,
      empty: 'No question can be built right now.',
      notRecorded: 'Impersonation: this answer is not being recorded.',
      failed: 'The answer could not be checked.',
    },
  };

  // The page is served under <base>/sys/quiz/, so the API is two levels up. A leading
  // slash would break every installation mounted on a sub-path. Both routes are spelled
  // out rather than composed from a base: a path assembled at runtime is one that
  // `test-system-api-paths` cannot check, and a 404 in a page nobody looks at is exactly
  // what that detector exists to catch.
  const QUESTION_URL = '../../api/sys/itquiz/question';
  const VERDICT_URL = '../../api/sys/itquiz/verdict';
  const ANSWER_URL = '../../api/sys/itquiz/answer';

  const $ = (id) => /** @type {HTMLElement} */ (document.getElementById(id));

  /**
   * Is this a screen a second WINDOW would be wrong on?
   *
   * Asked at the moment of the click, never at load: a tablet gets rotated, and a decision
   * taken at boot would have the wrong answer for the rest of the session.
   *
   * @returns {boolean}
   */
  const narrow = () => window.matchMedia('(max-width: 780px)').matches;

  /**
   * Open the catalogue at one record — as a LINKED VIEW on a screen that has room for one,
   * and as a plain tab on a phone.
   *
   * ── Both doors lead to the same place ─────────────────────────────────────────────────
   * RAP reads `?crumbs=` — a base64 list of screens, `t` for the type, `e` for the entity,
   * `r` for the record, `m` for the view mode. The quiz names the RECORD and the framework
   * owns the format; this builds the one URL and nothing else knows it.
   *
   * ── Why two behaviours and not one ────────────────────────────────────────────────────
   * On a wide screen a NAMED window is a linked view in RAP's own sense: the name is the
   * entity, so the same window is reused and re-navigates with each question instead of
   * leaving a pile of windows behind.
   *
   * On a phone that is exactly wrong — Gero's objection, and it is the deciding one: every
   * kind of extra window is too cramped there, and what a phone wants is the normal UI, full
   * screen, with its view selector. A plain tab gives that, and it gives it WITHOUT costing
   * the current question: navigating this tab would end the quiz, and Back would come back to
   * a fresh one.
   *
   * @param {{kind: string, id: any}} focus - what the question was about
   * @returns {void}
   */
  function openCatalogue(focus) {
    // `t:'r'` — a record screen. `m:'tree-h'` because a tree is what answers „how does this
    // hang together", which is the question somebody pressing this button has.
    const crumb = { t: 'r', e: focus.kind, r: focus.id, m: 'tree-h' };
    const url = `../../?crumbs=${encodeURIComponent(btoa(JSON.stringify([crumb])))}`;
    if (narrow()) { window.open(url, '_blank'); return; }
    // The window NAME is the entity — that is what makes it a linked view rather than a tab,
    // and what makes the second press reuse the first window.
    window.open(url, focus.kind, 'width=1100,height=800');
  }

  /**
   * Render an explanation.
   *
   * A phrase is DATA — an operator writes it in the Question-phrases table — so it is
   * escaped first and only then given the two marks it is allowed to carry:
   *
   *   a newline   → a line break
   *   *…*         → italics
   *
   * Two, and closed. The italics exist for one job: an explanatory lead-in to supplementary
   * information („Was ein Browser tut:") belongs on a line of its own and set apart, so the
   * eye can tell the answer from the aside. Anything wider would be a markup language in a
   * database column, and the escape is what keeps a phrase from becoming a script.
   *
   * @param {string} text
   * @returns {string} HTML, safe to assign
   */
  function renderExplanation(text) {
    const esc = String(text ?? '')
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    return esc
      .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
      .replace(/\n/g, '<br>');
  }

  const state = {
    lang: (navigator.language || 'en').slice(0, 2) === 'de' ? 'de' : 'en',
    question: null,
    asked: 0,
    right: 0,
    /** @type {{kind: string, id: any}|null} What the last verdict said it was about. */
    focus: null,
  };

  /** The chrome words for the language in play. */
  const words = () => CHROME[state.lang] || CHROME.en;

  /** Fetch the next question and paint it. */
  async function next() {
    $('q-verdict').hidden = true;
    // Clearing as well as hiding. The hiding is the mechanism; this decides what a FAILURE
    // of it looks like — an empty line rather than the previous question's answer, which is
    // the shape the bug had: right markup, wrong sentence, nothing to see in any log.
    $('q-explain').innerHTML = '';
    $('q-note').hidden = true;
    $('q-options').innerHTML = '';
    $('q-image').hidden = true;
    $('q-image').removeAttribute('src');
    // The previous answer's picture goes with the previous answer. Without this it survives
    // into the next question's verdict for as long as that one has none — the same defect the
    // explanation itself had, one element over.
    $('q-answer-image').hidden = true;
    $('q-answer-image').removeAttribute('src');
    $('q-source').hidden = true;
    $('q-source').innerHTML = '';
    $('q-look').hidden = true;
    state.focus = null;
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
    // Two templates ask with a picture instead of a sentence. The `alt` stays EMPTY on
    // purpose: naming the thing in it would hand the answer to a screen reader, and the
    // text beside it already says what is being asked.
    const questionImage = /** @type {HTMLImageElement} */ ($('q-image'));
    // The server names the picture relative to the APP root (`api/media/…`); this page sits
    // two levels below it, so it prefixes exactly as the two endpoints above do. Without the
    // prefix the browser asks for `/sys/quiz/api/media/…`, the element is there and visible
    // and simply never paints — measured: `hidden=false`, `naturalWidth=0`, no error.
    if (q.image) { questionImage.src = `../../${q.image}`; questionImage.hidden = false; } else { questionImage.hidden = true; }
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
    const payload = { template: q.template, language: q.language, subject: q.subject, object: q.object, chosen };
    try {
      // The verdict first, and as a GET. It is a read — the server computes the truth from
      // the facts and stores nothing — and being a read is what lets it work in a session
      // that may not write: an admin looking through a player's eyes is capped read-only by
      // the framework, and with the judging behind the POST that admin got a quiz where
      // clicking an answer did nothing at all.
      const qs = new URLSearchParams({
        template: q.template, language: q.language, chosen: String(chosen),
        subject: JSON.stringify(q.subject), object: JSON.stringify(q.object),
      });
      const r = await fetch(`${VERDICT_URL}?${qs}`, { credentials: 'same-origin' });
      if (!r.ok) throw new Error(String(r.status));
      const verdict = await r.json();

      // Then the recording, which may legitimately be refused. A 403 here means the session
      // is read-only, and that is not an error to hide from the player: the answer counted
      // on screen and did not count in the history, and only saying so keeps the two honest.
      recordAnswer(payload);

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
      $('q-explain').innerHTML = renderExplanation(verdict.explanation);
      // The face of the thing the explanation is about, where it has one. The server decides
      // WHICH record that is — for a yes/no question it is not the answer — and answers null
      // where there is no picture, which is the normal case and not a failure.
      const answerImage = /** @type {HTMLImageElement} */ ($('q-answer-image'));
      if (verdict.image) {
        answerImage.src = `../../${verdict.image}`;
        answerImage.hidden = false;
      } else {
        answerImage.hidden = true;
        answerImage.removeAttribute('src');
      }
      // The article to read on in. The server names it as `{lang, title}` and `wikipediaRef`
      // turns that into the address — this page does not build a wikipedia.org URL, because
      // exactly one thing in the fleet is allowed to and it is not here (aide-rap#501).
      //
      // The markup is RAP's: `.wikipedia-ref` plus the two data attributes. `WikipediaCard` is
      // a DELEGATED listener on `document`, so emitting the class is the whole of wiring the
      // hover preview up — nothing here calls it, and nothing here can forget to.
      const source = $('q-source');
      const ref = verdict.article && WikipediaRef.wikipediaRef(
        `${verdict.article.lang}:${verdict.article.title}`, state.lang);
      if (ref) {
        const esc = (/** @type {string} */ v) => v
          .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
        source.innerHTML = `<a class="wikipedia-ref" href="${esc(ref.url)}" target="wikipedia"`
          + ` rel="noopener" data-wp-lang="${esc(ref.lang)}" data-wp-title="${esc(ref.title)}">`
          + `<img src="../../icons/wikipedia.svg" alt="" class="q-source-icon"> ${esc(ref.title)}</a>`;
        source.hidden = false;
      } else {
        source.hidden = true;
        source.innerHTML = '';
      }
      // The way into the catalogue, at the record this question was about. Hidden when the
      // server named none — which happens only where there is genuinely nothing to open.
      const look = /** @type {HTMLButtonElement} */ ($('q-look'));
      state.focus = verdict.focus || null;
      if (state.focus) {
        look.textContent = words().look;
        look.title = words()[narrow() ? 'lookTab' : 'lookWindow'];
        look.hidden = false;
      } else {
        look.hidden = true;
      }
      $('q-verdict').hidden = false;
      $('q-next').focus();
    } catch (_) {
      // Do NOT fail silently: a disabled row of buttons and no verdict is exactly what the
      // impersonation report looked like from the outside — „it does not work", with nothing
      // said. Re-enable, and say that the check failed.
      buttons.forEach((b) => { b.disabled = false; });
      $('q-explain').textContent = words().failed;   // a chrome word, not a phrase — no markup
      $('q-verdict').hidden = false;
    }
  }

  /**
   * Write the answer to the player's history — separately, and never blocking the verdict.
   *
   * The server re-judges the payload rather than trusting what the page was told, so this
   * carries the same fields as the verdict call and no `quality`. A refusal is reported in
   * one line under the explanation instead of being swallowed.
   */
  function recordAnswer(payload) {
    fetch(ANSWER_URL, {
      method: 'POST',
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    }).then((res) => {
      if (res.ok) return;
      $('q-note').textContent = res.status === 403 ? words().notRecorded : `HTTP ${res.status}`;
      $('q-note').hidden = false;
    }).catch((e) => {
      $('q-note').textContent = String(e.message || e);
      $('q-note').hidden = false;
    });
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
  $('q-look').addEventListener('click', () => { if (state.focus) openCatalogue(state.focus); });

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

  // One delegated listener for every `.wikipedia-ref` this page will ever render. Guarded
  // because the file is loaded by URL from the framework tree: on a deployment that ever
  // stopped shipping it, the quiz must lose a hover card and not its next question.
  if (typeof WikipediaCard !== 'undefined') WikipediaCard.init({ basePath: '../../' });

  paintLang();
  next();
})();
