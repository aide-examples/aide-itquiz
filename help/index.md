# itquiz

A quiz against the confusions a layperson carries about IT terms.

## What it is for

Some words get mixed up so reliably that the mix-up is the normal state: *browser* and *search
engine*, a maker and the thing it makes, the name of a program and the name of the company
behind it. itquiz does not name those confusions and does not correct them. It stores **only
correct facts** — what a kind of thing is FOR — and builds questions out of them. Someone who
believes a browser and a search engine are the same thing meets three sentences that are each
true and cannot all be true of one thing, and sorts it out themselves.

## Answering questions

Sign in and the quiz opens by itself — there is nothing to navigate to. One question at a time,
with two to four answers. Pick one and you are told at once whether it was right, and why, in
one sentence.

- **DE / EN** at the top right switches the language of the questions. The choice is remembered
  on this device.
- **The keyboard works**: the digits `1`–`4` pick an answer, `Enter` moves on. Nothing needs the
  mouse.
- **The counter** beside the language buttons is right-answers out of asked, for this session. It
  is not a score and there is no leaderboard.

Every question you are shown is recorded — which one, when, and how it went. You cannot see
anybody else's, and nobody else can see yours.

## Adding facts (operators)

An admin reaches the ordinary RAP tables, and the model is small on purpose:

| Table | What belongs in it |
|---|---|
| **Companies** | Whoever makes something. |
| **Product types** | A KIND of thing, and its `purpose` — the sentence that says what it is FOR. This is the field the whole quiz rests on. |
| **Translations** | The same kind in another language, plus its grammatical gender. |
| **Products** | One actual thing, of one type, from one maker. |
| **Question templates** | A KIND of question. Adding one is a row, not a release. |
| **Question phrases** | The wording of a template in one language. |

**Write the purpose as what the thing DOES, not as what it is called.** „A search engine is a
search engine" teaches nothing; „keeps an index of web pages, and is itself a website" is the
whole lesson. The questions are only ever as good as those sentences.

**A German term needs its gender.** Without it a question says „ein Suchmaschine", and a quiz
that gets the article wrong while teaching a distinction undermines itself. Both articles are
derived from the one gender, so they cannot disagree.

## What it deliberately does not do

- **No wrong facts are stored anywhere** — not as distractors, not as „common mistakes". A wrong
  sentence in a database is a wrong sentence someone will read.
- **No score, no levels, no streaks.** The history exists so the app knows what it has asked,
  not to rank anybody.
