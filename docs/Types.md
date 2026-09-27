# Types

Type definitions for itquiz.

## Enum Types

### EntityKind

Which kind of record fills a placeholder in a question template. The set is the model's own
entity names, so a template can say *what* it asks about without the generator knowing anything
about the subject matter.

| Internal | External | Description |
|----------|----------|-------------|
| Product | Product | A concrete thing — Chrome, Google Search, Googlebot |
| ProductType | Product type | A kind of thing — browser, search engine, spider |
| Company | Company | Who makes it — Google, Mozilla |

### Language

The languages a question can be asked in. The model itself is English; only the question texts
are multilingual, because they are what a learner reads.

| Internal | External | Description |
|----------|----------|-------------|
| de | Deutsch | German |
| en | English | English |

### AnswerQuality

How an answer turned out. Three values and not two: a question that was shown and skipped is a
different fact from one answered wrongly, and an app that cannot tell them apart will ask the
skipped one as if it had been failed.

| Internal | External | Color | Description |
|----------|----------|-------|-------------|
| correct | Correct | #16a34a | Answered correctly |
| wrong | Wrong | #dc2626 | Answered incorrectly |
| skipped | Skipped | #9ca3af | Shown, not answered |
