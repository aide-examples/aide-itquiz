# QuestionTemplate [reference_data]

[LABEL=key]
[PLURAL=de:Fragetypen en:Question templates]

One KIND of question, declared as data: which records fill its roles, and where the right answer comes from. No wording.

## Why a template rather than code

One KIND of question, declared as data. A template says which records fill its placeholders and where the right answer comes from; the wording itself lives in [QuestionPhrase](QuestionPhrase.md), once per language.

**Why a template rather than code.** A new kind of question is then a row, not a commit — and whoever knows the subject matter can add one without anybody building. That is the same reading the framework applies elsewhere: what the model can answer generally should not be answered N times in a program (global CLAUDE.md §48).

**The placeholders are ROLES, not entity names** — `{subject}` and `{object}`, never `{product}`. A template already declares which kind fills each role, so a phrase that named the entity would say it twice and the two could disagree. Roles also mean one wording shape serves a question about a product and a question about a company.

## Attributes

```json
[
{"name":"key","type":"string","unique":true,"label":true,"description":"Stable name of this question kind — referenced by the generator and by the answer log","example":"manufacturer"},
{"name":"subject_kind","type":"EntityKind","description":"Which kind of record fills {subject} — the thing the question is ABOUT","example":"Product"},
{"name":"object_kind","type":"EntityKind","optional":true,"description":"Which kind fills {object}, where a question needs a second record (\"Is {subject} a {object}?\"). Empty for the questions that need only one","example":"ProductType"},
{"name":"answer_kind","type":"EntityKind","optional":true,"description":"Which kind the correct answer and its distractors are drawn from. Empty for a yes/no question, whose answers are not records","example":"Company"},
{"name":"note","type":"longString","optional":true,"description":"What this template is for, in the author's words","example":"Separates the maker from the thing made"}
]
```
