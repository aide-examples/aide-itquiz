# AskedQuestion [operational_event]

[LABEL=concat(user, ' · ', template_id)]
[PLURAL=de:Gestellte Fragen en:Asked questions]

What one learner was asked, and how it went. One row per question shown — the app's whole memory.

**No score, no leaderboard.** The brief is explicit, and the history exists for a different
reason: so the app does not ask again what it has just asked, and so a learner can see what they
keep getting wrong.

**The records are held by real foreign keys, one optional column per possible target**
(`subject_product`, `subject_product_type`, `subject_company`) with an `AtMostOne` constraint —
RAP's polymorphic reference. Not a `kind + id` pair: that would have no referential integrity,
so a deleted product would leave a log row pointing at a number, and the history would quietly
start lying (see `rap:features/polymorphic-references.md`).

## Attributes

```json
[
{"name":"user","type":"user","description":"Who was asked — checked against an active login at write time","example":"anna"},
{"name":"template","type":"QuestionTemplate","description":"Which kind of question was asked","example":"manufacturer"},
{"name":"language","type":"Language","description":"Which wording was shown","example":"de"},
{"name":"subject_product","type":"Product","optional":true,"description":"The record the question was about, when it is a product","example":"Firefox"},
{"name":"subject_product_type","type":"ProductType","optional":true,"description":"…when it is a type","example":"Browser"},
{"name":"subject_company","type":"Company","optional":true,"description":"…when it is a company","example":"Mozilla"},
{"name":"object_product","type":"Product","optional":true,"description":"The second record, where the question needs one","example":"Chrome"},
{"name":"object_product_type","type":"ProductType","optional":true,"description":"…when it is a type","example":"Search engine"},
{"name":"object_company","type":"Company","optional":true,"description":"…when it is a company","example":"Google"},
{"name":"asked_at","type":"timestamp","description":"When it was shown","example":"2026-09-27 08:15:00"},
{"name":"quality","type":"AnswerQuality","description":"How it turned out","example":"correct"},
{"name":"given_answer","type":"string","optional":true,"description":"What the learner picked, as it was shown to them — so a wrong answer can be read back without recomputing the options","example":"Google"}
]
```

## Constraints
AtMostOne(subject_product, subject_product_type, subject_company)
AtMostOne(object_product, object_product_type, object_company)
