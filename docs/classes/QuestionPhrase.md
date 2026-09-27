# QuestionPhrase [reference_data]

[LABEL=concat(template_id, ' · ', language)]
[PLURAL=de:Formulierungen en:Question phrases]

The wording of one template in one language, with the placeholders its roles fill.

## The placeholders, and the articles that had to join them

The wording of one [QuestionTemplate](QuestionTemplate.md) in one language.

**The model is English, the questions are not.** Everything else in this system — entity names, attributes, the facts themselves — is English, because that is what a repo artefact is (§31). A question is the one thing a learner actually reads, so it exists once per language and the set is meant to grow.

The text carries the role placeholders `{subject}` and `{object}`; anything else in it is prose. A language with grammatical gender also has `{der_object}` and `{ein_object}` — the definite and indefinite article of whatever noun lands in `{object}`, derived from the gender on [ProductTypeText](ProductTypeText.md). They were added the moment the German phrasings produced „Wie heißt **der** Suchmaschine" and „Ist Chrome **ein** Suchmaschine": a quiz that teaches a distinction while getting the article wrong undermines itself. An English phrase simply does not use them. A phrase whose placeholders do not match its template's declared roles is a defect the generator can see, which is the point of declaring the roles at all.

## Attributes

```json
[
{"name":"template","type":"QuestionTemplate","owner":true,"autoFilter":true,"uk":1,"description":"The kind of question this wording belongs to","example":"manufacturer"},
{"name":"language","type":"Language","uk":1,"description":"Which language this wording is in","example":"de"},
{"name":"text","type":"string","description":"The question, with {subject} and {object} where the records go","example":"Wer ist der Hersteller von {subject}?"},
{"name":"explanation","type":"string","optional":true,"description":"One sentence shown after the answer — why the right answer is right. Where a type is commonly confused with another, this is where that is addressed, as an observation and never as a stored falsehood","example":"Mozilla stellt Firefox her; Mozilla selbst ist kein Browser, sondern eine Organisation."}
]
```
