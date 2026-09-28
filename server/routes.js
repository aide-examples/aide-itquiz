// @ts-check
'use strict';

/**
 * itquiz system routes — the seam the quiz page attaches to.
 *
 *   GET  /api/sys/itquiz/question   one question, worded in the asked language
 *   GET  /api/sys/itquiz/verdict    what the right answer was — a READ, nothing is stored
 *   POST /api/sys/itquiz/answer     record that it was asked, and how it went
 *
 * ── Why judging and recording are two calls ─────────────────────────────────
 *
 * Because they are two different acts, and the framework's own rules make the difference
 * visible: an ADMIN LOOKING THROUGH A PLAYER'S EYES (impersonation) is capped read-only by a
 * chokepoint that refuses every mutating `/api/` method. With judging behind the POST, taking
 * anna's role produced a quiz where clicking an answer did nothing at all — the report that
 * led to this split.
 *
 * So the verdict is a GET: it computes the truth from the facts and stores nothing, which is
 * what a GET means. The POST records. An admin in someone else's seat therefore plays the
 * whole quiz and sees every explanation; only the log entry is refused, which is exactly
 * right — nothing false should land in the history of the person being looked at.
 *
 * The POST re-judges rather than believing the body. Same `judge()` either way, so there is
 * one implementation and no drift; what it buys is that a page cannot record a wrong answer
 * as correct (§3).
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
// German genitive article. The part-of sentence wants „Teil EINES Office-Pakets", and the
// case cannot be avoided by rewording without making the sentence worse. The ARTICLE derives
// from the gender like the other two; the noun's own ending does NOT — it follows a rule with
// exceptions, so it is stored on the language row (`ProductTypeText.genitive`) rather than
// guessed. A rule with exceptions would put a wrong sentence in front of a learner.
const GENITIVE = { m: 'eines', f: 'einer', n: 'eines' };
// The personal pronoun, for „Das ist der Browser von Google. ER heißt Chrome." Third
// derivation from the one stored gender — and the third time a sentence needed a form that
// would have been a guess if the gender were not in the model (§48).
const PRONOUN = { m: 'er', f: 'sie', n: 'es' };

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
   * The pool of records that carry an abbreviation, for one entity kind.
   *
   * Four entities hold a short name and a long form — a file format, a protocol, a connector
   * and a concept — and „wofür steht das?" is one question over all of them. The template row
   * names the pool through `subject_kind`, so the branch stays one and a fifth entity that
   * grows a `long_name` is a row rather than a commit (§48).
   *
   * Only rows that HAVE a long form: an abbreviation with nothing to expand into cannot be
   * asked about, and that is a fact about the data rather than an error.
   *
   * @param {any} f - the facts
   * @param {string} kind - an `EntityKind` value
   * @returns {any[]} the records of that kind that carry a long form
   */
  function abbreviated(f, kind) {
    const pools = {
      FileFormat: f.formats, Protocol: f.protocols,
      Connector: f.connectors, Concept: f.concepts,
    };
    return (pools[kind] || []).filter((x) => x.long_name);
  }

  /**
   * What to SHOW as the abbreviation of such a record.
   *
   * A format, a protocol and a connector are called by their short form already — `name` IS
   * „DOCX". A concept is not: its name is „Top-Level-Domain" and the abbreviation people meet
   * is „TLD", which is why that entity carries both. Asking „wofür steht Top-Level-Domain?"
   * would answer itself.
   *
   * @param {any} record - a row from `abbreviated`
   * @returns {string}
   */
  function shortName(record) {
    return record.abbreviation || record.name;
  }

  /**
   * The picture of the thing an explanation is about — or nothing.
   *
   * A Product and a ProductType keep theirs in `icon`, a Company in `logo`, and the reader
   * does not care which: they asked about a thing and a thing has a face. So the field name
   * is decided here rather than at seven call sites, which is also what keeps an eighth
   * template from inventing a third name for the same idea.
   *
   * Returns null for a record without one. That is a fact about the data, not a defect —
   * most of the inventory has no picture and the explanation reads perfectly without it.
   *
   * @param {any} record - a Product, ProductType or Company row
   * @returns {string|null} a media URL, relative to the app root
   */
  function picture(record) {
    const id = record && (record.icon || record.logo);
    return id ? `api/media/${id}/file` : null;
  }

  /**
   * The Wikipedia article for the thing an explanation is about — in the reader's language.
   *
   * A row carries `wikipedia_de` and `wikipedia_en`, each a value of RAP's `wikipedia` type:
   * an article TITLE with its edition in front of it (`de:Webbrowser`). The reader's language
   * is asked for first and the other is the fallback, because an inventory legitimately has
   * one and not the other — „Bing" has no German article — and a reader who cannot read the
   * edition that exists is still better off than one offered no link at all.
   *
   * Returned as `{lang, title}` and never as a URL: the address follows from those two, the
   * framework's `wikipedia-ref` derives it, and a second builder of it here is precisely the
   * drift that type was introduced to end (aide-rap#501).
   *
   * @param {any} record - a Product, ProductType or Company row
   * @param {string} lang - the language the question is being asked in
   * @returns {{lang: string, title: string}|null} null where the row names no article
   */
  function article(record, lang) {
    const raw = (record && (lang === 'de' ? record.wikipedia_de : record.wikipedia_en))
      || (record && (lang === 'de' ? record.wikipedia_en : record.wikipedia_de));
    if (!raw) return null;
    const m = String(raw).match(/^([a-z]{2,3}):(.+)$/);
    return m ? { lang: m[1], title: m[2] } : { lang, title: String(raw) };
  }

  /**
   * What an explanation offers ABOUT the things it names: a face, an article, a way in.
   *
   * All three answer one question — *which record is this sentence about?* — so they are
   * decided once, from one list, instead of three times per template. Before this there were
   * three parallel expressions in each of seven branches, each repeating the same preference
   * order, and a fourth surface would have made it four (§17: the drift starts at the second
   * copy, not at the third).
   *
   * The list is in order of PREFERENCE, and it is a list because a sentence names more than
   * one thing. „Edge ist ein Browser von Microsoft" is about Microsoft — but Microsoft has no
   * logo, and Edge's icon is still the face of something the sentence just said. Gero's
   * observation, generalised: fall back along the sentence rather than show nothing.
   *
   * The three fall back INDEPENDENTLY. A record may have a picture and no article, or the
   * other way round, and tying them together would mean losing one to keep the other.
   *
   * `mentions` is the list itself as `{kind, id}` — every record the sentence names, in the
   * same order. `focus` is its first entry and does not fall back: a picture may come from
   * further down the sentence without misleading anyone, but a door marked „look this up" has
   * to open on the thing that was asked about. Kind and id, never a URL or a query: RAP owns
   * the `?crumbs=` format and the selection channel, and the quiz names records.
   *
   * The list earns its fourth use here. It began as the picture's preference order, took the
   * article, then the deep link, and now the SELECTION broadcast — an open linked view follows
   * an answer without anything being pressed. Four surfaces, one question: *which records is
   * this sentence about?*
   *
   * @param {Array<[string, any]>} about - `[[entityName, record], …]`, most relevant first
   * @param {string} lang - the language the question is being asked in
   * @returns {{image: string|null, article: object|null, focus: object|null,
   *   mentions: Array<{kind: string, id: any}>}}
   */
  function context(about, lang) {
    const present = about.filter(([, record]) => record);
    // A record may be named twice by one sentence — „Telegram ist ein Messenger von Telegram"
    // before the company was disambiguated, or a self-referential part_of. Publishing it twice
    // is harmless but the list is also read by a human in a dump, so it is made distinct here.
    const seen = new Set();
    const mentions = [];
    for (const [kind, r] of present) {
      const key = `${kind}/${r.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      mentions.push({ kind, id: r.id });
    }
    return {
      image: present.map(([, r]) => picture(r)).find(Boolean) || null,
      article: present.map(([, r]) => article(r, lang)).find(Boolean) || null,
      focus: mentions[0] || null,
      mentions,
    };
  }

  /**
   * The facts, as the question builder needs them. Small enough to read whole on
   * every question — five types and ten products today, and a quiz that grew to
   * thousands of rows would want a different picker anyway, not a cached one.
   */
  async function facts() {
    const eng = engine();
    const [types, texts, products, companies, templates, phrases,
      formats, groups, protocols, connectors, concepts, supports] = await Promise.all([
      eng.query('SELECT id, name, purpose, part_of_id, icon, wikipedia_de, wikipedia_en FROM product_type WHERE id > 1'),
      eng.query('SELECT product_type_id, language, name, purpose, gender, genitive FROM product_type_text WHERE id > 1'),
      eng.query('SELECT id, name, product_type_id, manufacturer_id, icon, wikipedia_de, wikipedia_en FROM product WHERE id > 1'),
      eng.query('SELECT id, name, logo, wikipedia_de, wikipedia_en FROM company WHERE id > 1'),
      eng.query('SELECT id, key, subject_kind, object_kind, answer_kind FROM question_template WHERE id > 1'),
      eng.query('SELECT template_id, language, text, explanation FROM question_phrase WHERE id > 1'),
      // The standards and the notions, added 2026-09-28. Each is small and read whole, for the
      // same reason the first four are: a quiz that grew to thousands of rows would want a
      // different picker anyway, not a cached one.
      eng.query('SELECT id, name, extension, long_name, group_id, purpose, icon, wikipedia_de, wikipedia_en FROM file_format WHERE id > 1'),
      eng.query('SELECT id, name, purpose, wikipedia_de, wikipedia_en FROM format_group WHERE id > 1'),
      eng.query('SELECT id, name, long_name, purpose, wikipedia_de, wikipedia_en FROM protocol WHERE id > 1'),
      eng.query('SELECT id, name, long_name, purpose, looks_like, icon, wikipedia_de, wikipedia_en FROM connector WHERE id > 1'),
      eng.query('SELECT id, name, abbreviation, long_name, purpose, example, part_of_id, wikipedia_de, wikipedia_en FROM concept WHERE id > 1'),
      eng.query('SELECT product_id, format_id, support FROM format_support WHERE id > 1'),
    ]);
    return { types, texts, products, companies, templates, phrases,
      formats, groups, protocols, connectors, concepts, supports };
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
    return sprachfeld(f, type, lang, 'gender');
  }

  /**
   * A field that exists ONLY on the language row — gender, genitive. Unlike `word()` there is
   * no parent to fall back to: the English row has no grammatical gender to lend, and a
   * missing value means „this language does not inflect that", not „look upstairs".
   *
   * @param {any} f - the facts
   * @param {any} type - the ProductType row
   * @param {string} lang
   * @param {string} feld
   * @returns {string|null}
   */
  function sprachfeld(f, type, lang, feld) {
    const child = f.texts.find((t) => t.product_type_id === type.id && t.language === lang);
    return (child && child[feld]) || null;
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
    // An OPTIONAL CLAUSE: `[[…]]` survives only if every role it names has a value.
    // „Das ist {ein_answer} {answer}[[, zum Beispiel {example}]]." is then ONE phrase for a
    // kind that has an example and for one that has none.
    //
    // Decided HERE, before anything is substituted — afterwards an empty role has already
    // become an empty string and the clause looks full. That was the first version, and it
    // produced „Das ist ein Prozessor, zum Beispiel ." which is exactly the sentence the
    // mechanism exists to prevent.
    //
    // It replaces a second TEMPLATE per case (`purpose` beside `purpose_plain`) — which is how
    // a phrase table grows: every optional half-sentence doubles the rows, and two wordings of
    // one question drift apart the first time somebody improves only one of them (§46). The
    // optionality is a property of the SENTENCE, so it lives in the sentence.
    let out = String(text).replace(/\[\[([^\]]*)\]\]/g, (_ganz, klausel) => {
      const rollen = [...String(klausel).matchAll(/\{([a-z_]+)\}/g)]
        .map((m) => m[1].replace(/^(ein|der|genitiv)_/, ''));
      const leer = rollen.some((r) => !(roles[r] && String(roles[r].label || '').trim()));
      return leer ? '' : klausel;
    });
    // A derived word that OPENS A SENTENCE is capitalised, and it is marked HERE — while the
    // placeholders are still visible — because after substitution nothing distinguishes a
    // derived article from a name that happens to stand in the same place.
    //
    // Until 2026-09-28 only the start of the whole PHRASE was covered, so „Das ist der
    // Messenger von Signal Foundation. er heißt Signal." went out with a lower-case „er": the
    // second sentence of a two-sentence phrase. Nothing errors, the sentence is otherwise
    // right, and it took a reader to see it.
    //
    // The restriction that matters is unchanged, only its scope: `{ein_|der_|genitiv_|er_}`
    // are always DERIVED words and never names, so `iPhone ist ein Gerät von Apple.` stays as
    // written instead of becoming `IPhone` — a rule that fixed one sentence by breaking
    // another. A bare `{role}` at a sentence start is left alone for that very reason.
    //
    // The `\*?` is not decoration. A phrase may open its second sentence with the italics mark
    // — „…von Apache Software Foundation.\n*{ein_part} {part} ist Teil…" — and without it the
    // mark stood between the sentence boundary and the placeholder, so the pass walked past
    // and shipped „*ein Textprogramm ist Teil eines Office-Pakets.*". The one mark a phrase may
    // carry is the one that has to be allowed through here.
    out = out.replace(/(^|[.!?]["'»]?[^\S\n]+|\n[^\S\n]*)(\*?)\{(ein|der|genitiv|er)_([a-z_]+)\}/g,
      (_all, before, mark, kind, role) =>
        `${before}${mark}{${kind[0].toUpperCase()}${kind.slice(1)}_${role}}`);

    /** @param {string} w */
    const capitalised = (w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w);

    for (const [role, v] of Object.entries(roles)) {
      const label = v.label ?? '';
      // English has no gender to store, and does not need one: its indefinite article
      // follows the SOUND of the next word. The initial letter is the usual
      // approximation and it is wrong for exactly the cases this system does not have
      // (an hour, a university) — when one turns up, that is the moment to store it,
      // not before.
      const a = v.gender ? INDEFINITE[v.gender] : (lang === 'en' && label ? (/^[aeiou]/i.test(label) ? 'an' : 'a') : '');
      const der = v.gender ? DEFINITE[v.gender] : (lang === 'en' && label ? 'the' : '');
      // English inflects neither, so the genitive placeholder renders „a word processor"
      // there — one phrase, both languages.
      const gen = v.gender ? `${GENITIVE[v.gender]} ${v.genitive || label}` : (a ? `${a} ${label}` : label);
      const es = v.gender ? PRONOUN[v.gender] : (lang === 'en' ? 'it' : '');
      out = out.split(`{${role}}`).join(label);
      out = out.split(`{der_${role}}`).join(der);
      out = out.split(`{ein_${role}}`).join(a);
      out = out.split(`{genitiv_${role}}`).join(gen);
      out = out.split(`{er_${role}}`).join(es);
      // The same four, capitalised — the marker pass above rewrote the ones that open a
      // sentence. Spelled out rather than derived with a regex, so a placeholder that is NOT
      // one of these four cannot be capitalised by accident.
      out = out.split(`{Der_${role}}`).join(capitalised(der));
      out = out.split(`{Ein_${role}}`).join(capitalised(a));
      out = out.split(`{Genitiv_${role}}`).join(capitalised(gen));
      out = out.split(`{Er_${role}}`).join(capitalised(es));
    }
    // Collapse runs of SPACES — an empty article placeholder leaves two — but never the
    // newline: a phrase uses it to put an explanatory lead-in on a line of its own, and
    // `\s` would have swallowed exactly that. Spaces hugging a newline go with it.
    out = out.replace(/[^\S\n]{2,}/g, ' ').replace(/[^\S\n]*\n[^\S\n]*/g, '\n').trim();

    return out;
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
    const exampleOf = (t) => f.products.find((x) => x.product_type_id === t.id) || { name: '' };
    /** Every product of a kind, as the list an explanation names: „Chrome, Edge, Firefox, Safari". */
    const examplesOf = (t) => f.products.filter((x) => x.product_type_id === t.id).map((x) => x.name).join(', ');
    const typed = (t) => ({ label: word(f, t, lang, 'name'), gender: gender(f, t, lang), genitive: sprachfeld(f, t, lang, 'genitive') });

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
      // Only a pair that is UNIQUE may be asked about. „Wie heißt das Textprogramm von
      // Microsoft?" has one answer today, and would have two the day a second one is
      // entered — the question would then have two right answers while `judge` names the
      // first, and a player would be told their correct answer is wrong. Nothing else in
      // the model forbids the second product, so the question has to check.
      const einmalig = f.products.filter((x) => x.manufacturer_id && x.product_type_id
        && f.products.filter((y) => y.manufacturer_id === x.manufacturer_id
          && y.product_type_id === x.product_type_id).length === 1);
      const p = any(einmalig);
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
      // Every type with a purpose, whether or not it has a product: the example clause in
      // the phrase is optional and disappears by itself where there is none.
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
        _explanation: fill(phrase.explanation, { answer: typed(t), example: named(exampleOf(t)) }, lang),
      };
    }

    if (template.key === 'what_kind') {
      // The picture IS the question, so a kind without one cannot be asked about — that is a
      // fact about the data, not an error, and the next template is tried instead.
      const t = any(f.types.filter((x) => x.icon && word(f, x, lang, 'purpose')));
      if (!t) return null;
      const wrong = sample(f.types.filter((x) => x.id !== t.id), 3);
      if (wrong.length < 2) return null;
      return {
        template: template.key, language: lang,
        subject: { kind: 'ProductType', id: t.id },
        object: null,
        image: `api/media/${t.icon}/file`,
        text: fill(phrase.text, {}, lang),
        options: [t, ...wrong].map((x) => word(f, x, lang, 'name')),
        _correct: word(f, t, lang, 'name'),
        _explanation: fill(phrase.explanation, {
          answer: typed(t),
          purpose: { label: word(f, t, lang, 'purpose') },
          examples: { label: examplesOf(t) },
        }, lang),
      };
    }

    if (template.key === 'what_is_it') {
      const p = any(f.products.filter((x) => x.icon && x.product_type_id && x.manufacturer_id));
      if (!p) return null;
      const t = typeOf(p), c = makerOf(p);
      if (!t || !c) return null;
      const wrong = sample(f.products.filter((x) => x.id !== p.id), 3);
      if (wrong.length < 2) return null;
      return {
        template: template.key, language: lang,
        subject: { kind: 'Product', id: p.id },
        object: null,
        image: `api/media/${p.icon}/file`,
        text: fill(phrase.text, {}, lang),
        options: [p, ...wrong].map((x) => x.name),
        _correct: p.name,
        _explanation: fill(phrase.explanation, { type: typed(t), maker: named(c), answer: named(p) }, lang),
      };
    }

    if (template.key === 'part_of') {
      const t = any(f.types.filter((x) => x.part_of_id && f.types.some((y) => y.id === x.part_of_id)));
      if (!t) return null;
      const ganz = f.types.find((y) => y.id === t.part_of_id);
      const wrong = sample(f.types.filter((x) => x.id !== ganz.id && x.id !== t.id), 3);
      if (wrong.length < 2) return null;
      return {
        template: template.key, language: lang,
        subject: { kind: 'ProductType', id: t.id },
        object: null,
        text: fill(phrase.text, { subject: typed(t) }, lang),
        options: [ganz, ...wrong].map((x) => word(f, x, lang, 'name')),
        _correct: word(f, ganz, lang, 'name'),
        _explanation: fill(phrase.explanation, { subject: typed(t), answer: typed(ganz) }, lang),
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

    // ── The standards, added 2026-09-28 ────────────────────────────────────────────────
    //
    // One branch serves `stands_for_*` for FOUR entities, because the question is the same
    // one — „wofür steht diese Abkürzung?" — and only the pool differs. The template row says
    // which pool through `subject_kind`, so a fifth entity that carries a `long_name` is a
    // row and not a commit, which is what the template mechanism is for (§48).
    if (String(template.key).startsWith('stands_for')) {
      const pool = abbreviated(f, template.subject_kind);
      const x = any(pool);
      if (!x) return null;
      const wrong = sample(pool.filter((y) => y.id !== x.id), 3);
      if (wrong.length < 2) return null;
      return {
        template: template.key, language: lang,
        subject: { kind: template.subject_kind, id: x.id },
        object: null,
        text: fill(phrase.text, { subject: { label: shortName(x) } }, lang),
        // The OPTIONS are long forms, so the distractors have to be long forms too — a list
        // with one sentence and three words answers itself.
        options: [x, ...wrong].map((y) => y.long_name),
        _correct: x.long_name,
        _explanation: fill(phrase.explanation,
          { subject: { label: shortName(x) }, answer: { label: x.long_name },
            purpose: { label: x.purpose } }, lang),
      };
    }

    if (template.key === 'opens_format' || template.key === 'edits_format') {
      // `edit` implies `view` (Types.md), so the OPENING question accepts an editor too while
      // the editing one does not. That implication is the reason one row per pair is enough,
      // and this is the only place it has to be spelled out.
      const editing = template.key === 'edits_format';
      const ableFor = (fmt) => f.supports.filter((s) => s.format_id === fmt.id
        && (editing ? s.support === 'edit' : true));

      // The FIRST version demanded a format with exactly one able product, borrowed from
      // `product_of_company` — and it could never fire, because every format here is opened by
      // several programs. That is not a gap in the data, it IS the subject: „womit kann man
      // eine .pdf ansehen?" has six right answers, and not knowing that is the confusion.
      //
      // So the question is built the other way round. One able product is the answer, and the
      // three distractors are drawn from the products that CANNOT open it — so the list has
      // exactly one right entry by construction, whatever the data grows into. The answer
      // travels as `object` for the verdict, which is the only thing `judge` cannot recompute:
      // it can see WHICH products are able, not which of them this question named.
      const askable = f.formats.filter((x) => ableFor(x).length >= 1
        && f.products.length - ableFor(x).length >= 3);
      const fmt = any(askable);
      if (!fmt) return null;
      const able = ableFor(fmt);
      const ableIds = new Set(able.map((s) => s.product_id));
      const right = f.products.find((x) => x.id === any(able).product_id);
      if (!right) return null;
      const wrong = sample(f.products.filter((x) => !ableIds.has(x.id)), 3);
      if (wrong.length < 3) return null;
      return {
        template: template.key, language: lang,
        subject: { kind: 'FileFormat', id: fmt.id },
        object: { kind: 'Product', id: right.id },
        text: fill(phrase.text, { subject: { label: fmt.extension } }, lang),
        options: [right, ...wrong].map((x) => x.name),
        _correct: right.name,
        _explanation: fill(phrase.explanation,
          { subject: { label: fmt.extension }, answer: { label: right.name },
            format: { label: fmt.name }, purpose: { label: fmt.purpose } }, lang),
      };
    }

    if (template.key === 'format_group') {
      const fmt = any(f.formats.filter((x) => x.group_id));
      if (!fmt) return null;
      const grp = f.groups.find((g) => g.id === fmt.group_id);
      if (!grp) return null;
      const wrong = sample(f.groups.filter((g) => g.id !== grp.id), 3);
      if (wrong.length < 2) return null;
      return {
        template: template.key, language: lang,
        subject: { kind: 'FileFormat', id: fmt.id },
        object: null,
        text: fill(phrase.text, { subject: { label: fmt.name } }, lang),
        options: [grp, ...wrong].map((g) => g.name),
        _correct: grp.name,
        _explanation: fill(phrase.explanation,
          { subject: { label: fmt.name }, answer: { label: grp.name },
            purpose: { label: grp.purpose } }, lang),
      };
    }

    if (template.key === 'concept_part_of') {
      const c = any(f.concepts.filter((x) => x.part_of_id));
      if (!c) return null;
      const whole = f.concepts.find((y) => y.id === c.part_of_id);
      if (!whole) return null;
      const wrong = sample(f.concepts.filter((y) => y.id !== whole.id && y.id !== c.id), 3);
      if (wrong.length < 2) return null;
      return {
        template: template.key, language: lang,
        subject: { kind: 'Concept', id: c.id },
        object: null,
        text: fill(phrase.text, { subject: { label: c.name } }, lang),
        options: [whole, ...wrong].map((y) => y.name),
        _correct: whole.name,
        _explanation: fill(phrase.explanation,
          { subject: { label: c.name }, answer: { label: whole.name },
            example: { label: whole.example || '' } }, lang),
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

  /**
   * Everything both the verdict and the recording need: the template, the truth recomputed
   * from the facts, and how the pick compares to it.
   *
   * One function because the POST must not believe what the GET told the page — it derives
   * the quality itself from the same records. Two copies of that derivation would be two
   * answers to one question, and they would drift (§17).
   *
   * @param {any} payload - `{ template, language, subject, object, chosen }`, from a body or a query
   * @returns {Promise<{error?: string, status?: number, template?: any, truth?: any, quality?: string}>}
   */
  async function assess(payload) {
    const { template: key, language, subject, object, chosen } = payload || {};
    const f = await facts();
    const template = f.templates.find((t) => t.key === key);
    if (!template) return { status: 400, error: `unknown template ${key}` };

    const truth = judge(f, template, language, subject, object);
    if (!truth) return { status: 400, error: 'the question no longer matches the facts' };

    const quality = chosen == null ? 'skipped' : (chosen === truth.correct ? 'correct' : 'wrong');
    return { template, truth, quality };
  }

  /** The two records a question was about, as the log's polymorphic columns spell them. */
  function roleColumns(subject, object) {
    const col = (role, r) => (r ? { Product: `${role}_product_id`, ProductType: `${role}_product_type_id`, Company: `${role}_company_id` }[r.kind] : null);
    const out = {};
    if (subject) out[col('subject', subject)] = subject.id;
    if (object) out[col('object', object)] = object.id;
    return out;
  }

  // ── The verdict: a READ, so it survives a read-only session ────────────────
  //
  // Query parameters rather than a body, because that is what a GET carries. `subject` and
  // `object` travel as JSON in one parameter each — they are the records the question was
  // about, and spelling them out as `subject_kind` + `subject_id` would invent a second
  // vocabulary for something the question endpoint already returns in one piece.
  app.get('/api/sys/itquiz/verdict',
    authMiddleware, requireEntityVerb('ProductType', 'r'),
    async (req, res) => {
      try {
        const parse = (v) => (v ? JSON.parse(String(v)) : null);
        const r = await assess({
          template: req.query.template,
          language: req.query.language,
          subject: parse(req.query.subject),
          object: parse(req.query.object),
          chosen: req.query.chosen == null ? null : String(req.query.chosen),
        });
        if (r.error) return res.status(r.status || 400).json({ error: r.error });
        return res.json({
          quality: r.quality,
          correct: r.truth.correct,
          explanation: r.truth.explanation,
          image: r.truth.image || null,
          // `{lang, title}`, never a URL — the client hands both to the framework's
          // `wikipediaRef`, which is the one thing that knows how an article is addressed.
          article: r.truth.article || null,
          // `{kind, id}`, and for the same reason: RAP owns the `?crumbs=` format, so the
          // quiz names the RECORD and the page builds the link from it.
          focus: r.truth.focus || null,
          // Every record the sentence names, so an open linked view can follow the
          // answer without anything being pressed (aide-rap#504). `focus` is its first.
          mentions: r.truth.mentions || [],
        });
      } catch (err) {
        theLogger.error('itquiz: verdict failed', { error: err.message });
        return res.status(500).json({ error: err.message });
      }
    });

  // ── The recording ─────────────────────────────────────────────────────────
  app.post('/api/sys/itquiz/answer',
    authMiddleware, requireEntityVerb('ProductType', 'r'),
    async (req, res) => {
      try {
        const username = req.user && req.user.username;
        // The owner comes from the signed session cookie. Nothing in the body
        // can reach it, and an unauthenticated write is a bug, not a guest.
        if (!username) return res.status(403).json({ error: 'not signed in' });

        const { language, subject, object, chosen } = req.body || {};
        const r = await assess(req.body);
        if (r.error) return res.status(r.status || 400).json({ error: r.error });
        const { template, truth, quality } = r;

        const row = {
          user: username,
          template_id: template.id,
          language,
          asked_at: nowTs(),
          quality,
          given_answer: chosen == null ? null : String(chosen),
          ...roleColumns(subject, object),
        };

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

        return res.json({ recorded: true, quality, correct: truth.correct, explanation: truth.explanation });
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
    const typed = (t) => ({ label: word(f, t, lang, 'name'), gender: gender(f, t, lang), genitive: sprachfeld(f, t, lang, 'genitive') });

    if (template.key === 'manufacturer') {
      const p = prod(subject && subject.id); if (!p) return null;
      const c = comp(p.manufacturer_id); if (!c) return null;
      const own = type(p.product_type_id); if (!own) return null;
      return {
        correct: c.name,
        // Everything the sentence names -- Edge, its kind, its maker -- in the order a
        // reader meets them. The list drives four things now (see `context`), so a record
        // left out here is one an open linked view will not follow.
        ...context([['Company', c], ['Product', p], ['ProductType', own]], lang),
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
        ...context([['Product', p], ['ProductType', t], ['Company', c]], lang),
        explanation: fill(phrase.explanation,
          { subject: { label: c.name }, object: typed(t), answer: { label: p.name }, purpose: { label: word(f, t, lang, 'purpose') } }, lang),
      };
    }
    if (template.key === 'purpose') {
      const t = type(subject && subject.id); if (!t) return null;
      const beispiel = f.products.find((x) => x.product_type_id === t.id);
      return {
        correct: word(f, t, lang, 'name'),
        ...context([['ProductType', t], ['Product', beispiel]], lang),
        explanation: fill(phrase.explanation,
          { answer: typed(t), example: { label: (beispiel && beispiel.name) || '' } }, lang),
      };
    }
    // `what_kind` and `what_is_it` deliberately carry NO image: there the picture IS the
    // question, and showing it again under the answer would say nothing and take the room of
    // something that does. The LINK still belongs — the reader has just learnt a word and the
    // article is where they read on — which is why the two travel as separate fields.
    if (template.key === 'what_kind') {
      const t = type(subject && subject.id); if (!t) return null;
      return {
        correct: word(f, t, lang, 'name'),
        // No picture — the picture WAS the question — but `context` supplies one anyway and
        // the caller below drops it. Keeping the three together is worth more than saving a
        // string, because the next template gets all three by writing one line.
        ...context([['ProductType', t]], lang),
        image: null,
        explanation: fill(phrase.explanation, {
          answer: typed(t),
          purpose: { label: word(f, t, lang, 'purpose') },
          examples: { label: f.products.filter((x) => x.product_type_id === t.id).map((x) => x.name).join(', ') },
        }, lang),
      };
    }
    if (template.key === 'what_is_it') {
      const p = prod(subject && subject.id); if (!p) return null;
      const t = type(p.product_type_id), c = comp(p.manufacturer_id);
      if (!t || !c) return null;
      return {
        correct: p.name,
        ...context([['Product', p], ['ProductType', t], ['Company', c]], lang),
        image: null,
        explanation: fill(phrase.explanation,
          { type: typed(t), maker: { label: c.name }, answer: { label: p.name } }, lang),
      };
    }
    if (template.key === 'part_of') {
      const t = type(subject && subject.id); if (!t) return null;
      const ganz = f.types.find((y) => y.id === t.part_of_id); if (!ganz) return null;
      return {
        correct: word(f, ganz, lang, 'name'),
        ...context([['ProductType', ganz], ['ProductType', t]], lang),
        explanation: fill(phrase.explanation, { subject: typed(t), answer: typed(ganz) }, lang),
      };
    }
    if (template.key === 'is_a') {
      const p = prod(subject && subject.id), asked = type(object && object.id);
      if (!p || !asked) return null;
      const own = type(p.product_type_id); if (!own) return null;
      const yes = lang === 'de' ? 'Ja' : 'Yes';
      const no = lang === 'de' ? 'Nein' : 'No';
      const maker = comp(p.manufacturer_id);
      // WHY the answer is no, where the model already knows.
      //
      // „Ist Apache OpenOffice ein Textprogramm?" — no, it is an office suite. Correct, and
      // it leaves the reader exactly where their confusion was: the two ARE related, and the
      // relation is the thing worth learning. `part_of` already holds it, so the sentence can
      // be derived rather than written: one of the two types is part of the other.
      //
      // Both directions, and it is the same sentence either way. Asked „Textprogramm" about an
      // office suite, or „Office-Paket" about a word processor — „Ein Textprogramm ist Teil
      // eines Office-Pakets" is the answer to both, because the relation is the fact and the
      // question only chose which end to enter it from.
      //
      // On a YES the two types are the same one, so no pair exists and the clause removes
      // itself — the rule needs no test for the verdict it belongs to. Likewise where the two
      // are simply unrelated („Ist Chrome ein Speichermedium?"), which is most of the time:
      // there is nothing true to add and the explanation stays as it was.
      const whole = own.part_of_id === asked.id ? asked
        : asked.part_of_id === own.id ? own : null;
      const part = whole ? (whole.id === asked.id ? own : asked) : null;
      // SIBLINGS — the other shape the same „no" can have, and the commoner one.
      //
      // „Ist OpenOffice Calc ein Textprogramm?" — no, it is a spreadsheet. Neither is part of
      // the other, so the rule above stays silent, and yet the reader is standing in front of
      // exactly the relation that would settle it: both are parts of the same whole. The model
      // holds that too; it simply holds it as a shared parent rather than as a link between
      // the two.
      //
      // Mutually exclusive with the pair above — a type cannot both contain another and stand
      // beside it under a third — so the two clauses never fire together and neither needs to
      // know about the other.
      //
      // The `own.id !== asked.id` is the one that is easy to leave out, and it was: on a YES
      // the two types are the SAME type, which is trivially its own sibling, and the sentence
      // came out as „Ein Textprogramm und ein Textprogramm sind beide Teil eines
      // Office-Pakets." Every clause here has to earn its place on a NO as well as a yes, and
      // the part/whole rule gets this for free (a thing is not part of itself) while this one
      // has to say so.
      const shared = !whole && own.id !== asked.id
        && own.part_of_id && own.part_of_id === asked.part_of_id
        ? type(own.part_of_id) : null;
      return {
        correct: asked.id === own.id ? yes : no,
        // „Yes" has no face, so the subject leads — the thing the sentence is about. The
        // rule everywhere here is the same one: offer what the explanation TALKS about, which
        // for a yes/no question is not the answer.
        ...context([['Product', p], ['ProductType', own], ['ProductType', asked],
          ['Company', maker]], lang),
        explanation: fill(phrase.explanation, {
          subject: { label: p.name },
          answer: typed(own),
          maker: { label: (maker && maker.name) || '' },
          // The asked type under the question's own name for it, so a phrase can talk about
          // the thing the reader named without a second vocabulary for it.
          object: typed(asked),
          part: part ? typed(part) : { label: '' },
          whole: whole ? typed(whole) : { label: '' },
          shared: shared ? typed(shared) : { label: '' },
        }, lang),
      };
    }

    // ── The standards ────────────────────────────────────────────────────────────────────
    //
    // Recomputed from the subject, like every other branch here, so nothing has to be
    // remembered between the question and the verdict.
    if (String(template.key).startsWith('stands_for')) {
      const x = abbreviated(f, template.subject_kind).find((y) => y.id === (subject && subject.id));
      if (!x) return null;
      return {
        correct: x.long_name,
        ...context([[template.subject_kind, x]], lang),
        explanation: fill(phrase.explanation,
          { subject: { label: shortName(x) }, answer: { label: x.long_name },
            purpose: { label: x.purpose } }, lang),
      };
    }

    if (template.key === 'opens_format' || template.key === 'edits_format') {
      const fmt = f.formats.find((x) => x.id === (subject && subject.id));
      if (!fmt) return null;
      const editing = template.key === 'edits_format';
      // The same implication as in `build`: an editor also opens. Spelled the same way in both
      // places deliberately — the day it changes, a reader who finds one finds the other.
      const able = f.supports.filter((s) => s.format_id === fmt.id
        && (editing ? s.support === 'edit' : true));
      // The answer the QUESTION named, not merely an able one: several products open a .pdf
      // and only one of them was in the list. It still has to be able — `object` arrives from
      // the client, so it is checked rather than trusted.
      const named = object && able.some((s) => s.product_id === object.id)
        ? f.products.find((x) => x.id === object.id) : null;
      const right = named || (able.length ? f.products.find((x) => x.id === able[0].product_id) : null);
      if (!right) return null;
      return {
        correct: right.name,
        ...context([['Product', right], ['FileFormat', fmt]], lang),
        explanation: fill(phrase.explanation,
          { subject: { label: fmt.extension }, answer: { label: right.name },
            format: { label: fmt.name }, purpose: { label: fmt.purpose } }, lang),
      };
    }

    if (template.key === 'format_group') {
      const fmt = f.formats.find((x) => x.id === (subject && subject.id));
      if (!fmt) return null;
      const grp = f.groups.find((g) => g.id === fmt.group_id);
      if (!grp) return null;
      return {
        correct: grp.name,
        ...context([['FileFormat', fmt], ['FormatGroup', grp]], lang),
        explanation: fill(phrase.explanation,
          { subject: { label: fmt.name }, answer: { label: grp.name },
            purpose: { label: grp.purpose } }, lang),
      };
    }

    if (template.key === 'concept_part_of') {
      const c = f.concepts.find((x) => x.id === (subject && subject.id));
      if (!c) return null;
      const whole = f.concepts.find((y) => y.id === c.part_of_id);
      if (!whole) return null;
      return {
        correct: whole.name,
        ...context([['Concept', whole], ['Concept', c]], lang),
        explanation: fill(phrase.explanation,
          { subject: { label: c.name }, answer: { label: whole.name },
            example: { label: whole.example || '' } }, lang),
      };
    }

    return null;
  }

  theLogger.info('itquiz routes registered', { routes: ['GET /api/sys/itquiz/question', 'GET /api/sys/itquiz/verdict', 'POST /api/sys/itquiz/answer'] });
};
