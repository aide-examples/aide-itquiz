// @ts-check
'use strict';

/**
 * itquiz system routes — the seam the quiz page attaches to.
 *
 *   GET  /api/sys/itquiz/question   one question, worded in the asked language
 *   POST /api/sys/itquiz/answer     judge it, and record that it was asked
 *
 * ── Why these exist, rather than plain CRUD ──────────────────────────────────
 *
 * `AskedQuestion` carries **no entity permission** in config.json, deliberately.
 * A player must not be able to read another player's history through
 * `/api/entities/...`, and no create permission can express "only your own row".
 * So the owner is taken from the SESSION and never from the request body — the
 * same seam `aide-lerntrainer` uses, and for the same reason.
 *
 * ── Why the answer is judged HERE and not in the page ────────────────────────
 *
 * The question endpoint deliberately does not say which option is right. The
 * answer endpoint receives what was asked (template, language, the records) and
 * what was picked, and RECOMPUTES the truth from the facts. That keeps the log
 * honest without any state between the two calls: a page cannot report a wrong
 * answer as correct, and the server needs to remember nothing between them.
 *
 * ── Where this deliberately stops ────────────────────────────────────────────
 *
 * It picks a question at random. It does not look at what this player already
 * got wrong, and it does not space the repetitions. That is the next step and it
 * belongs on top of the log this writes, not inside the picker.
 */

const path = require('path');

/** Seconds since the epoch — what a `timestamp` column stores. */
function nowTs() {
  return Math.floor(Date.now() / 1000);
}

/** Pick one element at random; `[]` gives undefined, which every caller checks. */
function any(rows) {
  return rows[Math.floor(Math.random() * rows.length)];
}

/** n distinct elements at random, fewer if the pool is smaller. */
function sample(rows, n) {
  const pool = rows.slice();
  const out = [];
  while (out.length < n && pool.length) out.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]);
  return out;
}

const DEFINITE = { m: 'der', f: 'die', n: 'das' };
const INDEFINITE = { m: 'ein', f: 'eine', n: 'ein' };

module.exports = function registerSystemRoutes(app, deps) {
  const { theLogger, appDir, authMiddleware, requireEntityVerb } = deps;
  const { getAdapter } = require(path.join(appDir, 'server/config/database'));
  // §51: the log row is written through the SERVICE, so the before/after hooks,
  // the transaction and the audit trail happen. The framework does not hand a
  // system route the service in `deps`, so it is required here — the same module
  // instance the framework wired at boot, not a second one.
  const theGenericService = require(path.join(appDir, 'server/services/GenericService'));

  // Every domain read goes through the ACTIVE engine handle (global CLAUDE.md §39).
  const engine = () => getAdapter();

  /**
   * The facts, as the question builder needs them. Small enough to read whole on
   * every question — five types and ten products today, and a quiz that grew to
   * thousands of rows would want a different picker anyway, not a cached one.
   */
  async function facts() {
    const eng = engine();
    const [types, texts, products, companies, templates, phrases] = await Promise.all([
      eng.query('SELECT id, name, purpose FROM product_type WHERE id > 1'),
      eng.query('SELECT product_type_id, language, name, purpose, gender FROM product_type_text WHERE id > 1'),
      eng.query('SELECT id, name, product_type_id, manufacturer_id FROM product WHERE id > 1'),
      eng.query('SELECT id, name FROM company WHERE id > 1'),
      eng.query('SELECT id, key, subject_kind, object_kind, answer_kind FROM question_template WHERE id > 1'),
      eng.query('SELECT template_id, language, text, explanation FROM question_phrase WHERE id > 1'),
    ]);
    return { types, texts, products, companies, templates, phrases };
  }

  /**
   * The word for a product type in one language, falling back to the parent.
   *
   * The parent row holds the English wording; a `ProductTypeText` child holds a
   * translation. A missing child is not an error — it means the English term is
   * the one that is used in that language too, which is true of a good many IT
   * words.
   */
  function word(f, type, lang, field) {
    const child = f.texts.find((t) => t.product_type_id === type.id && t.language === lang);
    return (child && child[field]) || type[field];
  }

  /** The grammatical gender of a type's noun in one language, or null. */
  function gender(f, type, lang) {
    const child = f.texts.find((t) => t.product_type_id === type.id && t.language === lang);
    return (child && child.gender) || null;
  }

  /**
   * Fill a phrase.
   *
   * Besides `{subject}` / `{object}` / `{answer}` a phrase may carry
   * `{der_<role>}` and `{ein_<role>}` — the definite and indefinite article of
   * whatever noun lands in that role. They exist because the first German
   * questions read „Wie heißt DER Suchmaschine" and „Ist Chrome EIN
   * Suchmaschine": a quiz that teaches a distinction while getting the article
   * wrong undermines itself. Both articles are derived from the one stored
   * gender, so they cannot disagree about a noun. A language without them (or a
   * role that is not a noun with a gender) renders the placeholder empty.
   */
  function fill(text, roles, lang) {
    let out = text;
    for (const [role, v] of Object.entries(roles)) {
      const label = v.label ?? '';
      // English has no gender to store, and does not need one: its indefinite article
      // follows the SOUND of the next word. The initial letter is the usual
      // approximation and it is wrong for exactly the cases this system does not have
      // (an hour, a university) — when one turns up, that is the moment to store it,
      // not before.
      const a = v.gender ? INDEFINITE[v.gender] : (lang === 'en' && label ? (/^[aeiou]/i.test(label) ? 'an' : 'a') : '');
      const der = v.gender ? DEFINITE[v.gender] : (lang === 'en' && label ? 'the' : '');
      out = out.split(`{${role}}`).join(label);
      out = out.split(`{der_${role}}`).join(der);
      out = out.split(`{ein_${role}}`).join(a);
    }
    return out.replace(/\s{2,}/g, ' ').trim();
  }

  /**
   * Build one question of a given template, or null when the facts do not carry
   * an instance of it (too few products of a kind, a type nobody makes).
   *
   * The shape it returns is also the shape the answer endpoint receives back, so
   * the truth can be recomputed there without anything being remembered in
   * between.
   */
  function build(f, template, lang) {
    const phrase = f.phrases.find((p) => p.template_id === template.id && p.language === lang)
      || f.phrases.find((p) => p.template_id === template.id && p.language === 'en');
    if (!phrase) return null;

    const typeOf = (p) => f.types.find((t) => t.id === p.product_type_id);
    const makerOf = (p) => f.companies.find((c) => c.id === p.manufacturer_id);
    const named = (row) => ({ label: row.name });
    // One product of a kind, for an explanation that wants something the reader has held.
    // Deliberately the FIRST and not a random one: a reader who meets the same question
    // twice should meet the same example, or the example becomes noise.
    const exampleOf = (t) => f.products.find((x) => x.product_type_id === t.id);
    const typed = (t) => ({ label: word(f, t, lang, 'name'), gender: gender(f, t, lang) });

    if (template.key === 'manufacturer') {
      const p = any(f.products.filter((x) => x.manufacturer_id && x.product_type_id));
      if (!p) return null;
      const right = makerOf(p);
      const own = typeOf(p);
      if (!own) return null;
      const wrong = sample(f.companies.filter((c) => c.id !== right.id), 3);
      if (wrong.length < 2) return null;
      return {
        template: template.key, language: lang,
        subject: { kind: 'Product', id: p.id },
        object: null,
        text: fill(phrase.text, { subject: named(p) }, lang),
        options: [right, ...wrong].map((c) => c.name),
        _correct: right.name,
        // The `type` role carries the fact the maxim used to stand in for — see
        // QuestionPhrase.md, "An explanation carries a fact, not a moral".
        _explanation: fill(phrase.explanation, { subject: named(p), answer: named(right), type: typed(own) }, lang),
      };
    }

    if (template.key === 'product_of_company') {
      const p = any(f.products.filter((x) => x.manufacturer_id && x.product_type_id));
      if (!p) return null;
      const t = typeOf(p), c = makerOf(p);
      if (!t || !c) return null;
      const wrong = sample(f.products.filter((x) => x.id !== p.id), 3);
      if (wrong.length < 2) return null;
      return {
        template: template.key, language: lang,
        subject: { kind: 'Company', id: c.id },
        object: { kind: 'ProductType', id: t.id },
        text: fill(phrase.text, { subject: named(c), object: typed(t) }, lang),
        options: [p, ...wrong].map((x) => x.name),
        _correct: p.name,
        // The question already named the type AND the maker, so the answer alone adds
        // nothing beyond itself. What the reader does not have is what the type is FOR.
        _explanation: fill(phrase.explanation,
          { subject: named(c), object: typed(t), answer: named(p), purpose: { label: word(f, t, lang, 'purpose') } }, lang),
      };
    }

    if (template.key === 'purpose') {
      const t = any(f.types.filter((x) => word(f, x, lang, 'purpose')));
      if (!t) return null;
      const wrong = sample(f.types.filter((x) => x.id !== t.id), 3);
      if (wrong.length < 2) return null;
      return {
        template: template.key, language: lang,
        subject: { kind: 'ProductType', id: t.id },
        object: null,
        text: fill(phrase.text, { subject: { label: word(f, t, lang, 'purpose') } }, lang),
        options: [t, ...wrong].map((x) => word(f, x, lang, 'name')),
        _correct: word(f, t, lang, 'name'),
        // The question was the purpose, so naming the type says only what was asked. A
        // thing the reader has actually held is the fact that lands.
        _explanation: fill(phrase.explanation, { answer: typed(t), example: named(exampleOf(t) || { name: '' }) }, lang),
      };
    }

    if (template.key === 'is_a') {
      const p = any(f.products.filter((x) => x.product_type_id));
      if (!p) return null;
      const own = typeOf(p);
      if (!own) return null;
      // Half the time ask about the type it HAS, half about one it has not —
      // otherwise „yes" is always right and the question teaches nothing.
      const truthful = Math.random() < 0.5;
      const asked = truthful ? own : any(f.types.filter((x) => x.id !== own.id));
      if (!asked) return null;
      const yes = lang === 'de' ? 'Ja' : 'Yes';
      const no = lang === 'de' ? 'Nein' : 'No';
      return {
        template: template.key, language: lang,
        subject: { kind: 'Product', id: p.id },
        object: { kind: 'ProductType', id: asked.id },
        text: fill(phrase.text, { subject: named(p), object: typed(asked) }, lang),
        options: [yes, no],
        _correct: truthful ? yes : no,
        // On a "no" the right type IS the new fact; on a "yes" it merely repeats the
        // question, so the maker carries the sentence in both cases.
        _explanation: fill(phrase.explanation,
          { subject: named(p), answer: typed(own), maker: named(makerOf(p) || { name: '' }) }, lang),
      };
    }

    return null;
  }

  /** Shuffle in place — the right answer must not always be first. */
  function shuffled(options) {
    const a = options.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  // ── One question ────────────────────────────────────────────────────────────
  //
  // Guarded by the DECLARED permission, not by a role name: both the player role
  // and any admin hold `ProductType: "r"` in config.json, so the guard says what
  // the config says, in one place.
  app.get('/api/sys/itquiz/question',
    authMiddleware, requireEntityVerb('ProductType', 'r'),
    async (req, res) => {
      try {
        const lang = String(req.query.lang || 'en');
        const f = await facts();
        // Try the templates in random order — one of them may have no instance
        // in today's facts, and that must not turn into an empty page.
        for (const template of shuffled(f.templates)) {
          const q = build(f, template, lang);
          if (!q) continue;
          const { _correct, _explanation, ...open } = q;
          return res.json({ ...open, options: shuffled(q.options) });
        }
        return res.status(503).json({ error: 'no question can be built from the facts on record' });
      } catch (err) {
        theLogger.error('itquiz: question failed', { error: err.message });
        return res.status(500).json({ error: err.message });
      }
    });

  // ── The answer, judged and recorded ────────────────────────────────────────
  app.post('/api/sys/itquiz/answer',
    authMiddleware, requireEntityVerb('ProductType', 'r'),
    async (req, res) => {
      try {
        const username = req.user && req.user.username;
        // The owner comes from the signed session cookie. Nothing in the body
        // can reach it, and an unauthenticated write is a bug, not a guest.
        if (!username) return res.status(403).json({ error: 'not signed in' });

        const { template: key, language, subject, object, chosen } = req.body || {};
        const f = await facts();
        const template = f.templates.find((t) => t.key === key);
        if (!template) return res.status(400).json({ error: `unknown template ${key}` });

        // Recompute the truth from the facts, rather than trusting the page.
        const truth = judge(f, template, language, subject, object);
        if (!truth) return res.status(400).json({ error: 'the question no longer matches the facts' });

        const quality = chosen == null ? 'skipped' : (chosen === truth.correct ? 'correct' : 'wrong');
        const col = (role, r) => (r ? { Product: `${role}_product_id`, ProductType: `${role}_product_type_id`, Company: `${role}_company_id` }[r.kind] : null);

        const row = {
          user: username,
          template_id: template.id,
          language,
          asked_at: nowTs(),
          quality,
          given_answer: chosen == null ? null : String(chosen),
        };
        if (subject) row[col('subject', subject)] = subject.id;
        if (object) row[col('object', object)] = object.id;

        // The same context the user's own path builds (GenericCrudRouter
        // `buildContext`) — `changedBy` above all. The first version passed
        // `user: req.user`, which the service does not read, so the audit row
        // was stamped with the client IP and the name of the player was lost.
        // §51's own test caught it: an internal call that is SHORTER than the
        // user's path differs by exactly the obligations it skips.
        await theGenericService.createEntity('AskedQuestion', row, {
          correlationId: req.correlationId,
          clientIp: req.ip || req.connection?.remoteAddress,
          changedBy: username,
        });

        return res.json({ quality, correct: truth.correct, explanation: truth.explanation });
      } catch (err) {
        theLogger.error('itquiz: answer failed', { error: err.message });
        return res.status(500).json({ error: err.message });
      }
    });

  /**
   * What the right answer to this question is — recomputed from the records the
   * page hands back, never taken from it.
   *
   * It repeats the per-template knowledge of `build` for the answer alone. That
   * duplication is deliberate and is the second copy, not the third (§9): the
   * two do different things — one worded a question and drew distractors, this
   * one only names the truth — and folding them together would mean building a
   * whole question in order to grade one.
   */
  function judge(f, template, lang, subject, object) {
    const type = (id) => f.types.find((t) => t.id === id);
    const prod = (id) => f.products.find((p) => p.id === id);
    const comp = (id) => f.companies.find((c) => c.id === id);
    const phrase = f.phrases.find((p) => p.template_id === template.id && p.language === lang)
      || f.phrases.find((p) => p.template_id === template.id && p.language === 'en');
    if (!phrase) return null;
    const typed = (t) => ({ label: word(f, t, lang, 'name'), gender: gender(f, t, lang) });

    if (template.key === 'manufacturer') {
      const p = prod(subject && subject.id); if (!p) return null;
      const c = comp(p.manufacturer_id); if (!c) return null;
      const own = type(p.product_type_id); if (!own) return null;
      return {
        correct: c.name,
        explanation: fill(phrase.explanation,
          { subject: { label: p.name }, answer: { label: c.name }, type: typed(own) }, lang),
      };
    }
    if (template.key === 'product_of_company') {
      const c = comp(subject && subject.id), t = type(object && object.id);
      if (!c || !t) return null;
      const p = f.products.find((x) => x.manufacturer_id === c.id && x.product_type_id === t.id);
      if (!p) return null;
      return {
        correct: p.name,
        explanation: fill(phrase.explanation,
          { subject: { label: c.name }, object: typed(t), answer: { label: p.name }, purpose: { label: word(f, t, lang, 'purpose') } }, lang),
      };
    }
    if (template.key === 'purpose') {
      const t = type(subject && subject.id); if (!t) return null;
      const beispiel = f.products.find((x) => x.product_type_id === t.id);
      return {
        correct: word(f, t, lang, 'name'),
        explanation: fill(phrase.explanation,
          { answer: typed(t), example: { label: (beispiel && beispiel.name) || '' } }, lang),
      };
    }
    if (template.key === 'is_a') {
      const p = prod(subject && subject.id), asked = type(object && object.id);
      if (!p || !asked) return null;
      const own = type(p.product_type_id); if (!own) return null;
      const yes = lang === 'de' ? 'Ja' : 'Yes';
      const no = lang === 'de' ? 'Nein' : 'No';
      const hersteller = comp(p.manufacturer_id);
      return {
        correct: asked.id === own.id ? yes : no,
        explanation: fill(phrase.explanation,
          { subject: { label: p.name }, answer: typed(own), maker: { label: (hersteller && hersteller.name) || '' } }, lang),
      };
    }
    return null;
  }

  theLogger.info('itquiz routes registered', { routes: ['GET /api/sys/itquiz/question', 'POST /api/sys/itquiz/answer'] });
};
