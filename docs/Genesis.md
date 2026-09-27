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

**One line of the brief is false**, and the decision taken on it shapes the whole system:
*„Ein anderer Name für Browser ist Suchmaschine"* is not a fact and does **not** enter the
model. The architect's ruling (2026-09-27):

> Wir lassen das ganze Thema Irrtümer und Verwechslung weg. Wir erfassen nur korrekte Fakten.
> […] Viele Leute stellen als HOMEPAGE des Browsers eine bestimmte Search-Engine ein, und
> dadurch verschmelzen Browser und Search Engine in ihrer Wahrnehmung. Wir machen uns diese
> Gleichsetzung nicht zu eigen, aber thematisieren sie möglicherweise durch unsere Fakten und
> durch Fragen, die wir daraus ableiten.

So there is no `Misconception` entity and no wrong statement anywhere in the store. The
confusion lives in the READER, and the cure is a correct fact that distinguishes the two
things — *a browser displays pages, a search engine is an index of pages and is itself a
website* — plus a question that makes the distinction visible. A model that carried errors
would have to be trusted to say which of its rows are true, and that trust is the one thing a
teaching system cannot ask for.

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

## 5 · The model, as decided (2026-09-27)

**Typed entities plus declared question templates** — not a triple store. The reason is not
taste: „Ist Chrome eine Plattform?" is a question about a TYPE, and only a model that knows
types can answer it without comparing strings. RAP's editor, its foreign keys and its data-model
diagram then show the subject matter itself, which is what a teaching system should look like
from the inside as well.

### Three entities carry the facts

| Entity | What it is | Attributes a first pass names |
|---|---|---|
| **Company** | who makes things | `name`, `icon` (medium), `note` |
| **Category** | what KIND of thing something is — Browser, Suchmaschine, Spider, Betriebssystem, Gerät | `name`, `purpose` (one sentence: *what it is for*), `note` |
| **Item** | the concrete thing — Chrome, Firefox, Google Suche, Googlebot, Android | `name`, `category` → Category, `maker` → Company, `icon` (medium), `note` |

`Category.purpose` is the load-bearing field. It is what makes „Wie nennt man ein Ding, mit dem
man Webseiten betrachtet?" answerable, and it is where the distinctions that matter are written:

> **Browser** — zeigt Webseiten an.
> **Suchmaschine** — führt ein Verzeichnis von Webseiten und ist selbst eine Website.
> **Spider** — durchsucht Webseiten und baut daraus das Verzeichnis einer Suchmaschine.

Three correct sentences, and the confusion they dissolve is never named.

### Questions come from declared templates, not from code

| Template | Question | Answer | Distractors |
|---|---|---|---|
| `Item.maker` | Wer ist der Hersteller von **{item}**? | its Company | other Companies |
| `Item.category` | Wie heißt **der {category} von {company}**? | the Item | Items of other categories |
| `Category.purpose` | Wie nennt man ein Ding, das **{purpose}**? | the Category | other Categories |
| `Item.category` (yes/no) | Ist **{item}** ein **{category}**? | ja / nein | a category the item does NOT have |

Every one of the architect's five example questions is produced by one of these four, and a new
kind of question is a row rather than a commit. The distractors come from the same level of the
model — other companies for a maker question, other categories for a category question — which
is exactly where a layperson's confusion sits, without the system ever holding a wrong sentence.

### What is deliberately NOT in the first slice (§34, §43)

- **A relation between categories** („ein Spider erzeugt den Verzeichnis einer Suchmaschine" as
  a modelled link rather than a sentence in `purpose`). The prose carries it for now; the day a
  question needs to walk from one category to another, it earns its own entity.
- **The homepage observation** („viele stellen eine Suchmaschine als Startseite ein"). A true
  and useful fact, and it belongs — as a `note`, not as a fifth entity.
- Devices and platforms. The model already fits them (`Category` = Gerät, Betriebssystem);
  the first slice stays with browsers, search engines, spiders and their makers, because that
  is the confusion the architect actually described.

### What the app remembers

Per user, and nothing more: which question was asked, when, what was answered, whether it was
right. No score, no leaderboard — the brief says so, and a history is what lets the app avoid
repeating itself.

## How a player signs in — a tap, and no password at all

`anna` carries a symbol (`_users.avatar` = 🦉) and no password. The `player` role is flagged
`_roles.passwordless`, her account says `sign_in = passwordless`, and the login screen offers
her as a **Quick login** button that signs her in and drops her straight into the quiz through
the login action.

**Why no password, on an account that has real data behind it.** There is nothing to protect
on a player account that a password would protect. The role holds read on six fact tables that
every player sees anyway, `admin: false`, and no permission at all on `AskedQuestion` — the one
thing that is personal, and the one thing the entity permissions deliberately do not grant. The
history is reachable only through the system route, which takes the owner from the session. So
the password would guard nothing and cost the very audience this system is for a step they
often cannot take: someone who mixes up a browser and a search engine is not helped by being
asked to type a credential on a phone.

**`picker_order` must stay empty on such an account**, and this is not obvious. The account
picker and the quick login render into the same section of the login dialog, fire-and-forget,
so the one whose request answers last wins — a race, not a precedence. With both set, the
button appeared under „then enter password below" and waited for a password the account no
longer has. Filed as aide-rap#494; until it is decided there, one of the two columns, never
both.

