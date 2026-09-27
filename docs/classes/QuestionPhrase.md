# QuestionPhrase [reference_data]

[LABEL=concat(template_id, ' · ', language)]
[PLURAL=de:Formulierungen en:Question phrases]

The wording of one template in one language, with the placeholders its roles fill.

## An explanation carries a FACT, not a moral

The `manufacturer` explanation used to end with a maxim: *„Der Hersteller ist nicht dasselbe
wie das Ding, das er herstellt."* True, and worthless — it is the reason the question exists,
which the reader has just answered, restated at them. A sentence that tells someone what they
were supposed to learn does not teach it.

So an explanation has one job beyond naming the right answer: **give a second fact the reader
did not have.** Here that is the product's TYPE, which is why the phrase carries a `{type}`
role of its own:

> *Wer stellt Google Search her?* → **Google Search ist eine Suchmaschine von Google.**

Two facts in one line, and the confusion the question is aimed at — maker versus thing —
dissolves by being shown rather than by being named. The architect's wording for it, on
2026-09-27: *„Anstelle des generischen Nachsatzes sollten wir eine Zusatzinformation geben."*

The test for any new phrase: **strike out the answer. Is anything left that the reader did not
already know?** If not, the sentence is a moral, and the model almost always holds the fact it
should be carrying instead — a type, a maker, an example.

Applied to all four templates the same evening, because three of them failed it:

| Question asks for | The new fact in the explanation | Reads |
|---|---|---|
| the maker | the **type** | *Bing ist eine Suchmaschine von Microsoft.* |
| the product of a company | what the type is **for** | *Firefox ist der Browser von Mozilla. Was ein Browser tut: Zeigt Webseiten an.* |
| the name for a purpose | an **example** the reader has held | *Das ist ein Browser, zum Beispiel Chrome.* |
| yes or no | the **maker** | *Chrome ist ein Browser von Google.* |

The last row is the one that needed a second look. On a **no** the right type is already the
new fact, and the sentence was fine; on a **yes** it restated the question exactly. One
sentence carries both cases because the maker is new either way — so there is no branch, and
no second phrasing to keep in step with the first.

The example is deliberately the **first** product of its kind, not a random one: a reader who
meets the same question twice should meet the same example, or the example is noise.

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
