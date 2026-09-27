# Data Model

itquiz holds facts about IT things, and derives its questions from them.

## Areas

### Facts

The subject matter. Four entities, and the whole didactic weight sits on one field —
`ProductType.purpose`, the sentence that says what a kind of thing is FOR.

The parent carries the English wording; `ProductTypeText` carries a translation per
language, and a missing one falls back to the parent. It also carries the grammatical
gender, because without it a German question says „ein Suchmaschine“ and undermines
the very distinction it is teaching.

- Company
- ProductType
- ProductTypeText
- Product

### Questions

How a fact becomes a question. Declared as data so a new kind of question is a row rather than
a commit; the wording is separate from the kind, once per language.

- QuestionTemplate
- QuestionPhrase

### History

- AskedQuestion
