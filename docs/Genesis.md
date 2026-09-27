# Genesis — itquiz

The dialogue that produced this system, recorded as it happens (project CLAUDE.md §
*Record the Genesis as durable teaching artifacts*).

## 1 · What it is for

> „Es soll absoluten Laien helfen, Begriffe gedanklich zu ordnen, die oft durcheinandergehen."

Not a quiz *about* IT. A quiz against the **confusions** a layperson carries: browser vs.
search engine, manufacturer vs. product, platform vs. application. The questions exist to make
a wrong mental filing visible, so the right one can take its place.

That purpose decides more of the model than any feature list, and it is why the facts are
modelled at all rather than typed as question/answer pairs: a confusion is a relation between
two *categories*, and only a model that knows the categories can produce it.

## 2 · The brief, verbatim (2026-09-27)

> Wir bauen eine Systematik aus Fakten auf und erzeugen dann multiple choice Fragen dazu.
>
> Google ist ein großer IT-Anbieter.
> Mit einem Browser kann man Webseiten suchen und betrachten.
> Google bietet einen Browser an.
> Der Browser von Google heißt Chrome.
> Ein anderer Name für Browser ist Suchmaschine.
> Der Browser von Mozilla heißt Firefox.
>
> Denkbar wären Entities wie Product (name=Chrome, icon als Medium dazu), ProductType (browser),
> ProductType.purpose (search and visit websites), Company (Google), Product.manufacturer
> (Chrome pointing at Google) usw. Man kann das Ganze auf Devices (Handy, Laptop, Server) und
> Platforms/OS ausdehnen (Android, Windows, Unix) usw.
>
> Fragen könnten lauten:
> Wie nennt man ein Ding, mit dem man Webseiten besuchen kann?
> Wie heißt der Browser von Google?
> Ist Mozilla ein Browser?
> Ist Chrome eine Plattform?
> Wer ist der Hersteller von Firefox?
>
> Das Ganze soll einfach zu bedienen sein, auch auf dem Handy. Die Gaming Komponente ist nicht
> so wichtig (HighScores etc.). Man sollte aber je User nachhalten, was man ihn gefragt hat, und
> was er richtig und falsch beantwortet hat.

**One line of the brief is not a fact but a misconception**, and that is the most important
thing in it: *„Ein anderer Name für Browser ist Suchmaschine"* is **false**, and it is exactly
the kind of sentence the app exists to correct. The model therefore has to be able to hold a
wrong belief as such — not merely the true statements.

## 3 · Use cases (F-Contract opens with these — CLAUDE.md §5)

- A layperson opens the app on a phone, gets a question, answers it, and is told at once whether
  it was right — and **why** the wrong option was wrong, in one sentence.
- The app does not ask what it has just asked: what a user was asked, and how they answered, is
  kept per user.
- The operator adds a fact (a new product, a new manufacturer) and new questions exist without
  anybody writing a question.

## 4 · Decisions taken

| | |
|---|---|
| Repository | own repo `aide-itquiz`, symlinked into `app/systems/itquiz` (like `aide-knight`) |
| Content language | German — the audience is a German-speaking layperson |
| Gaming | no high scores, no leaderboard; per-user history of asked/right/wrong instead |
| Device | phone first |

## 5 · Open — to be decided before the model is written

1. **How a fact is carried**: typed entities with foreign keys, a subject–predicate–object
   table, or typed entities plus declared question templates.
2. **How a confusion is carried**: distractors drawn from sibling categories automatically, or
   a declared pair ("these two are confused, and here is why they differ").
3. **How wide the first slice is**: browsers and their makers only, or devices and platforms
   from the start.
