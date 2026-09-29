#!/usr/bin/env node
// @ts-check
'use strict';
/**
 * test-entity-json — every `## Attributes` block parses, and no quotation mark closes with the
 * wrong character.
 *
 * WHY THIS EXISTS. An unparseable attributes block does not degrade: `parseAttributesSection` throws
 * and the server REFUSES TO START. That is right — a half-read model is worse than none — but it
 * means the failure surfaces at the next restart, which can be long after the commit that caused it,
 * and on a machine that is not the author's. It happened three times on 2026-09-29, always the same
 * way, twice reaching a commit before anybody noticed.
 *
 * THE CAUSE IS ONE CHARACTER, every time. A German quotation opens with `„` (U+201E) and must close
 * with `“` (U+201C). Closing it with an ASCII `"` ends the JSON string instead:
 *
 *     …"description":"the German („Webadresse") is a row"…
 *                                            ↑ ends the string here
 *
 * Both marks are invisible in most editors at most sizes, the line is 300 characters long, and the
 * value is otherwise perfectly readable prose. Nothing about looking at it helps.
 *
 * WHY HERE AND NOT IN THE FRAMEWORK'S GATE. Entity documents live in a SYSTEM's repo; aide-rap's
 * commit gate guards commits to aide-rap. A system's entity doc can therefore break with no gate
 * anywhere seeing it, which is exactly how the first two reached a commit. The framework-level
 * version of this belongs in aide-rap and is filed there; this one runs on every commit here, now.
 *
 *   node tools/test-entity-json.js
 *
 * Exit 1 on any finding.
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const DIR = path.join(ROOT, 'docs', 'classes');

/** @type {string[]} */
const findings = [];
let blocks = 0;

/** The German quotation marks, named so the checks below read as what they are. */
const OPEN = '„';   // „
const CLOSE = '“';  // “

for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith('.md')).sort()) {
  const text = fs.readFileSync(path.join(DIR, file), 'utf8');
  const m = /## Attributes\s*```json\s*(\[[\s\S]*?\])\s*```/.exec(text);
  if (!m) continue;                    // an entity may legitimately have none
  blocks++;
  try {
    const cols = JSON.parse(m[1]);
    if (!Array.isArray(cols)) findings.push(`${file}: ## Attributes is not an array`);
    for (const c of cols) {
      if (!c || typeof c !== 'object') { findings.push(`${file}: an attribute is not an object`); continue; }
      if (!c.name) findings.push(`${file}: an attribute has no name`);
      if (!c.type) findings.push(`${file}: attribute "${c.name}" has no type`);
    }
  } catch (e) {
    // The message carries the position, and the position is what makes a 300-character line
    // findable. Then the likely cause, because the parser cannot know it and the author always
    // wants it: an opening `„` whose closing mark is an ASCII quote.
    const at = /position (\d+)/.exec(String(e && e.message));
    const near = at ? m[1].slice(Math.max(0, Number(at[1]) - 60), Number(at[1]) + 20) : '';
    findings.push(`${file}: ## Attributes does not parse — ${e && e.message}`
      + (near ? `\n      near: …${near}…` : '')
      + (near.includes(OPEN) ? `\n      likely cause: a „ opened here closes with an ASCII " instead of ${CLOSE}` : ''));
  }
}

// THE SECOND CHECK THAT IS NOT HERE, and why — because the next reader will want to add it.
//
// The obvious companion is to flag every `„…"` anywhere in the file, not only inside the JSON. It
// was written, run, and deleted within the minute: 75 findings, of which ONE was the defect. `„Safari\"`
// inside a JSON string is a correctly escaped quote and correct prose; `„der Router …"` in a prose
// chapter is at most a typographic inconsistency and breaks nothing. A detector that reports 74
// correct lines to find one wrong one does not get read, and then neither does the one finding —
// which is the failure this file was written to prevent, reproduced in its own second half.
//
// The parse check above is already complete for the thing that matters: a quotation closed with the
// wrong character either ends a JSON string, in which case the block does not parse and it is found
// here, or it does not, in which case nothing is broken. There is no third case (§49: check the
// direction whose counterpart does not inherit, not the symmetric form that drowns in correct code).

if (findings.length) {
  console.error(`✗ test-entity-json — ${findings.length} finding(s)\n`);
  for (const f of findings) console.error(`  ${f}`);
  process.exit(1);
}
console.log(`✓ test-entity-json: ${blocks} attribute block(s) parse, each attribute carrying a name and a type`);
