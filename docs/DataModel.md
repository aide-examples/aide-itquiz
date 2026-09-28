# Data Model

itquiz holds facts about IT things, and derives its questions from them.

## Entity Descriptions

Entity definitions are stored in separate files under [classes/](classes/).

### Facts
<div style="background-color: #E0E7FF; padding: 10px;">

The subject matter, and the whole didactic weight sits on one field — `ProductType.purpose`,
the sentence that says what a kind of thing is FOR. A layperson who mixes up a browser and a
search engine has never been told what either is for; naming them again does not help, and
saying what each one does is the one thing that might.

| Entity | Description |
|--------|-------------|
| [Company](classes/Company.md) | An outfit that makes things. Here so a maker can be told apart from the thing it makes — the confusion behind „Google" meaning four different things. |
| [ProductType](classes/ProductType.md) | A KIND of thing, and its purpose. The English wording lives here. |
| [ProductTypeText](classes/ProductTypeText.md) | The same kind in another language, plus what the language needs to build a correct sentence about it: the grammatical gender, and the genitive form where the noun inflects. A missing row is not an error: it means the English term is used in that language too, which is true of a good many IT words. |
| [Product](classes/Product.md) | One actual thing, of one kind, from one maker. |
| [FileFormat](classes/FileFormat.md) | A KIND of file, known by the letters after the dot. The other half of what a layperson gets wrong: not what a thing IS, but what it can OPEN. |
| [Protocol](classes/Protocol.md) | An AGREEMENT two programs follow so they can talk — HTTP, HTTPS, MQTT, SIP. Its own entity and not a kind of format: a program *opens* a file and *speaks* a protocol, and one table with a discriminator is what the architecture guideline warns against. |
| [FormatSupport](classes/FormatSupport.md) | What one program can do with one kind of file — view or edit. An entity and not a bare junction, because *what* it can do is the fact the questions are built on. |
</div>

### Questions
<div style="background-color: #FEF3C7; padding: 10px;">

How a fact becomes a question. Declared as data rather than written in code, so a new kind of
question is a row and not a commit — and so the wording can be separated from the kind and
carried once per language.

| Entity | Description |
|--------|-------------|
| [QuestionTemplate](classes/QuestionTemplate.md) | A KIND of question — which roles it needs and what it asks for. Carries no wording at all. |
| [QuestionPhrase](classes/QuestionPhrase.md) | One wording of one template in one language, with the placeholders the roles fill. Also the articles: without a declared gender a German question says „ein Suchmaschine" and undermines the very distinction it is teaching. |
</div>

### History
<div style="background-color: #DCFCE7; padding: 10px;">

One row per question put to one person. It is a link table and nothing else: what was asked,
of whom, about which records, and how it went.

| Entity | Description |
|--------|-------------|
| [AskedQuestion](classes/AskedQuestion.md) | Written by the system route, never through CRUD — the owner comes from the session, so one player cannot reach another's history. |
</div>

## Why the history is one table and not several

A question involves a template and one or two records, and those records are of different kinds
— a product, a type, a company. The obvious shapes are both wrong: a table per template kind
multiplies with every new question, and a `kind` + `id` pair is a foreign key the database
cannot check, so it starts lying the day a record is deleted.

So the polymorphic role is N optional FK columns with an `AtMostOne` constraint, which is what
RAP offers for exactly this (see `rap:features/polymorphic-references.md`). Every column is a
real foreign key; the constraint is what says only one of them is filled.
