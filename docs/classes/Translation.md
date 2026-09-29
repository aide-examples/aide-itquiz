# Translation [reference_data] [POLY_FK=subject_entity:subject_id]

[LABEL=concat(language, ' · ', name)]
[PLURAL=de:Übersetzungen en:Translations]

One record's wording in one language — the noun, what it is for, and the grammar a correct sentence about it needs.

## About

The model is English. What a learner reads is not, and six entities carry a `name` and a
`purpose` that have to arrive in the reader's language: [ProductType](ProductType.md),
[FileFormat](FileFormat.md), [FormatGroup](FormatGroup.md), [Protocol](Protocol.md),
[Connector](Connector.md), [Concept](Concept.md), [StorageMedium](StorageMedium.md).

*Seven, since 2026-09-29 — and seven is one past what RAP recommends for this shape ("max ~6
targets per PMR group"). It is carried rather than redesigned because the redesign is already
decided and waiting: aide-itquiz#1 collapses all seven into the two columns of a `[POLY_FK=…]`,
where an eighth costs a row and not a column. Adding one more here is the cheap move ONLY
because that is the direction of travel; a second one past the limit would not be.*

**One table and not six**, at the architect's decision — 🇩🇪 *„Fassen wir die Übersetzungen
zusammen."* `ProductTypeText` was the first of the six and is absorbed here; five siblings beside
it would have been one shape copied six times, and a rule added to it later would have been
applied six times or, more likely, five (§17).

**Two columns and not seven, and the journey there is the part worth keeping.** This began as
RAP's documented PMR pattern — N optional foreign keys plus an `ExactlyOne` constraint, every one
of them a real FK the database enforces
([polymorphic-references.md](rap:features/polymorphic-references.md)). That is the right pattern
for domain data and the same doc calls `[POLY_FK=…]` an anti-pattern for it, so the choice looked
settled.

It was measured instead, and the measurement decided it. **A second seed load took the table from
64 rows to 128.** One wording per record per language could not be DECLARED in that shape:

- `uk` takes one group number per attribute, so `language` could belong to one composite key and
  not to seven;
- and `_uniqueProbes` builds no probe at all when a key part is null — with seven optional FKs,
  six are null in every row.

So the loader had no way to recognise a row it had already written, and every load appended. A
detector could report the duplicates afterwards; nothing could prevent them. 🇩🇪 *„Wir stellen auf
PolyFK um."*

Here both columns are always set, `uk:1` over `(subject_entity, subject_id, language)` is a key
the database really builds, and a re-load is an upsert.

**What it gives up, and why that is bearable here.** Referential integrity: nothing stops a row
naming a record that has been deleted. Two things make the trade acceptable rather than merely
cheaper. A translation is *about* a record and does not constitute it — an orphaned wording is
litter, not a corruption. And the check the database can no longer make is being built into RAP
itself as a regular part of the QA suite (aide-rap#514), at the architect's condition: 🇩🇪 *„einen
Detektor, der als Teil von RAP regulär mitläuft, nicht als separates Tool."*

**And the seed still names its targets, never their ids** (aide-rap#513). A row says
`"subject_entity": "ProductType", "subject_id": "Browser"` and the loader swaps in the id, exactly
as it does for an ordinary foreign key. Without that, this change would have traded a duplication
bug for a seed file nobody could maintain — ids shift the moment a referenced seed is reordered.
It was the one real blocker, and it turned out not to be blocked by the rest of the polymorphic
work at all.

*The first design is recorded rather than deleted because the correction is the lesson: the six
FKs were right by the book and wrong in practice, and only loading the data twice showed it.*

**The grammar is why this is not simply a second `name` column.** German needs the gender to
choose between „der", „die" and „das", and the genitive to say „ein Teil einer Webadresse".
Those are properties of the WORD in that language, not of the thing — which is why they live
beside the translated noun and not on the entity.

**An absent row is not an error.** It means the English term is used in that language too, which
is true of a great many IT words — „Browser", „Router", „Server". The reader gets the English
word, correctly, because nobody translates it either. `name` and `purpose` therefore fall back to
the referenced record; `gender` and `genitive` do not, because there is no English gender to
inherit.

**Uniqueness is now a declared key**, which is the whole point of the change above:
`uk:1` over `(subject_entity, subject_id, language)`. All three are always set, so the index is
real and the seed loader can recognise a row it has already written.

`tools/test-translation.js` stays, narrowed to what the key does not say: that a row names an
entity the model knows, and that the name in the seed resolves to a record. A unique key cannot
check either — it only knows that two rows differ.

## Attributes

```json
[
{"name":"subject_entity","type":"EntityKind","uk":1,"description":"WHICH KIND of record this row translates. Half of a polymorphic reference — the other half is `subject_id`, and the two are declared together in the H1 line so the CRUD table renders them as one navigable cell","example":"StorageMedium"},
{"name":"subject_id","type":"int","uk":1,"description":"Its id, in the table `subject_entity` names. A SEED writes the NAME here and the loader swaps in the id (aide-rap#513), exactly as it does for an ordinary foreign key — a raw id in a seed file shifts the moment the referenced seed is reordered","example":7},
{"name":"language","type":"Language","uk":1,"description":"Which language this wording is in","example":"de"},
{"name":"name","type":"string","description":"The word in that language — what the learner is meant to end up knowing","example":"Suchmaschine"},
{"name":"purpose","type":"longString","optional":true,"description":"What it is FOR, in that language, in one sentence a layperson understands. A PREDICATE and lower-case, like the English one it stands in for — it is substituted into several frames and only a predicate fits them all","example":"führt ein Verzeichnis von Webseiten und findet Seiten darin — und ist selbst eine Website"},
{"name":"looks_like","type":"longString","optional":true,"description":"How to recognise the thing by eye, in that language. The one field here written for somebody LOOKING rather than reading, and it belongs in a translation for the same reason `purpose` does: a sentence describing a shape is prose, not a measurement","example":"eine quadratische Plastikhülle, etwa neun Zentimeter breit, mit einem verschiebbaren Metallschieber"},
{"name":"gender","type":"Gender","optional":true,"description":"Grammatical gender of the noun, where the language has one. Both articles are derived from this one value, so „der\" and „ein\" cannot disagree about a word","example":"f"},
{"name":"genitive","type":"string","optional":true,"description":"The noun in the GENITIVE, where the language inflects it. Stored and not derived: the ending follows a rule with exceptions — „des Browsers\", „eines Office-Pakets\", but „einer Suchmaschine\" unchanged — and a rule with exceptions would put a wrong sentence in front of a learner. Absent means the name is already the genitive form, which holds for every feminine noun and for English","example":"Office-Pakets"},
{"name":"note","type":"longString","optional":true,"description":"A true remark in that language, shown after an answer","example":"Viele stellen eine Suchmaschine als Startseite des Browsers ein — daher wirken die beiden wie ein Ding"}
]
```


