# ProductTypeText [reference_data]

[LABEL=concat(product_type_id, ' · ', language)]
[PLURAL=de:Übersetzungen en:Translations]

The same kind in another language, plus the grammatical gender. A missing row falls back to the English parent.

## Why only this entity has translations

What a [ProductType](ProductType.md) is called in one language, and what its purpose reads like there.

**Only this entity has translations, and the reason is grammatical rather than technical.** `Product` and `Company` carry PROPER NAMES — Chrome is Chrome in every language, Google is Google. `ProductType` carries COMMON NOUNS — *browser*, *search engine*, *spider* — and those are the words the learner is here to sort out. A German question that reads „Wie heißt der **Search engine** von Microsoft?" teaches the wrong thing in the middle of teaching the right one; it was the first sentence the generator produced, and it is why this entity exists.

**English stays on the parent.** The model is English like every repo artefact (§31), so `ProductType.name` remains the label everywhere RAP shows a record — the data-model diagram, the FK picker, the CRUD list. A translation is an ADDITION, and a language with no row falls back to the parent: a missing German term shows the English one, which is legible, rather than an empty question, which is not.

## Attributes

```json
[
{"name":"product_type","type":"ProductType","owner":true,"autoFilter":true,"uk":1,"description":"The type this wording belongs to","example":"Search engine"},
{"name":"language","type":"Language","uk":1,"description":"Which language this wording is in","example":"de"},
{"name":"name","type":"string","description":"The common noun in that language — the word the learner is meant to end up with","example":"Suchmaschine"},
{"name":"purpose","type":"string","description":"What it is for, in that language, in one sentence a layperson understands","example":"Führt ein Verzeichnis von Webseiten und findet Seiten darin — und ist selbst eine Website"},
{"name":"genitive","type":"string","optional":true,"description":"The noun in the GENITIVE, where the language inflects it — „Office-Pakets\", „Prozessors\", but „Suchmaschine\" unchanged. Stored and not derived: the ending follows a rule with exceptions, and a rule with exceptions would put a wrong sentence in front of a learner. Absent means the name is already the genitive form, which is true for every feminine noun and for English","example":"Office-Pakets"},
{"name":"gender","type":"Gender","optional":true,"description":"Grammatical gender of the noun, where the language has one. Both articles are derived from it — a question that says „ein Suchmaschine\" teaches carelessness while teaching a distinction","example":"f"},
{"name":"note","type":"string","optional":true,"description":"A true remark in that language, shown after an answer","example":"Viele stellen eine Suchmaschine als Startseite des Browsers ein — daher wirken die beiden wie ein Ding"}
]
```
