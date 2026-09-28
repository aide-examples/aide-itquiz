#!/usr/bin/env node
// @ts-check
'use strict';
/**
 * test-translation — one wording per record per language, and exactly one subject per row.
 *
 * `Translation` is a polymorphic reference: six optional foreign keys with `ExactlyOne` over
 * them. The constraint is enforced by the framework. The **uniqueness** is not, and cannot be:
 * `uk` takes one group number per attribute, so `language` can join one composite key and not
 * six, and a single composite key over all seven columns would enforce nothing — SQL counts rows
 * that differ in a NULL as distinct, and with five of six references null in every row that is
 * every pair of them. So it is asserted here instead of claimed in the entity doc (§42).
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

/** The six references, and the seed key ↔ database column of each. */
const SUBJECTS = [
  ['product_type', 'product_type_id', 'ProductType.json'],
  ['file_format', 'file_format_id', 'FileFormat.json'],
  ['format_group', 'format_group_id', 'FormatGroup.json'],
  ['protocol', 'protocol_id', 'Protocol.json'],
  ['connector', 'connector_id', 'Connector.json'],
  ['concept', 'concept_id', 'Concept.json'],
];

/** @type {string[]} */
const findings = [];

// ── The seed ────────────────────────────────────────────────────────────────────────────────
const rows = JSON.parse(fs.readFileSync(SEED, 'utf8'));

/** The names each referenced entity's own seed offers, so a typo in a key is caught here. */
const known = new Map();
for (const [key, , file] of SUBJECTS) {
  const p = path.join(ROOT, 'data', 'seed', file);
  const own = fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : [];
  known.set(key, new Set(own.map((r) => r.name)));
}

const seen = new Map();
rows.forEach((r, i) => {
  const at = `seed row ${i + 1}`;
  const present = SUBJECTS.map(([k]) => k).filter((k) => r[k] !== undefined && r[k] !== null);
  if (present.length !== 1) {
    findings.push(`${at}: ${present.length === 0 ? 'names no subject' : `names ${present.length} subjects (${present.join(', ')})`}`
      + ' — ExactlyOne means exactly one');
    return;
  }
  const [key] = present;
  if (!r.language) findings.push(`${at}: no language`);
  if (!r.name) findings.push(`${at}: no name — the word in that language is the point of the row`);
  if (!known.get(key).has(r[key])) {
    findings.push(`${at}: ${key} "${r[key]}" is in no ${key} seed — the FK will not resolve`);
  }
  const id = `${key}/${r[key]}/${r.language}`;
  if (seen.has(id)) {
    findings.push(`${at}: a second wording for ${id} (first at seed row ${seen.get(id) + 1}) `
      + '— the generator would have two words for one thing and no rule for choosing');
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

// ── The live database, if there is one ──────────────────────────────────────────────────────
let dbChecked = 0;
const DB = path.join(ROOT, 'data', 'rap.sqlite');
if (fs.existsSync(DB)) {
  try {
    const Database = require(path.join(ROOT, '..', 'aide-rap', 'node_modules', 'better-sqlite3'));
    const db = new Database(DB, { readonly: true });
    const has = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='translation'").get();
    if (has) {
      const cols = SUBJECTS.map(([, c]) => `"${c}"`).join(', ');
      const live = db.prepare(`SELECT id, ${cols}, language FROM translation WHERE id > 1`).all();
      dbChecked = live.length;
      const dbSeen = new Map();
      for (const r of live) {
        const present = SUBJECTS.map(([, c]) => c).filter((c) => r[c]);
        if (present.length !== 1) {
          findings.push(`translation #${r.id}: ${present.length} subjects set — ExactlyOne means exactly one`);
          continue;
        }
        const id = `${present[0]}/${r[present[0]]}/${r.language}`;
        if (dbSeen.has(id)) {
          findings.push(`translation #${r.id}: a second wording for ${id} (first is #${dbSeen.get(id)})`);
        } else {
          dbSeen.set(id, r.id);
        }
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
  + `${dbChecked ? ` and ${dbChecked} live rows` : ''}, each with exactly one subject `
  + 'and at most one wording per record per language');
