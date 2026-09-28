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

## A „no" says WHY, and the model already knows

A correct „no" leaves the reader exactly where their confusion was. *„Ist Apache OpenOffice ein
Textprogramm?"* — no, it is an office suite. True, and it does not say what a word processor and
an office suite have to do with each other, which is the thing worth learning.

The model holds that relation in `ProductType.part_of`, so the sentence is **derived, never
written**. Two shapes, and they are mutually exclusive:

| The two types stand as | The sentence |
|---|---|
| one is part of the other | *Ein Textprogramm ist Teil eines Office-Pakets.* |
| both parts of a third | *Ein Textprogramm und eine Tabellenkalkulation sind beide Teil eines Office-Pakets — Geschwister unter einem Dach, nicht dasselbe Ding.* |
| nothing in particular | nothing — there is no true sentence to add |

The **part** shape reads the same from either end. Asked *„Textprogramm"* about an office suite
or *„Office-Paket"* about a word processor, the answer is the same sentence, because the
relation is the fact and the question only chose which end to enter it from.

The **sibling** shape is the commoner one and was added a day later, on the architect's
prompting — the first version stayed silent on *„Ist OpenOffice Calc ein Textprogramm?"*,
where spreadsheet and word processor are not parts of each other but of the same suite.

Both are **optional clauses**, so neither needs to know about the verdict: on a *yes* the two
types are the same type, no relation exists between a thing and itself, and the clause removes
itself. That is the shape to aim for — a rule that falls out rather than one that is switched
on.

> *Lehrgeld, the same hour:* the sibling test was written as „same parent" and shipped *„Ein
> Textprogramm und ein Textprogramm sind beide Teil eines Office-Pakets."* On a yes the two
> types ARE the same one, which is trivially its own sibling. The part rule gets that for free
> — a thing is not part of itself — and this one has to say so. Found by running the case, not
> by reading the code.

## Context is welcome; a moral is not

The rule at the top of this file forbids restating the question as a lesson. It does **not**
forbid helping the reader build a picture — the two are easy to confuse and the difference is
worth stating, because the architect asked for more of the second on 2026-09-28: 🇩🇪 *„Alles was
dem Menschen hilft, Kontext aufzubauen, was Metaphern enthält usw. ist willkommen."*

A **moral** tells the reader what they were supposed to conclude: *„Der Hersteller ist nicht
dasselbe wie das Ding."* It adds nothing, because it is the question read backwards.

**Context** gives them somewhere to put the fact: a whole it belongs to, a sibling it stands
beside, what the kind is for, an example they have held. *„Geschwister unter einem Dach"* is a
metaphor and it earns its place — it names a relation the reader can carry to the next pair
they meet, which a bare *„beide sind Teil eines Office-Pakets"* does not.

The test is unchanged and still decides it: **strike out the answer. Is anything left the
reader did not already know?** A metaphor passes when it makes a real relation graspable, and
fails when it decorates one they have just been told.

## The two marks a phrase may carry, and no more

A phrase is data: an operator writes it in the Question-phrases table, and the page escapes it
before doing anything else. On top of that escape it honours exactly two marks:

| Mark | Becomes | What it is for |
|---|---|---|
| a newline | a line break | putting a supplement on a line of its own |
| `*…*` | *italics* | setting an explanatory lead-in apart from the answer |

Which is one form, really:

> Android is the Operating system made by Google.
> *What an Operating system does:* Runs a device and the programs on it.

**Why both, and why only these.** An explanation that carries a second fact (§ *An explanation
carries a FACT, not a moral*) has two parts doing different jobs — the answer, and the aside
that teaches. Run together they read as one sentence and the aside is lost in it; set apart,
the eye finds each in one pass. The architect asked for exactly this on 2026-09-27:
„Erklärende Einleitungen zu ergänzenden Informationen ('Was ein xxx tut:') sollten kursiv
gesetzt sein und in einer neuen Zeile beginnen."

Two marks and no more, because the alternative is a markup language living in a database
column — and because the escape that runs first is the only thing keeping a phrase from
becoming a script. Whoever needs a third mark should ask whether the phrase is doing a job
that belongs to the page.

**A trap this opened, recorded so it is not re-opened.** The server collapses runs of
whitespace when it fills a phrase — an article placeholder that renders empty leaves two
spaces. `\s` includes the newline, so the first version of that collapse quietly ate the line
break the phrase had just declared. It now collapses spaces only, and trims the spaces that
hug a newline rather than the newline itself.

## The placeholders, and the articles that had to join them

The wording of one [QuestionTemplate](QuestionTemplate.md) in one language.

**The model is English, the questions are not.** Everything else in this system — entity names, attributes, the facts themselves — is English, because that is what a repo artefact is (§31). A question is the one thing a learner actually reads, so it exists once per language and the set is meant to grow.

The text carries the role placeholders `{subject}` and `{object}`; anything else in it is prose. A language with grammatical gender also has `{der_object}` and `{ein_object}` — the definite and indefinite article of whatever noun lands in `{object}`, derived from the gender on [Translation](Translation.md). They were added the moment the German phrasings produced „Wie heißt **der** Suchmaschine" and „Ist Chrome **ein** Suchmaschine": a quiz that teaches a distinction while getting the article wrong undermines itself. An English phrase simply does not use them. A phrase whose placeholders do not match its template's declared roles is a defect the generator can see, which is the point of declaring the roles at all.

## Attributes

```json
[
{"name":"template","type":"QuestionTemplate","owner":true,"autoFilter":true,"uk":1,"description":"The kind of question this wording belongs to","example":"manufacturer"},
{"name":"language","type":"Language","uk":1,"description":"Which language this wording is in","example":"de"},
{"name":"text","type":"longString","description":"The question, with {subject} and {object} where the records go","example":"Wer ist der Hersteller von {subject}?"},
{"name":"explanation","type":"text","optional":true,"description":"One sentence shown after the answer — why the right answer is right. Where a type is commonly confused with another, this is where that is addressed, as an observation and never as a stored falsehood","example":"Mozilla stellt Firefox her; Mozilla selbst ist kein Browser, sondern eine Organisation."}
]
```
