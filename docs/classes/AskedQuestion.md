# AskedQuestion [operational_event] [POLY_FK=subject_entity:subject_id] [POLY_FK=object_entity:object_id]

[LABEL=concat(user, ' · ', template_id)]
[PLURAL=de:Gestellte Fragen en:Asked questions]

What one learner was asked, and how it went. One row per question shown — the whole memory of the app.

## Why no score, and why real foreign keys

What one learner was asked, and how it went. One row per question shown — the app's whole memory.

**No score, no leaderboard.** The brief is explicit, and the history exists for a different reason: so the app does not ask again what it has just asked, and so a learner can see what they keep getting wrong.

**The records are held by real foreign keys, one optional column per possible target** (`subject_product`, `subject_product_type`, `subject_company`) with an `AtMostOne` constraint — RAP's polymorphic reference. Not a `kind + id` pair: that would have no referential integrity, so a deleted product would leave a log row pointing at a number, and the history would quietly start lying (see `rap:features/polymorphic-references.md`).

## Why the reference is polymorphic and not six foreign keys

Six FK columns is what this carried until 2026-09-29 — product, type and company, twice — from a
time when those were the only three things a question could be about. The model has since gained
`FileFormat`, `FormatGroup`, `Protocol`, `Connector`, `Concept` and `StorageMedium`, and a
question about a DVD was recorded with **no subject at all**. The helper that filled those columns
produced a key named `undefined` for any kind it did not know, and nothing errored: the row was
written, the answer counted, and the history quietly said the question was about nothing.

Fifteen columns would have fixed it. Two do, and RAP's own `Audit` and `BackgroundTask` use
exactly this shape for exactly this reason — a record that may point at any entity.

**The price is referential integrity**, which the database can no longer enforce here: nothing
stops a row naming a record that has since been deleted. Accepted deliberately, and for this
entity it is barely a price — a history of what somebody was asked SHOULD survive the deletion of
what they were asked about. A `Product` removed from the inventory does not un-ask the question.
That is the same reading RAP applies to its own audit trail, and it is why the integrity check
proposed in aide-rap#514 excludes a pair that declares no target list.

**Unlike [Translation](Translation.md), nothing blocked this.** That one waits on aide-rap#513,
because a seed row must be able to name its target and the loader cannot resolve a name into a
polymorphic id. This entity is never seeded — it is written at runtime from ids the application
already holds — so the obstacle does not apply. It goes first, and proves the pattern (#2).

## Attributes

```json
[
{"name":"user","type":"user","description":"Who was asked — checked against an active login at write time","example":"anna"},
{"name":"template","type":"QuestionTemplate","description":"Which kind of question was asked","example":"manufacturer"},
{"name":"language","type":"Language","description":"Which wording was shown","example":"de"},
{"name":"subject_entity","type":"EntityKind","optional":true,"description":"WHICH KIND of record the question was about. Half of a polymorphic reference — the other half is `subject_id`, and the two are declared together in the H1 line so the CRUD table renders them as one navigable cell","example":"StorageMedium"},
{"name":"subject_id","type":"int","optional":true,"description":"Its id, in the table `subject_entity` names. An `int` although nobody computes with it: it JOINS, which is the one exception the numbers-are-for-computing rule makes","example":7},
{"name":"object_entity","type":"EntityKind","optional":true,"description":"The second record's kind, where the question needs one — the product a format can be opened with, the runner-up in a capacity comparison","example":"Product"},
{"name":"object_id","type":"int","optional":true,"description":"Its id, in the table `object_entity` names","example":12},
{"name":"asked_at","type":"timestamp","description":"When it was shown","example":"2026-09-27 08:15:00"},
{"name":"quality","type":"AnswerQuality","description":"How it turned out","example":"correct"},
{"name":"given_answer","type":"string","optional":true,"description":"What the learner picked, as it was shown to them — so a wrong answer can be read back without recomputing the options","example":"Google"}
]
```

## Constraints
AtMostOne(subject_product, subject_product_type, subject_company)
AtMostOne(object_product, object_product_type, object_company)
