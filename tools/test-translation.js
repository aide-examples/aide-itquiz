#!/usr/bin/env node
// @ts-check
'use strict';
/**
 * test-translation — a wording names a kind the model has, a record that exists, and the one
 * grammatical fact English cannot derive.
 *
 * `Translation` is a polymorphic reference — `[POLY_FK=subject_entity:subject_id]` — so
 * `(subject_entity, subject_id, language)` is a real composite unique key and duplicates are the
 * database's problem, not this tool's. What no index can check is whether the row names a kind
 * that exists and a record that is still there, because no foreign key stands behind a
 * polymorphic id. That absence is what is checked here.
 *
 * Checked against the SEED, which is the source of truth for this system's reference data, and
 * against the live database when one is present — the two can disagree, and a row added by hand
 * in the UI is exactly the case a seed-only check would miss.
 *
 *   node tools/test-translation.js
 *
 * Exit 1 on any finding.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SEED = path.join(ROOT, 'data', 'seed', 'Translation.json');

/**
 * The kinds that may be translated, and the seed file each one's names live in.
 *
 * ONE ENTRY PER KIND and no longer one per COLUMN (#1). Until the polymorphic conversion this
 * list carried a seed key, a database column and a file for each of seven references, and every
 * new translated entity cost an edit here as well as in the entity, the constraint and the query.
 * The list is now only what it has to be: the set of kinds a row may name, plus where to check
 * that the name it gives exists.
 */
const KINDS = [
  ['ProductType', 'ProductType.json'],
  ['FileFormat', 'FileFormat.json'],
  ['FormatGroup', 'FormatGroup.json'],
  ['Protocol', 'Protocol.json'],
  ['Connector', 'Connector.json'],
  ['Concept', 'Concept.json'],
  ['StorageMedium', 'StorageMedium.json'],
];

/** @type {string[]} */
const findings = [];

// ── The seed ────────────────────────────────────────────────────────────────────────────────
const rows = JSON.parse(fs.readFileSync(SEED, 'utf8'));

/** The names each referenced entity's own seed offers, so a typo in a name is caught here. */
const known = new Map();
for (const [kind, file] of KINDS) {
  const p = path.join(ROOT, 'data', 'seed', file);
  const own = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [];
  known.set(kind, new Set(own.map((r) => r.name)));
}

const seen = new Map();
rows.forEach((r, i) => {
  const at = `seed row ${i + 1}`;
  // WHAT THE UNIQUE KEY CANNOT SAY. `(subject_entity, subject_id, language)` is a declared key
  // now, so duplicates are the database's problem and no longer this tool's. What no index can
  // check is whether the row names a kind the model has, and whether the NAME in `subject_id`
  // resolves to a record — a key only knows that two rows differ.
  if (!known.has(r.subject_entity)) {
    findings.push(`${at}: subject_entity "${r.subject_entity}" is not a translated kind`);
    return;
  }
  if (!r.language) findings.push(`${at}: no language`);
  if (!r.name) findings.push(`${at}: no name — the word in that language is the point of the row`);
  if (!known.get(r.subject_entity).has(r.subject_id)) {
    findings.push(`${at}: no ${r.subject_entity} is called "${r.subject_id}" — the seed names its `
      + 'target and the loader resolves it, so a typo here becomes a null reference');
  }
  const id = `${r.subject_entity}/${r.subject_id}/${r.language}`;
  if (seen.has(id)) {
    findings.push(`${at}: a second wording for ${id} (first at seed row ${seen.get(id) + 1})`);
  } else {
    seen.set(id, i);
  }
  // A purpose is substituted into several frames („Was X tut: …", „Das ist ein X, das …"), and
  // only a lower-case predicate fits them all. A capital or a final stop produces a sentence
  // inside a sentence — no error anywhere, just prose a reader stumbles over.
  if (r.purpose && /^[A-ZÄÖÜ]/.test(r.purpose)) {
    findings.push(`${at}: purpose starts with a capital — it is a predicate, not a sentence`);
  }
  if (r.purpose && /\.$/.test(r.purpose)) {
    findings.push(`${at}: purpose ends in a full stop — the frame supplies it`);
  }
});

// ── The English article, where nothing can derive it (#6) ───────────────────────────────────
//
// „a" or „an" follows the SOUND of the next word, and for an initialism that sound depends on
// whether the thing is read letter by letter („an ess-ess-dee") or as a word („a sip"). The model
// does not say which, and no rule over the letters can tell them apart — so the article is stored.
//
// The rule is exact and needs no pronunciation table: it bites only where the two readings
// DISAGREE, which is when the first letter's own NAME begins with a vowel (ef, aitch, el, em, en,
// ar, ess, ex) or the letter is a vowel whose name is a consonant sound (u → „you"). For every
// other first letter — p, d, j, c, z, g, b, w — both readings give „a" and the approximation in
// `fill()` is right, so nothing is stored and nothing is checked.
const AMBIGUOUS = new Set('AEIOUFHLMNRSX'.split(''));

/** The English wording of a record: its `en` row where there is one, else the record's own name. */
const englishRow = new Map();
for (const r of rows) {
  if (r.language === 'en') englishRow.set(`${r.subject_entity}/${r.subject_id}`, r);
}
let articlesChecked = 0;
for (const [kind, file] of KINDS) {
  const p = path.join(ROOT, 'data', 'seed', file);
  const own = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [];
  for (const rec of own) {
    const en = englishRow.get(`${kind}/${rec.name}`);
    const label = (en && en.name) || rec.name || '';
    // The leading run of CAPITALS, counted over letters only, so „Z-Wave" and „Blu-ray" are words
    // with a capital and not initialisms.
    const caps = (label.match(/^[A-Z]+/) || [''])[0];
    if (caps.length < 2 || !AMBIGUOUS.has(caps[0])) continue;
    articlesChecked++;
    if (!en || !en.article) {
      findings.push(`${kind} "${label}": no English article stored, and it cannot be derived — `
        + `„${caps[0]}" reads one way as a letter and another as a word, so the approximation in `
        + 'fill() is a coin toss. Add an `en` row with "article": "a" or "an"');
    } else if (en.article !== 'a' && en.article !== 'an') {
      findings.push(`${kind} "${label}": article "${en.article}" is neither "a" nor "an"`);
    }
  }
}
// The other direction: an article that says what is already derived is dead data, and dead data
// drifts (§10). On a German row it is never read at all — `fill()` takes both articles from the
// gender, so a stored one there would silently disagree with „der"/„die"/„das".
for (const r of rows) {
  if (!r.article) continue;
  if (r.language !== 'en') {
    findings.push(`${r.subject_entity}/${r.subject_id}/${r.language}: an article on a row that is `
      + 'not English is never read — the gender supplies both articles');
    continue;
  }
  const caps = ((r.name || '').match(/^[A-Z]+/) || [''])[0];
  if (caps.length < 2 || !AMBIGUOUS.has(caps[0])) {
    findings.push(`${r.subject_entity}/${r.subject_id}: "${r.name}" needs no stored article — `
      + 'fill() derives the same one from the first letter');
  }
}

// ── The live database, if there is one ──────────────────────────────────────────────────────
let dbChecked = 0;
const DB = path.join(ROOT, 'data', 'rap.sqlite');
if (fs.existsSync(DB)) {
  try {
    const Database = require(path.join(ROOT, '..', 'aide-rap', 'node_modules', 'better-sqlite3'));
    const db = new Database(DB, { readonly: true });
    const has = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='translation'").get();
    if (has) {
      const live = db.prepare('SELECT id, subject_entity, subject_id FROM translation WHERE id > 1').all();
      dbChecked = live.length;
      // THE ORPHAN CHECK, which is the price of a polymorphic reference: no foreign key stands
      // behind `subject_id`, so a record deleted out from under a wording leaves it pointing at
      // nothing. This is the local stand-in until aide-rap#514 makes it a framework check.
      for (const r of live) {
        if (!known.has(r.subject_entity)) {
          findings.push(`translation #${r.id}: subject_entity "${r.subject_entity}" is not a translated kind`);
          continue;
        }
        const table = r.subject_entity.replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
        const hit = db.prepare(`SELECT 1 FROM ${table} WHERE id = ?`).get(r.subject_id);
        if (!hit) findings.push(`translation #${r.id}: no ${r.subject_entity} with id ${r.subject_id}`);
      }
    }
    db.close();
  } catch (err) {
    // A missing better-sqlite3 or a locked file is not a finding — it is an absent measurement,
    // and saying which is the difference between a green that means something and one that does
    // not (§35).
    console.log(`  (database not read: ${err.message.split('\n')[0]})`);
  }
}

if (findings.length) {
  console.error(`✗ test-translation — ${findings.length} finding(s)\n`);
  for (const f of findings) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`✓ test-translation: ${rows.length} seed rows`
  + `${dbChecked ? ` and ${dbChecked} live rows` : ''}, each naming a kind the model has and a `
  + `record that exists; ${articlesChecked} names whose English article cannot be derived carry one`);
