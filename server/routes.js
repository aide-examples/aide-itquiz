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
// The NEGATED article, added 2026-09-29 for the corrections a four-claims question gives. German
// negates a noun with a word rather than a particle — „EPUB ist KEINE Auszeichnungssprache", not
// „ist eine Auszeichnungssprache nicht" — so a correction that avoided it would be schoolroom
// German at the exact moment the reader is being taught something. Same shape as INDEFINITE, and
// derived from the same one stored gender, so the three cannot disagree about a noun.
const NEGATED = { m: 'kein', f: 'keine', n: 'kein' };
// German genitive article. The part-of sentence wants „Teil EINES Office-Pakets", and the
// case cannot be avoided by rewording without making the sentence worse. The ARTICLE derives
// from the gender like the other two; the noun's own ending does NOT — it follows a rule with
// exceptions, so it is stored on the translation row (`Translation.genitive`) rather than
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
   * @param {string} lang - the language asked in; the short form is read in it
   * @returns {any[]} the records of that kind that carry a long form
   */
  function abbreviated(f, kind, lang) {
    const pools = {
      FileFormat: f.formats, Protocol: f.protocols,
      Connector: f.connectors, Concept: f.concepts, StorageMedium: f.storages,
    };
    // The long form must be DIFFERENT from the short one, and that second condition is not
    // pedantry: `Bluetooth` was seeded with `long_name: "Bluetooth"` — it abbreviates nothing —
    // and the generator dutifully produced „Wofür steht die Abkürzung Bluetooth? — Bluetooth
    // steht für ‚Bluetooth'." A question that answers itself, built from data that was not
    // wrong, only unsuitable. The seed is fixed; this is what stops the next author doing it
    // again, because nothing else would have noticed.
    return (pools[kind] || []).filter((x) => x.long_name
      && String(x.long_name).trim().toLowerCase() !== String(shortName(f, kind, x, lang)).trim().toLowerCase());
  }

  /**
   * What to SHOW as the abbreviation of such a record.
   *
   * A format, a protocol and a connector are called by their short form already — `name` IS
   * „DOCX". A concept is not: its name is „Top-level domain" and the abbreviation people meet
   * is „TLD", which is why that entity carries both. Asking „wofür steht Top-level domain?"
   * would answer itself.
   *
   * IT TAKES A LANGUAGE, and for four of the five pools that changes nothing — `PDF`, `HTTP` and
   * `HDMI` are the same word everywhere, which is why the first version did without one. A
   * storage medium is where it shows: „SD card" and „Floppy disk" are English, and the question
   * asked about them by those names in the middle of a German sentence.
   *
   * @param {any} f - the facts
   * @param {string} kind - an `EntityKind` value
   * @param {any} record - a row from `abbreviated`
   * @param {string} lang
   * @returns {string}
   */
  function shortName(f, kind, record, lang) {
    return record.abbreviation || word(f, kind, record, lang, 'name');
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
    const [types, translations, products, companies, templates, phrases,
      formats, groups, productGroups, protocols, connectors, concepts, supports, storages] = await Promise.all([
      // `group_id` beside `part_of_id`: BOTH relations are read, because a player meets both (#7).
      // Leaving it out is the third instance in this system of one silent class — a column the
      // builder filters on and the query does not fetch. It does not error; the question type
      // simply never fires, and 500 draws came back without a single one before this line was
      // corrected.
      eng.query('SELECT id, name, purpose, part_of_id, group_id, icon, wikipedia_de, wikipedia_en, level FROM product_type WHERE id > 1'),
      // ONE translation table for all seven translated entities, a polymorphic reference:
      // `subject_entity` names the kind and `subject_id` the row, declared as one `[POLY_FK=…]`
      // pair. Read whole like everything else here, and indexed in `translationOf()` rather than
      // queried per lookup.
      //
      // EVERY column of it, and that is not laziness. This list has silently dropped a column
      // once already — `storage_medium_id`, back when the table had one FK per kind — and the
      // symptom was that every German wording fell back to English, including the gender the
      // articles are derived from. Nothing errored; the quiz simply spoke the wrong language.
      eng.query('SELECT subject_entity, subject_id, language, name, purpose, gender, article, '
        + 'genitive, looks_like, note FROM translation WHERE id > 1'),
      eng.query('SELECT id, name, product_type_id, manufacturer_id, icon, wikipedia_de, wikipedia_en, level FROM product WHERE id > 1'),
      eng.query('SELECT id, name, logo, wikipedia_de, wikipedia_en, level FROM company WHERE id > 1'),
      eng.query('SELECT id, key, kind, subject_kind, object_kind, answer_kind FROM question_template WHERE id > 1'),
      eng.query('SELECT template_id, language, text, explanation FROM question_phrase WHERE id > 1'),
      // The standards and the notions, added 2026-09-28. Each is small and read whole, for the
      // same reason the first four are: a quiz that grew to thousands of rows would want a
      // different picker anyway, not a cached one.
      eng.query('SELECT id, name, extension, long_name, group_id, purpose, icon, wikipedia_de, wikipedia_en, level FROM file_format WHERE id > 1'),
      eng.query('SELECT id, name, purpose, wikipedia_de, wikipedia_en, level FROM format_group WHERE id > 1'),
      eng.query('SELECT id, name, purpose, note, wikipedia_de, wikipedia_en, level FROM product_group WHERE id > 1'),
      eng.query('SELECT id, name, long_name, purpose, wikipedia_de, wikipedia_en, level FROM protocol WHERE id > 1'),
      eng.query('SELECT id, name, long_name, purpose, looks_like, icon, wikipedia_de, wikipedia_en, level FROM connector WHERE id > 1'),
      eng.query('SELECT id, name, abbreviation, long_name, purpose, example, part_of_id, wikipedia_de, wikipedia_en, level FROM concept WHERE id > 1'),
      eng.query('SELECT product_id, format_id, support FROM format_support WHERE id > 1'),
      eng.query('SELECT id, name, long_name, purpose, looks_like, capacity_mb, rewritable, icon, '
        + 'level, wikipedia_de, wikipedia_en, note FROM storage_medium WHERE id > 1'),
    ]);
    return { types, translations, products, companies, templates, phrases,
      formats, groups, productGroups, protocols, connectors, concepts, supports, storages };
  }

  /**
   * The levels, in order. The order IS the comparison — `LEVELS.indexOf` is how a ceiling is
   * checked — and it must match the row order of the `Level` enum in Types.md, because that is
   * what RAP sorts the enum by. Two orders for one idea would disagree the first time a fourth
   * level was inserted anywhere but at the end.
   */
  const LEVELS = ['basic', 'advanced', 'expert'];

  /**
   * How far into the subject a record sits — `basic` for anything unsaid.
   *
   * Absent means basic, and that is the DECLARED default rather than a guess: the attribute
   * carries `"default":"basic"`, so the seed marks only what is not everyday and a record nobody
   * has thought about is met by a beginner. The safe direction is the free one.
   *
   * @param {any} record
   * @returns {string}
   */
  function levelOf(record) {
    const v = record && record.level;
    return LEVELS.includes(v) ? v : 'basic';
  }

  /**
   * Is a question built from these records within a player's ceiling?
   *
   * THE HIGHEST RECORD WINS, which is the whole rule: a question is as hard as the hardest thing
   * it names. „Wofür steht PDF?" and „Wofür steht SIP?" come from one template and are not the
   * same question, and no amount of levelling the templates would have said so.
   *
   * A CEILING and not a band. Somebody who picks `expert` still meets Browser and DVD — a quiz
   * that asked only hard questions would teach nothing about how the easy and the hard connect,
   * which for this subject matter is most of the point.
   *
   * @param {string} ceiling - the player's chosen level
   * @param {...any} records - every record the question names; nulls are ignored
   * @returns {boolean}
   */
  function withinLevel(ceiling, ...records) {
    const max = Math.max(0, ...records.filter(Boolean).map((r) => LEVELS.indexOf(levelOf(r))));
    return max <= LEVELS.indexOf(LEVELS.includes(ceiling) ? ceiling : 'basic');
  }

  /**
   * The kinds that can carry a translation.
   *
   * A LIST AND NO LONGER A MAP (#1). It used to pair each kind with its own column —
   * `ProductType: 'product_type_id'` and six siblings — because the table had seven optional
   * foreign keys. It now has one polymorphic pair, so the kind IS the value stored, and what is
   * left here is the set of kinds that may appear: a guard against a lookup for something that
   * was never translated, not a translation table of its own.
   *
   * An eighth translated entity is now a ROW rather than a column, a constraint member, a
   * detector entry and a line here. That was the argument for the change and this list is what
   * is left of the sweep.
   */
  const TRANSLATED_KINDS = new Set([
    'ProductType', 'FileFormat', 'FormatGroup', 'Protocol', 'Connector', 'Concept', 'StorageMedium',
    'ProductGroup',
  ]);

  /**
   * The translation row for one record in one language, or null.
   *
   * Looked up in an index built once per question rather than by scanning: with six kinds in one
   * table a linear `find` per placeholder is a scan per word, and a question fills a dozen.
   *
   * @param {any} f - the facts
   * @param {string} kind - an `EntityKind` value that has translations
   * @param {any} record - the row of that kind
   * @param {string} lang
   * @returns {any|null}
   */
  function translationOf(f, kind, record, lang) {
    if (!f._byTranslationKey) {
      f._byTranslationKey = new Map();
      for (const t of f.translations) {
        if (t.subject_entity && t.subject_id) {
          f._byTranslationKey.set(`${t.subject_entity}/${t.subject_id}/${t.language}`, t);
        }
      }
    }
    if (!record || !TRANSLATED_KINDS.has(kind)) return null;
    return f._byTranslationKey.get(`${kind}/${record.id}/${lang}`) || null;
  }

  /**
   * A field of a record in the reader's language, falling back to the record itself.
   *
   * `name`, `purpose` and `note` exist on both sides, so a missing translation is not an error:
   * it means the English term is used in that language too, which is true of a good many IT
   * words — „Browser", „Router", „PDF". The reader gets the English word, correctly, because
   * nobody translates it either.
   *
   * @param {any} f @param {string} kind @param {any} record @param {string} lang
   * @param {string} field
   * @returns {any}
   */
  function word(f, kind, record, lang, field) {
    const t = translationOf(f, kind, record, lang);
    return (t && t[field]) || (record && record[field]);
  }

  /**
   * A field that exists ONLY on the translation row — gender, genitive.
   *
   * Unlike `word()` there is nothing to fall back to: the English row has no grammatical gender
   * to lend, and a missing value means „this language does not inflect that", not „look
   * upstairs". Which is also why an absent genitive is correct for every feminine German noun
   * and for all of English.
   *
   * @param {any} f @param {string} kind @param {any} record @param {string} lang
   * @param {string} field
   * @returns {string|null}
   */
  function grammar(f, kind, record, lang, field) {
    const t = translationOf(f, kind, record, lang);
    return (t && t[field]) || null;
  }

  /**
   * A record as a filled ROLE: its word in the reader's language plus the grammar a sentence
   * about it needs. What `fill()` wants for `{role}`, `{der_role}`, `{ein_role}`,
   * `{genitiv_role}` and `{er_role}`.
   *
   * One function for all six kinds. Before the translations were consolidated this existed
   * twice, hard-wired to `ProductType`, in the two halves of this file — which is exactly how a
   * German question ended up carrying an English explanation for the five kinds that had no
   * translation table of their own.
   *
   * @param {any} f @param {string} kind @param {any} record @param {string} lang
   * @returns {{label: string, gender: string|null, article: string|null, genitive: string|null}}
   */
  function said(f, kind, record, lang) {
    return {
      label: word(f, kind, record, lang, 'name') || '',
      gender: grammar(f, kind, record, lang, 'gender'),
      article: grammar(f, kind, record, lang, 'article'),
      genitive: grammar(f, kind, record, lang, 'genitive'),
    };
  }

  /**
   * The facts as a player at one level may meet them.
   *
   * FILTERED BEFORE THE QUESTION IS BUILT, not after it, and that is the difference between two
   * quite different features. Checking afterwards would keep an expert term out of the ANSWER
   * and let it stand in the OPTIONS — and a beginner asked to choose between Browser, Spider,
   * Socket and SIP has already been told the subject is not for them, whichever one is right.
   *
   * It also means no branch knows about levels. Twenty of them build questions out of these
   * pools; none had to learn a new rule, and the twenty-first will not either (§17).
   *
   * The three tables that are NOT filtered are the ones that are not subject matter: the
   * translations, the templates and their phrases, and `format_support`, which is a relation
   * between two records that are themselves filtered.
   *
   * @param {any} f - the facts
   * @param {string} ceiling - the player's chosen level
   * @returns {any} the same shape, with every askable pool narrowed
   */
  function narrow(f, ceiling) {
    const keep = (rows) => (rows || []).filter((r) => withinLevel(ceiling, r));
    return {
      ...f,
      types: keep(f.types),
      products: keep(f.products),
      companies: keep(f.companies),
      formats: keep(f.formats),
      groups: keep(f.groups),
      productGroups: keep(f.productGroups),
      protocols: keep(f.protocols),
      connectors: keep(f.connectors),
      concepts: keep(f.concepts),
      storages: keep(f.storages),
      // The index is rebuilt lazily by `translationOf`, and it must not travel from the unnarrowed
      // copy — it is keyed by record id, so it would still be correct, but sharing a mutable cache
      // between two views of the facts is the kind of thing that is correct until it is not.
      _byTranslationKey: undefined,
    };
  }

  /**
   * The five shapes a claim about a file format can take.
   *
   * Each is a pair: what makes it TRUE, and which record it names. The claim itself travels as
   * `{c, p}` — a shape and a partner id — and never as a sentence or a truth value, which is the
   * whole design of this question type.
   *
   * WHY THE CLAIM AND NOT ITS TRUTH TRAVELS. Every other template here lets `judge` recompute the
   * answer from `subject` and `object`, so the POST never has to believe what the GET said. Four
   * statements cannot be recomputed from a subject alone — which four were shown is a choice made
   * at build time. So the choice travels and the TRUTH is still computed server-side, from the
   * facts, on both paths. A client can misreport which claims it was shown; it cannot make a
   * false one true.
   *
   * Note `ext` and `stands` take a FORMAT as their partner rather than a string: the claim is
   * then „this format's ending" and the truth is a comparison of ids. A string partner would put
   * the answer in the claim and make the judge compare prose.
   */
  const CLAIM_SHAPES = {
    // `p` is a FormatGroup — true when it is the format's own group.
    group: {
      partner: (f) => f.groups,
      truth: (f, fmt, p) => fmt.group_id === p.id,
      label: (f, p, lang) => word(f, 'FormatGroup', p, lang, 'name'),
      // A group is a GENDERED noun in German — „ein Bildformat" but „eine Auszeichnungssprache" —
      // so the claim sentence asks for `{ein_answer}` and this hands it the gender. The first
      // version wrote „ein" into the phrase and produced „EPUB ist ein Auszeichnungssprache":
      // the same mistake `format_group` made, one question type later, because the article was
      // in the sentence instead of in the model (§48).
      role: (f, p, lang) => said(f, 'FormatGroup', p, lang),
      actual: (f, fmt, lang) => {
        const g = f.groups.find((x) => x.id === fmt.group_id);
        return g ? word(f, 'FormatGroup', g, lang, 'name') : '';
      },
    },
    // `p` is a FileFormat — the claim is „it ends in THAT format's extension".
    ext: {
      partner: (f) => f.formats.filter((x) => x.extension),
      truth: (f, fmt, p) => fmt.id === p.id,
      label: (f, p) => p.extension,
      actual: (f, fmt) => fmt.extension || '',
    },
    // `p` is a Product — true when some support row exists at all.
    opens: {
      partner: (f) => f.products,
      truth: (f, fmt, p) => f.supports.some((s) => s.format_id === fmt.id && s.product_id === p.id),
      label: (f, p) => p.name,
      // One program that CAN — naming a single example teaches more than „some program can",
      // and the phrase drops the clause when the inventory has none.
      actual: (f, fmt) => {
        const s = f.supports.find((x) => x.format_id === fmt.id);
        const p = s && f.products.find((x) => x.id === s.product_id);
        return p ? p.name : '';
      },
    },
    // `p` is a Product — true only for `edit`, the narrower half of the pair.
    edits: {
      partner: (f) => f.products,
      truth: (f, fmt, p) => f.supports.some((s) => s.format_id === fmt.id && s.product_id === p.id
        && s.support === 'edit'),
      label: (f, p) => p.name,
      actual: (f, fmt) => {
        const s = f.supports.find((x) => x.format_id === fmt.id && x.support === 'edit');
        const p = s && f.products.find((x) => x.id === s.product_id);
        return p ? p.name : '';
      },
    },
    // `p` is a FileFormat — the claim is „it stands for THAT format's long name".
    stands: {
      partner: (f) => f.formats.filter((x) => x.long_name),
      truth: (f, fmt, p) => fmt.id === p.id,
      label: (f, p) => p.long_name,
      actual: (f, fmt) => fmt.long_name || '',
    },
  };

  /**
   * Is one claim true of one format? Computed from the facts, never read off the claim.
   *
   * @param {any} f @param {any} fmt - the subject @param {{c: string, p: number}} claim
   * @returns {boolean}
   */
  function claimTruth(f, fmt, claim) {
    const shape = CLAIM_SHAPES[claim && claim.c];
    if (!shape) return false;
    const p = shape.partner(f).find((x) => x.id === claim.p);
    return p ? !!shape.truth(f, fmt, p) : false;
  }

  /**
   * One claim as a sentence in the reader's language.
   *
   * The wording comes from `QuestionPhrase`, under the template key `claim_<shape>`, so it can be
   * corrected without a commit — which for a teaching system is the difference between a phrasing
   * that gets fixed and one that does not. A missing phrase yields the empty string rather than a
   * broken sentence, and the caller drops the claim.
   *
   * @param {any} f @param {any} fmt @param {{c: string, p: number}} claim @param {string} lang
   * @returns {string}
   */
  function claimText(f, fmt, claim, lang, correcting = false) {
    const shape = CLAIM_SHAPES[claim && claim.c];
    const tpl = f.templates.find((t) => t.key === `claim_${claim && claim.c}`);
    const phrase = tpl && f.phrases.find((x) => x.template_id === tpl.id && x.language === lang);
    if (!shape || !phrase) return '';
    const p = shape.partner(f).find((x) => x.id === claim.p);
    if (!p) return '';
    // The phrase's `text` is the claim; its `explanation` is what is TRUE instead. Two sentences
    // in one row, because they are two readings of one fact and separating them into two rows
    // would let a correction drift away from the claim it corrects (§46).
    const frame = correcting ? (phrase.explanation || '') : phrase.text;
    if (!frame) return '';
    // `role` where the noun needs grammar, a bare label otherwise. A shape that supplies one
    // gets `{ein_answer}` and `{der_answer}` for free; the rest never use them.
    const answer = shape.role ? shape.role(f, p, lang) : { label: shape.label(f, p, lang) || '' };
    const actualLabel = (shape.actual && shape.actual(f, fmt, lang)) || '';
    // The correction names the TRUE counterpart, which needs the same grammar as the claim.
    const actualRecord = shape.role && shape.partner(f).find((x) => (shape.label(f, x, lang) || '') === actualLabel);
    // `said` and not a bare label, because the English claim frames say „{ein_subject} {subject}
    // file" and that article belongs to the FORMAT rather than to the noun after it: „an MP3
    // file", „a JSON file". German does the opposite and must not be changed to match — „eine
    // MP3-Datei" agrees with *Datei*, which is feminine whatever the format is called, so its
    // article is rightly written into the phrase.
    return fill(frame, {
      subject: said(f, 'FileFormat', fmt, lang),
      answer,
      actual: actualRecord ? shape.role(f, actualRecord, lang) : { label: actualLabel },
    }, lang);
  }

  /**
   * Four claims about one format — a mix of true and false, in random order.
   *
   * ONE TRUE AND ONE FALSE VARIANT PER SHAPE is offered to the draw, so the four can come out at
   * any count from zero to four. The architect chose not to tell the player the count, and both
   * extremes stay possible on purpose: they are the most surprising cases and therefore the ones
   * worth meeting.
   *
   * @param {any} f @param {any} fmt @param {string} lang
   * @returns {Array<{c: string, p: number}>} four claims, or fewer than four when the inventory
   *   cannot supply them — the caller then gives up on this format
   */
  function claimsFor(f, fmt, lang) {
    const pool = [];
    for (const [c, shape] of Object.entries(CLAIM_SHAPES)) {
      const partners = shape.partner(f);
      const yes = partners.filter((p) => shape.truth(f, fmt, p));
      const no = partners.filter((p) => !shape.truth(f, fmt, p));
      // One of each where both exist. A shape with no true partner still contributes a false
      // claim, and one with no false partner a true one — neither is a defect, it is what the
      // inventory says about this format.
      if (yes.length) pool.push({ c, p: any(yes).id });
      if (no.length) pool.push({ c, p: any(no).id });
    }
    return sample(pool.filter((cl) => claimText(f, fmt, cl, lang)), 4);
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
    // It replaces a second TEMPLATE for the same question — which is how a phrase table grows:
    // every optional half-sentence doubles the rows, and two wordings of one question drift apart
    // the first time somebody improves only one of them (§46). The optionality is a property of
    // the SENTENCE, so it lives in the sentence.
    let out = String(text).replace(/\[\[([^\]]*)\]\]/g, (_whole, clause) => {
      const named = [...String(clause).matchAll(/\{([a-z_]+)\}/g)]
        .map((m) => m[1].replace(/^(ein|der|genitiv)_/, ''));
      const empty = named.some((r) => !(roles[r] && String(roles[r].label || '').trim()));
      return empty ? '' : clause;
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
    out = out.replace(/(^|[.!?]["'»]?[^\S\n]+|\n[^\S\n]*)(\*?)\{(ein|kein|der|genitiv|er)_([a-z_]+)\}/g,
      (_all, before, mark, kind, role) =>
        `${before}${mark}{${kind[0].toUpperCase()}${kind.slice(1)}_${role}}`);

    /** @param {string} w */
    const capitalised = (w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : w);

    for (const [role, v] of Object.entries(roles)) {
      const label = v.label ?? '';
      // English has no gender, and its indefinite article follows the SOUND of the next word
      // rather than its spelling. The initial letter is the usual approximation; it said „A XML
      // file" and „an USB stick" (#6), because an initialism read letter by letter takes its
      // article from the LETTER'S NAME — ex, em, ess, aitch all open with a vowel; you does not.
      //
      // So the stored value wins where there is one, and the approximation stays for everything
      // else. GENDER still wins over both: German derives „der" and „ein" from that one value, so
      // a stored article there could disagree with the definite one about the same word.
      const a = v.gender ? INDEFINITE[v.gender]
        : (v.article || (lang === 'en' && label ? (/^[aeiou]/i.test(label) ? 'an' : 'a') : ''));
      const der = v.gender ? DEFINITE[v.gender] : (lang === 'en' && label ? 'the' : '');
      // English inflects neither, so the genitive placeholder renders „a word processor"
      // there — one phrase, both languages.
      const gen = v.gender ? `${GENITIVE[v.gender]} ${v.genitive || label}` : (a ? `${a} ${label}` : label);
      const es = v.gender ? PRONOUN[v.gender] : (lang === 'en' ? 'it' : '');
      // English negates with a particle in the verb („is not a …"), so the negated article is
      // the plain one there and the phrase carries the „not" itself.
      const kein = v.gender ? NEGATED[v.gender] : (lang === 'en' && label ? a : '');
      out = out.split(`{${role}}`).join(label);
      out = out.split(`{der_${role}}`).join(der);
      out = out.split(`{ein_${role}}`).join(a);
      out = out.split(`{kein_${role}}`).join(kein);
      out = out.split(`{genitiv_${role}}`).join(gen);
      out = out.split(`{er_${role}}`).join(es);
      // The same four, capitalised — the marker pass above rewrote the ones that open a
      // sentence. Spelled out rather than derived with a regex, so a placeholder that is NOT
      // one of these four cannot be capitalised by accident.
      out = out.split(`{Kein_${role}}`).join(capitalised(kein));
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
   * A capacity as a person would say it — „700 MB", „4,7 GB", „2 TB".
   *
   * DERIVED and never stored beside the number, because a stored display form is a second
   * source for one fact and drifts the first time somebody corrects only one of them (§46). The
   * number is what the model keeps, because its ORDER is the point.
   *
   * German writes the decimal comma, English the point, and that is the whole reason this takes
   * a language: „4.7 GB" in a German sentence is a different number to a German reader.
   *
   * @param {number|null|undefined} mb - megabytes
   * @param {string} lang
   * @returns {string} the empty string when there is no number to say
   */
  function capacity(mb, lang) {
    const n = Number(mb);
    if (!Number.isFinite(n) || n <= 0) return '';
    const [value, unit] = n >= 1000000 ? [n / 1000000, 'TB'] : n >= 1000 ? [n / 1000, 'GB'] : [n, 'MB'];
    const rounded = value >= 10 || Number.isInteger(value) ? Math.round(value) : Math.round(value * 10) / 10;
    return `${String(rounded).replace('.', lang === 'de' ? ',' : '.')} ${unit}`;
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
    const typed = (t) => said(f, 'ProductType', t, lang);

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
          { subject: named(c), object: typed(t), answer: named(p), purpose: { label: word(f, 'ProductType', t, lang, 'purpose') } }, lang),
      };
    }

    if (template.key === 'purpose') {
      // Every type with a purpose, whether or not it has a product: the example clause in
      // the phrase is optional and disappears by itself where there is none.
      const t = any(f.types.filter((x) => word(f, 'ProductType', x, lang, 'purpose')));
      if (!t) return null;
      const wrong = sample(f.types.filter((x) => x.id !== t.id), 3);
      if (wrong.length < 2) return null;
      return {
        template: template.key, language: lang,
        subject: { kind: 'ProductType', id: t.id },
        object: null,
        text: fill(phrase.text, { subject: { label: word(f, 'ProductType', t, lang, 'purpose') } }, lang),
        options: [t, ...wrong].map((x) => word(f, 'ProductType', x, lang, 'name')),
        _correct: word(f, 'ProductType', t, lang, 'name'),
        // The question was the purpose, so naming the type says only what was asked. A
        // thing the reader has actually held is the fact that lands.
        _explanation: fill(phrase.explanation, { answer: typed(t), example: named(exampleOf(t)) }, lang),
      };
    }

    if (template.key === 'what_kind') {
      // The picture IS the question, so a kind without one cannot be asked about — that is a
      // fact about the data, not an error, and the next template is tried instead.
      const t = any(f.types.filter((x) => x.icon && word(f, 'ProductType', x, lang, 'purpose')));
      if (!t) return null;
      const wrong = sample(f.types.filter((x) => x.id !== t.id), 3);
      if (wrong.length < 2) return null;
      return {
        template: template.key, language: lang,
        subject: { kind: 'ProductType', id: t.id },
        object: null,
        image: `api/media/${t.icon}/file`,
        text: fill(phrase.text, {}, lang),
        options: [t, ...wrong].map((x) => word(f, 'ProductType', x, lang, 'name')),
        _correct: word(f, 'ProductType', t, lang, 'name'),
        _explanation: fill(phrase.explanation, {
          answer: typed(t),
          purpose: { label: word(f, 'ProductType', t, lang, 'purpose') },
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
        options: [ganz, ...wrong].map((x) => word(f, 'ProductType', x, lang, 'name')),
        _correct: word(f, 'ProductType', ganz, lang, 'name'),
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
      const pool = abbreviated(f, template.subject_kind, lang);
      const x = any(pool);
      if (!x) return null;
      const wrong = sample(pool.filter((y) => y.id !== x.id), 3);
      if (wrong.length < 2) return null;
      return {
        template: template.key, language: lang,
        subject: { kind: template.subject_kind, id: x.id },
        object: null,
        text: fill(phrase.text, { subject: { label: shortName(f, template.subject_kind, x, lang) } }, lang),
        // The OPTIONS are long forms, so the distractors have to be long forms too — a list
        // with one sentence and three words answers itself.
        options: [x, ...wrong].map((y) => y.long_name),
        _correct: x.long_name,
        _explanation: fill(phrase.explanation,
          { subject: { label: shortName(f, template.subject_kind, x, lang) }, answer: { label: x.long_name },
            // The abbreviation and the long form are NOT translated — „DOCX" is DOCX and
            // „Office Open XML" is the standard's own name. Only what it DOES is language.
            purpose: { label: word(f, template.subject_kind, x, lang, 'purpose') } }, lang),
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
            // `answer` is a PRODUCT — a proper name, the same in every language (§ the reason
            // only ProductType ever had a translation table).
            format: { label: word(f, 'FileFormat', fmt, lang, 'name') },
            purpose: { label: word(f, 'FileFormat', fmt, lang, 'purpose') } }, lang),
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
        text: fill(phrase.text, { subject: { label: word(f, 'FileFormat', fmt, lang, 'name') } }, lang),
        // The OPTIONS are translated and so is `_correct`, through the same call — a list in
        // one language whose right entry is in another answers itself.
        options: [grp, ...wrong].map((g) => word(f, 'FormatGroup', g, lang, 'name')),
        _correct: word(f, 'FormatGroup', grp, lang, 'name'),
        _explanation: fill(phrase.explanation,
          { subject: { label: word(f, 'FileFormat', fmt, lang, 'name') },
            // `said` and not a bare label: six of the seven groups are „ein Bildformat" and
            // „Auszeichnungssprache" is „eine". A hard-coded article gets that one wrong.
            answer: said(f, 'FormatGroup', grp, lang),
            purpose: { label: word(f, 'FormatGroup', grp, lang, 'purpose') } }, lang),
      };
    }

    if (template.key === 'product_group') {
      // The SAME shape as `format_group` one entity along, and deliberately not extracted into a
      // shared helper: the two differ in the subject kind, the group kind, the pool and the FK, so
      // a common version would take four parameters to say one thing (§9's anti-trigger — more than
      // five switches means the paths are not the same path). What IS shared is the reasoning in
      // the comments there; this one keeps only what is its own.
      const type = any(f.types.filter((x) => x.group_id));
      if (!type) return null;
      const grp = f.productGroups.find((g) => g.id === type.group_id);
      if (!grp) return null;
      const wrong = sample(f.productGroups.filter((g) => g.id !== grp.id), 3);
      if (wrong.length < 2) return null;
      return {
        template: template.key, language: lang,
        subject: { kind: 'ProductType', id: type.id },
        object: null,
        text: fill(phrase.text, { subject: said(f, 'ProductType', type, lang) }, lang),
        options: [grp, ...wrong].map((g) => word(f, 'ProductGroup', g, lang, 'name')),
        _correct: word(f, 'ProductGroup', grp, lang, 'name'),
        _explanation: fill(phrase.explanation,
          { subject: said(f, 'ProductType', type, lang),
            answer: said(f, 'ProductGroup', grp, lang),
            purpose: { label: word(f, 'ProductGroup', grp, lang, 'purpose') },
            note: { label: word(f, 'ProductGroup', grp, lang, 'note') || '' } }, lang),
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
        text: fill(phrase.text, { subject: { label: word(f, 'Concept', c, lang, 'name') } }, lang),
        options: [whole, ...wrong].map((y) => word(f, 'Concept', y, lang, 'name')),
        _correct: word(f, 'Concept', whole, lang, 'name'),
        _explanation: fill(phrase.explanation,
          { subject: { label: word(f, 'Concept', c, lang, 'name') },
            // The GENITIVE is why this is `said`: „Teil einer Webadresse", and the German
            // phrase asks for `{genitiv_answer}`. Without it the sentence read „Domain ist
            // ein Teil von Webadresse" — an article missing where German needs one.
            answer: said(f, 'Concept', whole, lang),
            example: { label: whole.example || '' } }, lang),
      };
    }

    // ── The storage media, added 2026-09-29 ───────────────────────────────────────────────
    //
    // `stands_for_storage` needs NO branch: the `stands_for` code above serves five entities and
    // was only told about the fifth pool. A question type that is a row and not a commit, which
    // is what declaring them as data was for (§48) — and the first time it paid out.

    // ── Four claims, of which 0 to 4 are true ─────────────────────────────────────────────
    //
    // The first type here whose answer is a SET. `_correct` is the sorted list of the indices
    // that hold — a canonical string, so „0,2" and „2,0" are the same answer and the comparison
    // in `assess` needs no special case.
    //
    // THE COUNT IS NOT SHOWN, at the architect's decision. Naming it invites arithmetic instead
    // of judging each statement, and at 0 or 4 it would be the whole answer. Both extremes stay
    // possible on purpose — they are the most surprising cases and therefore the ones worth
    // meeting.
    if (template.key === 'four_claims') {
      // A format that can furnish four DISTINCT claims. Most can; one with no group, no long
      // form and nothing that opens it cannot, and that is the inventory speaking.
      const askable = f.formats.filter((x) => claimsFor(f, x, lang).length === 4);
      const fmt = any(askable);
      if (!fmt) return null;
      const claims = claimsFor(f, fmt, lang);
      if (claims.length < 4) return null;
      const right = claims.map((cl, i) => (claimTruth(f, fmt, cl) ? i : -1)).filter((i) => i >= 0);
      return {
        template: template.key, language: lang,
        subject: { kind: 'FileFormat', id: fmt.id },
        object: null,
        multi: true,
        claims,
        text: fill(phrase.text, { subject: { label: word(f, 'FileFormat', fmt, lang, 'name') } }, lang),
        options: claims.map((cl) => claimText(f, fmt, cl, lang)),
        _correct: right.join(','),
        _explanation: '',   // the per-claim verdict is the explanation; see `judge`
      };
    }

    if (template.key === 'storage_capacity' || template.key === 'storage_capacity_min') {
      // Four media, and the one at one END of the ordering is the answer. `capacity_mb` earns its
      // numeric type here and only here: the comparison IS the question.
      //
      // BOTH DIRECTIONS FROM ONE BLOCK, and the reason is not brevity. Asking only for the largest
      // yielded 5 distinct questions out of 8 media (#3): hard disk and SSD are bigger than
      // everything else, so one of them was the answer in nearly every draw and six media were
      // subjects only when neither happened to be drawn. Inverting the ordering makes the floppy
      // disk and the CD-ROM the interesting end, and every step of it — the tie refusal, the
      // runner-up, the verdict — is the same step read the other way round.
      const least = template.key === 'storage_capacity_min';
      /** The one of two that is further towards the end this template asks about. */
      const nearer = (a, b) => (least
        ? (Number(b.capacity_mb) < Number(a.capacity_mb) ? b : a)
        : (Number(b.capacity_mb) > Number(a.capacity_mb) ? b : a));
      const pool = f.storages.filter((x) => Number(x.capacity_mb) > 0);
      if (pool.length < 4) return null;
      const four = sample(pool, 4);
      const right = four.reduce(nearer);
      // A tie would make two options right. It cannot happen on today's data and would be a
      // silent defect if it ever did, so it is refused rather than resolved (§3).
      if (four.filter((x) => Number(x.capacity_mb) === Number(right.capacity_mb)).length > 1) return null;
      // The RUNNER-UP travels in the explanation, because „4,7 GB" alone says nothing to
      // somebody who does not already know what a DVD holds. Two numbers are a comparison.
      const second = four.filter((x) => x.id !== right.id).reduce(nearer);
      return {
        template: template.key, language: lang,
        subject: { kind: 'StorageMedium', id: right.id },
        // The RUNNER-UP travels. `judge` can recompute which medium holds the most, but not
        // which four were offered — and a comparison drawn from all of them contradicts the
        // answer: „am meisten: 1 TB. Zum Vergleich: 2 TB." Measured, on the first draw.
        object: { kind: 'StorageMedium', id: second.id },
        text: fill(phrase.text, {}, lang),
        options: four.map((x) => word(f, 'StorageMedium', x, lang, 'name')),
        _correct: word(f, 'StorageMedium', right, lang, 'name'),
        _explanation: fill(phrase.explanation, {
          answer: said(f, 'StorageMedium', right, lang),
          capacity: { label: capacity(right.capacity_mb, lang) },
          other: said(f, 'StorageMedium', second, lang),
          other_capacity: { label: capacity(second.capacity_mb, lang) },
        }, lang),
      };
    }

    if (template.key === 'storage_rewritable') {
      const pool = f.storages.filter((x) => x.rewritable !== null && x.rewritable !== undefined);
      const x = any(pool);
      if (!x) return null;
      const yes = lang === 'de' ? 'Ja' : 'Yes';
      const no = lang === 'de' ? 'Nein' : 'No';
      const right = x.rewritable ? yes : no;
      return {
        template: template.key, language: lang,
        subject: { kind: 'StorageMedium', id: x.id },
        object: null,
        text: fill(phrase.text, { subject: said(f, 'StorageMedium', x, lang) }, lang),
        options: [yes, no],
        _correct: right,
        _explanation: fill(phrase.explanation, {
          answer: { label: right },
          // The note carries the WHY — „the RO in CD-ROM has been saying so all along" — and a
          // bare Ja/Nein without it teaches the fact and not the reason.
          note: { label: word(f, 'StorageMedium', x, lang, 'note') || '' },
        }, lang),
      };
    }

    if (template.key === 'storage_looks_like') {
      // A PICTURE question: only media that have one can be asked about, and that is a fact
      // about the inventory rather than an error.
      const pool = f.storages.filter((x) => x.icon);
      const x = any(pool);
      if (!x) return null;
      const wrong = sample(pool.filter((y) => y.id !== x.id), 3);
      if (wrong.length < 2) return null;
      return {
        template: template.key, language: lang,
        subject: { kind: 'StorageMedium', id: x.id },
        object: null,
        text: fill(phrase.text, {}, lang),
        image: picture(x),
        options: [x, ...wrong].map((y) => word(f, 'StorageMedium', y, lang, 'name')),
        _correct: word(f, 'StorageMedium', x, lang, 'name'),
        _explanation: fill(phrase.explanation, {
          answer: said(f, 'StorageMedium', x, lang),
          purpose: { label: word(f, 'StorageMedium', x, lang, 'purpose') },
          looks_like: { label: word(f, 'StorageMedium', x, lang, 'looks_like') || '' },
        }, lang),
      };
    }

    return null;
  }

  /**
   * What this player has done with each question — keyed by what makes a question the same one.
   *
   * THE KEY IS THE TEMPLATE PLUS THE SUBJECT, not the wording. „Wofür steht DVD?" asked twice is
   * the same question even though the four options were shuffled differently; „Wofür steht DVD?"
   * and „Wofür steht SSD?" are two, from one template. That is the identity a learner would
   * recognise, and it is the one the history can supply now that the subject is recorded for
   * every kind (#2).
   *
   * `streak` is the number of correct answers SINCE THE LAST WRONG ONE, and the „since" is what
   * makes it usable. Counting corrects outright would call a question mastered at five wrong and
   * two right; counting a streak says what the architect asked for — 🇩🇪 „erst bei zweimal
   * richtig landet sie im Topf derer, die sich ganz hinten anstellen" — and handles his own
   * example, one wrong and one right, as a streak of 1.
   *
   * @param {string} user
   * @returns {Promise<Map<string, {streak: number, wrong: number, lastAt: number}>>}
   */
  async function historyOf(user) {
    const out = new Map();
    try {
      const rows = await engine().query(
        'SELECT template_id, subject_entity, subject_id, asked_at, quality '
        + 'FROM asked_question WHERE user = ? AND id > 1 ORDER BY asked_at ASC, id ASC', [user]);
      for (const r of rows || []) {
        const k = `${r.template_id}/${r.subject_entity || ''}/${r.subject_id || ''}`;
        const e = out.get(k) || { streak: 0, wrong: 0, lastAt: 0 };
        // `skipped` is neither: it moves nothing. A question shown and not answered is a
        // different fact from one answered wrongly, which is why that enum has three values.
        if (r.quality === 'correct') e.streak += 1;
        else if (r.quality === 'wrong') { e.streak = 0; e.wrong += 1; }
        e.lastAt = Math.max(e.lastAt, Number(r.asked_at) || 0);
        out.set(k, e);
      }
    } catch (err) {
      // An unreadable history means no ordering, not no question. The quiz is the point; the
      // ordering is a refinement of it, and refusing to ask anything because a query failed
      // would be the tail wagging the dog.
      theLogger.warn('itquiz: answer history unreadable, asking without spacing', { user, error: err.message });
    }
    return out;
  }

  /**
   * How soon this player should meet a question again — lower is sooner.
   *
   * FOUR BANDS, and each one is a sentence the architect said:
   *
   *   0  got it wrong and has not recovered — „die falschen vorzuziehen ist eine anerkannt
   *      gute Lernstrategie"
   *   1  never asked — new material, which is what a quiz is for
   *   2  one wrong, then one right — „bekommt sie immer noch eine kleine Bevorzugung"
   *   3  two right since the last wrong — „landet sie im Topf derer, die sich ganz hinten
   *      anstellen"
   *
   * A NEVER-ASKED question sits ahead of a recovering one, and that is a judgement rather than
   * a rule he gave. The reason: a player who has just started would otherwise circle the handful
   * they got wrong while two hundred questions they have never seen wait behind. Fresh material
   * is the larger part of learning here; the recovery is the correction.
   *
   * The SOFTNESS is the second half, `staleness`, applied inside every band: the failure longest
   * ago comes before the failure just made. Two failed questions therefore alternate instead of
   * one repeating, which is what „sanft" has to mean in practice — a question answered wrongly a
   * moment ago is the last thing a learner needs to see again immediately.
   *
   * @param {Map<string, any>} history @param {any} q - a built question
   * @returns {{band: number, staleness: number}}
   */
  function urgency(history, q) {
    const key = `${q._templateId}/${q.subject?.kind || ''}/${q.subject?.id || ''}`;
    const e = history.get(key);
    // Infinity rather than a large number, so „never asked" always beats „asked a very long
    // time ago" without anybody having to pick how long a long time is.
    if (!e) return { band: 1, staleness: Infinity };
    const band = e.streak >= 2 ? 3 : e.streak === 1 ? 2 : 0;
    return { band, staleness: nowTs() - e.lastAt };
  }

  /**
   * The settings of whoever is asking — their level and their language.
   *
   * An ABSENT ROW IS NOT AN ERROR: it means the defaults, which is exactly what a first-time
   * visitor should get. Nobody is given a row for logging in; a row appears when somebody
   * changes something, which is the only moment there is anything to remember.
   *
   * @param {any} req
   * @returns {Promise<{user: string, level: string, language: string|null}>}
   */
  async function playerOf(req) {
    const user = String(req.user?.username || req.user?.role || 'anonymous');
    try {
      const rows = await engine().query('SELECT user, level, language FROM player WHERE user = ?', [user]);
      const row = rows && rows[0];
      return { user, level: LEVELS.includes(row?.level) ? row.level : 'basic', language: row?.language || null };
    } catch (err) {
      // A missing table (before the migration) or a locked database must not stop the quiz: the
      // defaults are a complete answer, and refusing to hand out a question because a SETTING
      // could not be read would be the tail wagging the dog (§3 — this is not a silent omission,
      // the level simply has a documented default).
      theLogger.warn('itquiz: player settings unreadable, using defaults', { user, error: err.message });
      return { user, level: 'basic', language: null };
    }
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
        const me = await playerOf(req);
        const lang = String(req.query.lang || me.language || 'en');
        // The URL may override the stored level, which is what makes the selector on the page
        // work before anything is saved — and what lets somebody try a harder question without
        // committing to it.
        const ceiling = LEVELS.includes(String(req.query.level)) ? String(req.query.level) : me.level;
        const all = await facts();
        const f = narrow(all, ceiling);
        const history = await historyOf(me.user);

        // SEVERAL CANDIDATES, THEN THE STALEST — rather than the first one that builds.
        //
        // The loop still walks the templates in random order, because one of them may have no
        // instance in today's facts and that must not turn into an empty page. What changed is
        // that it no longer STOPS at the first success: it collects a handful and then prefers
        // the question this player has least recently answered correctly.
        //
        // TWELVE, and the number was measured rather than argued. With six, a player who had
        // answered ninety-five questions correctly got the 4th-oldest back rather than the
        // oldest: the true oldest simply was not among the six drawn. Building is nearly free —
        // a whole request with twelve candidates takes about 6 ms, because the facts are already
        // in memory and a candidate is a sample out of them — so the pool can afford to be wide
        // enough that the choice is a real one.
        //
        // It is still a SAMPLE and not the whole set, deliberately: scoring every buildable
        // question would mean building every buildable question on every request, for a
        // refinement of the order in which they come.
        //
        // Never-right beats long-ago-right, without anybody choosing how long a long time is:
        // `staleness` answers `Infinity` for a question this player has never got right, which
        // includes every question they have never seen.
        const candidates = [];
        // A `claim` row is a SENTENCE SHAPE for `four_claims`, not a question — it lives in
        // `QuestionTemplate` so its wording sits in `QuestionPhrase` beside every other wording
        // and can be corrected without a commit. Skipped here rather than filtered at load,
        // because `claimText` looks those rows up by key.
        //
        // The test is the MODEL and no longer the name. It was `key.startsWith('claim_')` for
        // half a day, which worked and said nothing: a row renamed without the prefix would have
        // become drawable in silence, and the table gave a reader no way to tell the two kinds
        // apart (§48 — a fact about a row belongs on the row).
        for (const template of shuffled(f.templates).filter((t) => t.kind !== 'claim')) {
          const q = build(f, template, lang);
          if (!q) continue;
          // The template id travels on the built question so the history can be keyed without
          // `build` having to know that a history exists.
          q._templateId = template.id;
          candidates.push(q);
          if (candidates.length >= 12) break;
        }
        if (candidates.length) {
          // Band first, then the longest-untouched inside it. Sorting on the pair rather than on
          // a single blended number keeps the rule readable: whoever asks „why did I get THAT
          // one?" can be answered in one sentence, which a weighted score cannot do.
          candidates.sort((a, b) => {
            const ua = urgency(history, a);
            const ub = urgency(history, b);
            return ua.band - ub.band || ub.staleness - ua.staleness;
          });
          const { _correct, _explanation, _templateId, ...open } = candidates[0];
          // A SET-ANSWER QUESTION IS NOT SHUFFLED HERE. Its `options` and its `claims` are the
          // same four things in the same order, and the answer is a list of INDICES — shuffling
          // one and not the other made statement 0 and claim 0 different sentences, so every
          // verdict was about something the player had not read. The claims were already drawn
          // at random when they were built; there is nothing left to shuffle.
          const opts = open.multi ? candidates[0].options : shuffled(candidates[0].options);
          return res.json({ ...open, level: ceiling, options: opts });
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
    // `claims` is the one thing a question can carry that is not recomputable from its subject:
    // WHICH four statements were shown. Their TRUTH is still computed here, from the facts, so a
    // client can misreport what it was shown and cannot make a false claim true (#four_claims).
    const { template: key, language, subject, object, chosen, claims } = payload || {};
    const f = await facts();
    const template = f.templates.find((t) => t.key === key);
    if (!template) return { status: 400, error: `unknown template ${key}` };

    const truth = judge(f, template, language, subject, object, claims, chosen);
    if (!truth) return { status: 400, error: 'the question no longer matches the facts' };

    const quality = chosen == null ? 'skipped' : (chosen === truth.correct ? 'correct' : 'wrong');
    return { template, truth, quality };
  }

  /** The two records a question was about, as the log's polymorphic columns spell them. */
  function roleColumns(subject, object) {
    // TWO COLUMNS PER ROLE, and any kind fits (#2). Until 2026-09-29 this mapped a kind onto one
    // of three named FK columns — the three entities that existed when it was written — and for
    // each of the six added since it produced `{ undefined: 7 }`. A key literally named
    // "undefined". Nothing errored: the row was written, the answer counted, and the history
    // said the question had been about nothing. Which is also why the repetition logic could not
    // be built before this: two thirds of the inventory left no trace of WHAT was asked.
    const out = {};
    for (const [role, r] of [['subject', subject], ['object', object]]) {
      if (!r) continue;
      // An unknown shape is a defect and says so rather than writing something. The kinds are
      // not enumerated here — the `EntityKind` enum is the list, and repeating it would be a
      // second copy to keep in step (§17).
      if (!r.kind || r.id == null) {
        theLogger.warn('itquiz: a question role without a kind or an id was not recorded',
          { role, value: JSON.stringify(r).slice(0, 120) });
        continue;
      }
      out[`${role}_entity`] = String(r.kind);
      out[`${role}_id`] = r.id;
    }
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
          // WHICH four statements were shown. Their truth is computed here from the facts, so
          // this is the one thing the client is believed about and it is not a truth claim.
          claims: parse(req.query.claims),
          chosen: req.query.chosen == null ? null : String(req.query.chosen),
        });
        if (r.error) return res.status(r.status || 400).json({ error: r.error });
        return res.json({
          quality: r.quality,
          correct: r.truth.correct,
          explanation: r.truth.explanation,
          // Present only for a set-answer question: each statement with its own mark and, where
          // the player judged it wrongly, what is true instead. The page needs it structured to
          // put the correction under the sentence it corrects.
          ...(r.truth.claims ? { claims: r.truth.claims } : {}),
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
  function judge(f, template, lang, subject, object, claims, chosen) {
    const type = (id) => f.types.find((t) => t.id === id);
    const prod = (id) => f.products.find((p) => p.id === id);
    const comp = (id) => f.companies.find((c) => c.id === id);
    const phrase = f.phrases.find((p) => p.template_id === template.id && p.language === lang)
      || f.phrases.find((p) => p.template_id === template.id && p.language === 'en');
    if (!phrase) return null;
    const typed = (t) => said(f, 'ProductType', t, lang);

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
          { subject: { label: c.name }, object: typed(t), answer: { label: p.name }, purpose: { label: word(f, 'ProductType', t, lang, 'purpose') } }, lang),
      };
    }
    if (template.key === 'purpose') {
      const t = type(subject && subject.id); if (!t) return null;
      const beispiel = f.products.find((x) => x.product_type_id === t.id);
      return {
        correct: word(f, 'ProductType', t, lang, 'name'),
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
        correct: word(f, 'ProductType', t, lang, 'name'),
        // No picture — the picture WAS the question — but `context` supplies one anyway and
        // the caller below drops it. Keeping the three together is worth more than saving a
        // string, because the next template gets all three by writing one line.
        ...context([['ProductType', t]], lang),
        image: null,
        explanation: fill(phrase.explanation, {
          answer: typed(t),
          purpose: { label: word(f, 'ProductType', t, lang, 'purpose') },
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
        correct: word(f, 'ProductType', ganz, lang, 'name'),
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
      const x = abbreviated(f, template.subject_kind, lang).find((y) => y.id === (subject && subject.id));
      if (!x) return null;
      return {
        correct: x.long_name,
        ...context([[template.subject_kind, x]], lang),
        explanation: fill(phrase.explanation,
          { subject: { label: shortName(f, template.subject_kind, x, lang) }, answer: { label: x.long_name },
            // The abbreviation and the long form are NOT translated — „DOCX" is DOCX and
            // „Office Open XML" is the standard's own name. Only what it DOES is language.
            purpose: { label: word(f, template.subject_kind, x, lang, 'purpose') } }, lang),
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
            // `answer` is a PRODUCT — a proper name, the same in every language (§ the reason
            // only ProductType ever had a translation table).
            format: { label: word(f, 'FileFormat', fmt, lang, 'name') },
            purpose: { label: word(f, 'FileFormat', fmt, lang, 'purpose') } }, lang),
      };
    }

    if (template.key === 'format_group') {
      const fmt = f.formats.find((x) => x.id === (subject && subject.id));
      if (!fmt) return null;
      const grp = f.groups.find((g) => g.id === fmt.group_id);
      if (!grp) return null;
      return {
        correct: word(f, 'FormatGroup', grp, lang, 'name'),
        ...context([['FileFormat', fmt], ['FormatGroup', grp]], lang),
        explanation: fill(phrase.explanation,
          { subject: { label: word(f, 'FileFormat', fmt, lang, 'name') },
            answer: said(f, 'FormatGroup', grp, lang),
            purpose: { label: word(f, 'FormatGroup', grp, lang, 'purpose') } }, lang),
      };
    }

    if (template.key === 'product_group') {
      const type = f.types.find((x) => x.id === (subject && subject.id));
      if (!type) return null;
      const grp = f.productGroups.find((g) => g.id === type.group_id);
      if (!grp) return null;
      return {
        correct: word(f, 'ProductGroup', grp, lang, 'name'),
        ...context([['ProductType', type], ['ProductGroup', grp]], lang),
        explanation: fill(phrase.explanation,
          { subject: said(f, 'ProductType', type, lang),
            answer: said(f, 'ProductGroup', grp, lang),
            purpose: { label: word(f, 'ProductGroup', grp, lang, 'purpose') },
            note: { label: word(f, 'ProductGroup', grp, lang, 'note') || '' } }, lang),
      };
    }

    if (template.key === 'concept_part_of') {
      const c = f.concepts.find((x) => x.id === (subject && subject.id));
      if (!c) return null;
      const whole = f.concepts.find((y) => y.id === c.part_of_id);
      if (!whole) return null;
      return {
        correct: word(f, 'Concept', whole, lang, 'name'),
        ...context([['Concept', whole], ['Concept', c]], lang),
        explanation: fill(phrase.explanation,
          { subject: { label: word(f, 'Concept', c, lang, 'name') },
            answer: said(f, 'Concept', whole, lang),
            example: { label: whole.example || '' } }, lang),
      };
    }

    // ── The storage media ─────────────────────────────────────────────────────────────────
    //
    // Recomputed from the subject like every other branch here. `stands_for_storage` needs
    // nothing: the `stands_for` branch above already answers for all five pools.

    if (template.key === 'four_claims') {
      const fmt = f.formats.find((x) => x.id === (subject && subject.id));
      if (!fmt) return null;
      const list = Array.isArray(claims) ? claims : [];
      if (!list.length) return null;
      const verdicts = list.map((cl) => claimTruth(f, fmt, cl));
      const right = verdicts.map((t, i) => (t ? i : -1)).filter((i) => i >= 0);
      // THE VERDICT IS PER CLAIM, not a score and not a text block. „3 von 4 richtig" teaches
      // nothing; each statement with its own mark, and a reason where the reader was surprised,
      // is the whole lesson — and it is why the count could be withheld from the QUESTION
      // without withholding anything afterwards.
      //
      // Returned STRUCTURED so the page can show the correction where the mistake was made
      // rather than in a list below — 🇩🇪 „direkt im Fragenblock hinter der falschen Behauptung
      // in kursiv". A joined string would have forced the page to parse back out what this
      // already knows.
      //
      // `why` only where the player's judgement differed from the truth. A claim they got right
      // needs no sentence, and everywhere else it is noise. And a TRUE statement left unticked
      // gets none either: the statement IS the fact, so the ✓ in front of it is already the
      // correction. Only a false one held for true has something else to say.
      const picked = new Set(String(chosen ?? '').split(',').map((x) => x.trim()).filter((x) => x !== ''));
      const detail = list.map((cl, i) => {
        const ok = verdicts[i];
        const said = picked.has(String(i));
        return {
          ok,
          text: claimText(f, fmt, cl, lang),
          why: (!ok && said) ? claimText(f, fmt, cl, lang, true) : null,
        };
      });
      // ONE placeholder carries the whole count clause, because German needs the verb to agree
      // with it — „stimmt keine", „stimmt eine", „stimmen 3" — and a separate `{right}` beside a
      // `{were}` produced „stimmen 3 3." on the first draw. The number and its verb are one
      // phrase in both languages; splitting them made the sentence a template for two languages
      // that neither of them fits.
      const n = right.length;
      const clause = lang === 'de'
        ? (n === 0 ? 'stimmt keine' : n === 1 ? 'stimmt eine' : `stimmen ${n}`)
        : (n === 0 ? 'none were true' : n === 1 ? '1 was true' : `${n} were true`);
      return {
        correct: right.join(','),
        ...context([['FileFormat', fmt]], lang),
        claims: detail,
        explanation: fill(phrase.explanation || '', {
          subject: { label: word(f, 'FileFormat', fmt, lang, 'name') },
          were: { label: clause },
        }, lang),
      };
    }

    if (template.key === 'storage_capacity' || template.key === 'storage_capacity_min') {
      const least = template.key === 'storage_capacity_min';
      // The subject IS the right answer — `build` put it there, because which four were offered
      // is the one thing this cannot recompute. What it DOES recompute is the capacity and the
      // wording, so a changed number reaches the verdict without a second path.
      const right = f.storages.find((x) => x.id === (subject && subject.id));
      if (!right) return null;
      // The runner-up the QUESTION named, not the one at that end of the whole inventory. It is
      // checked rather than trusted — `object` arrives from the client — and a value on the wrong
      // SIDE of the answer is dropped instead of printed, or the comparison contradicts the
      // verdict it is supposed to support: „holds the most: 1 TB. For comparison: 2 TB."
      const named = object && f.storages.find((x) => x.id === object.id);
      const beyond = named && (least
        ? Number(named.capacity_mb) > Number(right.capacity_mb)
        : Number(named.capacity_mb) < Number(right.capacity_mb));
      const second = named && Number(named.capacity_mb) > 0 && beyond ? named : null;
      return {
        correct: word(f, 'StorageMedium', right, lang, 'name'),
        ...context([['StorageMedium', right]], lang),
        explanation: fill(phrase.explanation, {
          answer: said(f, 'StorageMedium', right, lang),
          capacity: { label: capacity(right.capacity_mb, lang) },
          other: second ? said(f, 'StorageMedium', second, lang) : { label: '' },
          other_capacity: { label: second ? capacity(second.capacity_mb, lang) : '' },
        }, lang),
      };
    }

    if (template.key === 'storage_rewritable') {
      const x = f.storages.find((y) => y.id === (subject && subject.id));
      if (!x) return null;
      const yes = lang === 'de' ? 'Ja' : 'Yes';
      const no = lang === 'de' ? 'Nein' : 'No';
      return {
        correct: x.rewritable ? yes : no,
        ...context([['StorageMedium', x]], lang),
        explanation: fill(phrase.explanation, {
          answer: { label: x.rewritable ? yes : no },
          note: { label: word(f, 'StorageMedium', x, lang, 'note') || '' },
        }, lang),
      };
    }

    if (template.key === 'storage_looks_like') {
      const x = f.storages.find((y) => y.id === (subject && subject.id));
      if (!x) return null;
      return {
        correct: word(f, 'StorageMedium', x, lang, 'name'),
        ...context([['StorageMedium', x]], lang),
        explanation: fill(phrase.explanation, {
          answer: said(f, 'StorageMedium', x, lang),
          purpose: { label: word(f, 'StorageMedium', x, lang, 'purpose') },
          looks_like: { label: word(f, 'StorageMedium', x, lang, 'looks_like') || '' },
        }, lang),
      };
    }

    return null;
  }

  /**
   * GET/POST /api/sys/itquiz/settings — the player's own level and language.
   *
   * WRITTEN THROUGH THE SERVICE (§51), never through the repository, so the before-hook, the
   * transaction and the audit entry all happen — a level somebody set is a change worth a trail
   * like any other.
   *
   * A row appears on the first write and not before: reading is answered from the defaults when
   * there is nothing stored, which is what a first-time visitor should get.
   *
   * Guarded by the same declared permission as the question itself. A player may set their OWN
   * level and nobody else's — the username comes from the session and is never taken from the
   * body, which is the whole of the authorisation here.
   */
  app.get('/api/sys/itquiz/settings',
    authMiddleware, requireEntityVerb('ProductType', 'r'),
    async (req, res) => {
      try {
        const me = await playerOf(req);
        return res.json({ ...me, levels: LEVELS });
      } catch (err) {
        theLogger.error('itquiz: settings read failed', { error: err.message });
        return res.status(500).json({ error: err.message });
      }
    });

  app.post('/api/sys/itquiz/settings',
    authMiddleware, requireEntityVerb('ProductType', 'r'),
    async (req, res) => {
      try {
        const user = String(req.user?.username || req.user?.role || 'anonymous');
        const level = LEVELS.includes(String(req.body?.level)) ? String(req.body.level) : null;
        const language = req.body?.language ? String(req.body.language) : null;
        if (!level && !language) {
          // A request that changes nothing is a client bug, and saying so beats writing a row
          // that records the absence of a decision (§3).
          return res.status(400).json({ error: 'nothing to set — give a level, a language, or both' });
        }
        // The SAME context shape the answer path uses, and copied rather than invented: the
        // service reads `changedBy`, not a nested `user`, and the comment beside that call
        // records what it cost to find out. An internal call that is shorter than the user's
        // path differs by exactly the obligations it skips (§51).
        const context = {
          correlationId: req.correlationId,
          clientIp: req.ip || req.connection?.remoteAddress,
          changedBy: user,
        };
        const existing = await engine().query('SELECT id FROM player WHERE user = ?', [user]);
        const patch = { ...(level ? { level } : {}), ...(language ? { language } : {}) };
        if (existing && existing[0]) {
          // THE FOURTH ARGUMENT IS `expectedVersion`, NOT the context — `createEntity` takes it
          // third and `updateEntity` takes it fifth, and passing the context in the version slot
          // failed in the two ways such a mistake always does: the optimistic-locking check
          // compared the row's version against an OBJECT and refused every write („expected
          // version [object Object]"), while the context it was supposed to carry never arrived,
          // so the audit entry would have had no actor either. `null` is the deliberate value
          // here: the player's own settings have one writer and nothing to lose a race with.
          await theGenericService.updateEntity('Player', existing[0].id, patch, null, context);
        } else {
          await theGenericService.createEntity('Player', { user, ...patch }, context);
        }
        return res.json(await playerOf(req));
      } catch (err) {
        theLogger.error('itquiz: settings write failed', { error: err.message });
        return res.status(500).json({ error: err.message });
      }
    });

  theLogger.info('itquiz routes registered', { routes: ['GET /api/sys/itquiz/question', 'GET /api/sys/itquiz/verdict', 'POST /api/sys/itquiz/answer', 'GET|POST /api/sys/itquiz/settings'] });
};
