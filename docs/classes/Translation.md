# Translation [reference_data]

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

**The shape has a name in this framework, and it is not a discriminator.** This is a
**Polymorphic Reference** — RAP's documented pattern for *"points at one of several entities"*:
N optional foreign keys plus an `ExactlyOne` constraint over them
([polymorphic-references.md](rap:features/polymorphic-references.md)). Every reference is a real
FK the database enforces, and the constraint is what makes them one field rather than six. RAP's
own `[POLY_FK=<name>:<id>]` — a type column beside an id column — is the *other* form, and it is
reserved for framework tables whose target is *any* entity at all (`Audit`, `BackgroundTask`);
the same doc lists it as an anti-pattern for domain data, because a column naming a table is not
a foreign key and nothing stops it pointing at a record that has been deleted.

*This was found the slow way: the six FKs were designed from scratch, correctly in substance,
without the pattern's name or its constraint — which cost the pill-bar the edit dialog gives it
for free. §1's lesson exactly: search for the EFFECT (`"points at one of several"`), not for the
solution you are about to write.*

**The grammar is why this is not simply a second `name` column.** German needs the gender to
choose between „der", „die" and „das", and the genitive to say „ein Teil einer Webadresse".
Those are properties of the WORD in that language, not of the thing — which is why they live
beside the translated noun and not on the entity.

**An absent row is not an error.** It means the English term is used in that language too, which
is true of a great many IT words — „Browser", „Router", „Server". The reader gets the English
word, correctly, because nobody translates it either. `name` and `purpose` therefore fall back to
the referenced record; `gender` and `genitive` do not, because there is no English gender to
inherit.

**Uniqueness is checked by a detector, not by a unique key, and that is a framework limit rather
than a choice.** One wording per record per language is the rule. It cannot be declared: `uk`
takes one group number per attribute, so `language` can belong to one composite key and not to
six; and a single composite key over all seven columns would enforce nothing, because SQL counts
rows that differ in a NULL as distinct — which, with five of six references null in every row, is
every pair of them. So `tools/test-translation.js` asserts it instead, and says so out loud here
rather than leaving a reader to infer a guarantee that is not there (§42).

## Attributes

```json
[
{"name":"product_type","type":"ProductType","optional":true,"autoFilter":true,"description":"The kind of thing this row translates — when it is one","example":"Search engine"},
{"name":"file_format","type":"FileFormat","optional":true,"description":"…when it is a file format","example":"PDF"},
{"name":"format_group","type":"FormatGroup","optional":true,"description":"…when it is a group of formats","example":"Bildformat"},
{"name":"protocol","type":"Protocol","optional":true,"description":"…when it is a protocol","example":"HTTPS"},
{"name":"connector","type":"Connector","optional":true,"description":"…when it is a connector","example":"HDMI"},
{"name":"concept","type":"Concept","optional":true,"description":"…when it is one of the notions nobody manufactures","example":"Webadresse"},
{"name":"storage_medium","type":"StorageMedium","optional":true,"description":"…when it is a thing bytes sit on","example":"Floppy disk"},
{"name":"language","type":"Language","description":"Which language this wording is in","example":"de"},
{"name":"name","type":"string","description":"The word in that language — what the learner is meant to end up knowing","example":"Suchmaschine"},
{"name":"purpose","type":"longString","optional":true,"description":"What it is FOR, in that language, in one sentence a layperson understands. A PREDICATE and lower-case, like the English one it stands in for — it is substituted into several frames and only a predicate fits them all","example":"führt ein Verzeichnis von Webseiten und findet Seiten darin — und ist selbst eine Website"},
{"name":"looks_like","type":"longString","optional":true,"description":"How to recognise the thing by eye, in that language. The one field here written for somebody LOOKING rather than reading, and it belongs in a translation for the same reason `purpose` does: a sentence describing a shape is prose, not a measurement","example":"eine quadratische Plastikhülle, etwa neun Zentimeter breit, mit einem verschiebbaren Metallschieber"},
{"name":"gender","type":"Gender","optional":true,"description":"Grammatical gender of the noun, where the language has one. Both articles are derived from this one value, so „der\" and „ein\" cannot disagree about a word","example":"f"},
{"name":"genitive","type":"string","optional":true,"description":"The noun in the GENITIVE, where the language inflects it. Stored and not derived: the ending follows a rule with exceptions — „des Browsers\", „eines Office-Pakets\", but „einer Suchmaschine\" unchanged — and a rule with exceptions would put a wrong sentence in front of a learner. Absent means the name is already the genitive form, which holds for every feminine noun and for English","example":"Office-Pakets"},
{"name":"note","type":"longString","optional":true,"description":"A true remark in that language, shown after an answer","example":"Viele stellen eine Suchmaschine als Startseite des Browsers ein — daher wirken die beiden wie ein Ding"}
]
```

**The `[LABEL=]` on the constraint is what the edit dialog calls the fieldset.** Without it the
label is derived from the members' longest common prefix, and these six have none — so it would
fall back to the rule's own name, *Exactly One*, which tells an editor nothing about what they
are picking. The rule's built-in messages carry both languages, so it needs no
`## Error Messages` row.

*And the `## Constraints` chapter holds rules and nothing else — this paragraph was inside it
for one boot, and the schema parser dutifully reported `Unparseable constraint: "The built-in
messages carry both languages…"`. Exactly the warning #226 added for a marker nobody matches:
a line that means nothing to the parser now says so instead of vanishing.*

## Constraints

ExactlyOne(product_type, file_format, format_group, protocol, connector, concept, storage_medium) [LABEL="Translated record"]
