# Data Model

itquiz holds facts about IT things, and derives its questions from them.

## Areas

### Facts

The subject matter. Three entities, and the whole didactic weight sits on one field —
`ProductType.purpose`, the sentence that says what a kind of thing is FOR.

- Company
- ProductType
- Product

### Questions

How a fact becomes a question. Declared as data so a new kind of question is a row rather than
a commit; the wording is separate from the kind, once per language.

- QuestionTemplate
- QuestionPhrase

### History

- AskedQuestion
