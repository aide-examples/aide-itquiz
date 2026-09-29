// @ts-check
'use strict';
/**
 * Translation.integrity — what a polymorphic reference gives up, checked on demand (#8).
 *
 * `[POLY_FK=subject_entity:subject_id]` buys one table for every translated kind and pays for it
 * with referential integrity: no foreign key stands behind `subject_id`, so deleting a record
 * leaves its wordings pointing at a number. The database cannot notice, and that was accepted
 * deliberately — on the condition that something else does notice.
 *
 * WHY AN ACTION AND NOT A TOOL. This reads APPLICATION DATA, and the project rule is explicit:
 * *„a report about application data is an ACTION of the system that owns the data — never an entry
 * in the framework's manifest."* A standalone script would also have been the wrong shape for a
 * plainer reason (#8): it runs when somebody types it, which is never. An action is computed on
 * open, so it cannot go stale, and it can grow a repair button beside its findings — a view could
 * list the same rows and could not.
 *
 * WHY `compute` AND NOT AN IFRAME TRIAD. It answers rather than does: JSON in, JSON out, no page
 * to build and no operand to pick. It is also then reachable by an API key, which is what lets a
 * schedule run it later without anything being rewritten.
 *
 * NOTHING IS ENUMERATED HERE. The kinds are read from the data — `SELECT DISTINCT subject_entity`
 * — and each is checked for being a table at all. A list of translatable kinds already exists
 * twice (the router's `TRANSLATED_KINDS`, the `EntityKind` enum), and a third copy would drift
 * from both the first time somebody adds an entity (§17). Deriving also makes the check say
 * something a list could not: that a kind NAME in the data is one the model actually has.
 *
 * The framework-wide version of this is aide-rap#514; when that lands, this narrows to whatever
 * is specific to itquiz, or goes.
 */

/** RAP's null record, which is scaffolding rather than data and is never a finding. */
const NULL_RECORD = 1;

/**
 * The fields a wording can carry BESIDES the name — what makes a row worth having when the name
 * happens to be the record's own. Listed rather than derived: the point is exactly that this is the
 * set whose emptiness makes a row say nothing, and a derivation over „every column that is not
 * system" would silently start counting a new column as content the day one is added.
 */
const OWN_FIELDS = ['article', 'purpose', 'looks_like', 'gender', 'genitive', 'note'];

/**
 * `ProductGroup` → `product_group`, the way RAP derives a table name from a class name.
 *
 * Spelled here rather than imported because the action module must not reach into framework
 * internals (the boundary rule); it is four characters of regex and the one place it is used.
 *
 * @param {string} kind
 * @returns {string}
 */
function tableOf(kind) {
  return String(kind).replace(/([a-z0-9])([A-Z])/g, '$1_$2').toLowerCase();
}

/**
/**
 * Every finding about the live wordings, in one pass per kind.
 *
 * ONE DEPENDENCY, AND IT IS A PARAMETER (§18): `query(sql, params) => rows`. The action hands in
 * `ctx.sql`, which resolves `${pg:…|sqlite:…}` for the active engine on the way; a tool can hand in
 * anything that runs SQL. Nothing here reaches into a context.
 *
 * *Lehrgeld, twice in five minutes.* The first version handed the dialect macro straight to
 * `prepare` and the database answered „unrecognized token: $". The second read `ctx.sql` as a
 * transformer that RETURNS the resolved string — it runs the query and returns rows — so `prepare`
 * got `undefined` and said „Expected first argument to be a string". Both failures needed the real
 * call path to show up, and neither would have appeared in a unit check written against my own idea
 * of the signature (§3: did I take this from the thing that calls it?).
 *
 * @param {(sql: string, params?: any[]) => Promise<any[]>} query
 * @returns {Promise<{checked: number, kinds: string[], orphans: any[], unknownKinds: any[], sayNothing: any[]}>}
 */
async function inspect(query) {
  const kinds = (await query(
    'SELECT DISTINCT subject_entity AS kind FROM translation WHERE id != ? ORDER BY 1', [NULL_RECORD]
  )).map((/** @type {any} */ r) => r.kind);

  // `sqlite_master` would tie this to one engine; the information schema answers on both, and the
  // dialect macro is what every view in this system already uses for exactly that reason.
  const tables = new Set((await query(
    '${pg:SELECT table_name AS name FROM information_schema.tables WHERE table_schema = current_schema()'
    + "|sqlite:SELECT name FROM sqlite_master WHERE type = 'table'}"
  )).map((/** @type {any} */ r) => r.name));

  /** @type {any[]} */ const orphans = [];
  /** @type {any[]} */ const unknownKinds = [];
  /** @type {any[]} */ const sayNothing = [];
  let checked = 0;

  for (const kind of kinds) {
    const table = tableOf(kind);
    if (!tables.has(table)) {
      // A kind the model does not have. Reported apart from an orphan, because the two want
      // different repairs: this is a wrong NAME, an orphan is a wrong id.
      const rows = await query(
        'SELECT id, language, name FROM translation WHERE subject_entity = ? AND id != ?',
        [kind, NULL_RECORD]);
      for (const r of rows) unknownKinds.push({ id: r.id, kind, language: r.language, name: r.name });
      checked += rows.length;
      continue;
    }
    // THE ORPHAN CHECK — the one the database cannot make. A LEFT JOIN rather than a lookup per
    // row; the table name cannot be a parameter, so it is interpolated, and that is safe precisely
    // because it was just matched against the list of tables that exist.
    const rows = await query(
      `SELECT t.id, t.language, t.name, t.subject_id, t.article, t.purpose, t.looks_like,
              t.gender, t.genitive, t.note, r.name AS target_name
         FROM translation t LEFT JOIN ${table} r ON r.id = t.subject_id
        WHERE t.subject_entity = ? AND t.id != ?`, [kind, NULL_RECORD]);
    checked += rows.length;
    for (const r of rows) {
      if (r.target_name === null || r.target_name === undefined) {
        orphans.push({ id: r.id, kind, subject_id: r.subject_id, language: r.language, name: r.name });
      } else if (r.name === r.target_name && !OWN_FIELDS.some((c) => r[c])) {
        // A wording identical to the record's own name AND carrying nothing else. BOTH halves are
        // needed: the first version tested only the name and reported 86 of 133 rows, because the
        // German wording of „PDF" is „PDF" — while the row also carries its purpose, its gender and
        // its genitive, which is the whole reason it exists. 86 was implausible on sight, and that
        // is the only thing that caught it.
        //
        // What is left is genuinely dead: `word()` returns the same value either way, so the row is
        // invisible, and the next reader cannot tell it from one that says something the record does
        // not. Fifteen of these were left behind on 2026-09-29 by a seed load — which replaces and
        // does not mirror, so no load can remove them.
        sayNothing.push({ id: r.id, kind, language: r.language, name: r.name });
      }
    }
  }
  return { checked, kinds, orphans, unknownKinds, sayNothing };
}

/**
 * The compute-action entry point.
 *
 * @param {any} _input - none: the check is over the whole table and has no operand
 * @param {{sql: (sql: string, params?: any[]) => Promise<any[]>}} ctx
 */
async function run(_input, ctx) {
  const r = await inspect((sql, params) => ctx.sql(sql, params));
  const problems = r.orphans.length + r.unknownKinds.length;
  return {
    // The RESULT first and in the words somebody would check it against, then what it was measured
    // over. „clean" is a state; „checked" alone would be an activity (§54).
    verdict: problems === 0
      ? (r.sayNothing.length === 0
        ? `clean — ${r.checked} wordings over ${r.kinds.length} kinds, every one naming a record that exists`
        : `no broken reference in ${r.checked} wordings, but ${r.sayNothing.length} say nothing`)
      : `${problems} broken reference(s) in ${r.checked} wordings over ${r.kinds.length} kinds`,
    checked: r.checked,
    kinds: r.kinds,
    orphans: r.orphans,
    unknown_kinds: r.unknownKinds,
    say_nothing: r.sayNothing,
  };
}

module.exports = { run, inspect, tableOf };
