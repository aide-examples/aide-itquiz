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
| FileFormat | File format | A kind of FILE — .pdf, .odt, .mp3 |
| Protocol | Protocol | An agreement two programs follow — HTTP, MQTT |
| Connector | Connector | The shape of a plug and its socket — HDMI, USB-C |
| FormatGroup | Format group | What a format is a kind of — Bildformat, Kompressionsformat |
| Concept | Concept | Something one reads and types that nobody makes — Webadresse, Domain |
| StorageMedium | Storage medium | A thing bytes sit on — CD-ROM, SSD, SD-Karte |

### FileSupport

What a program can do with a file of a given format. Two values, and the order between them is a
FACT the questions rely on: **`edit` implies `view`.** Nothing edits a file it cannot open, so a
program declared as an editor answers „womit kann man das ansehen?" as well — and one row per
product-and-format is therefore enough. Storing both would be storing the same fact twice, and
the copy is what drifts (global CLAUDE.md §17).

The order of the rows below is the order everywhere (aide-rap#288), and here it is also the
strength: the later value contains the earlier one.

| Internal | External | Description |
|----------|----------|-------------|
| view | View | Opens it and shows it. A PDF reader, a picture viewer, a media player |
| edit | Edit | Opens it, changes it and writes it back — and therefore also shows it |

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

### Level

How far into the subject a record sits. The reason it exists is that this quiz drifted: SIP,
JSON, Socket and BLE are not the same league as Browser, DVD and USB-Stick, and a beginner who
meets them learns that the subject is not for them.

**A question's level is the HIGHEST of the records it names** — derived, never stored on the
question. So „Wofür steht PDF?" is `basic` and „Wofür steht SIP?" is `expert`, from the same
template. That is also why the level sits on the records and not on the templates: a template
asks one kind of question about whatever it is handed.

**The order of these rows is the order of the levels**, and the table's row order is what RAP
sorts an enum by (aide-rap#288). Inserting a fourth level in the middle therefore re-sorts every
filter that mentions one — so it goes at the end, or the change is a deliberate one.

| Internal | External | Description |
|----------|----------|-------------|
| basic | Grundstufe | Everybody meets it: Browser, DVD, WLAN, PDF. The default, and what a record without a level counts as |
| advanced | Aufbaustufe | Met by anybody who looks slightly closer: Zigbee, EPUB, RJ45, Domain |
| expert | Fortgeschritten | Met on purpose: SIP, JSON, Socket, BLE, Thread — the terms that make this a quiz for people who already know what a browser is |

### Gender

Grammatical gender of a common noun, for the languages that have one. English rows leave it
empty; a German question needs it, because „ein Suchmaschine" is wrong in a way that teaches
carelessness in the middle of teaching a distinction.

Both articles are DERIVED from it rather than stored: definite der/die/das and indefinite
ein/eine/ein. Storing the two separately would let them disagree about one noun.

| Internal | External | Description |
|----------|----------|-------------|
| m | maskulin | der Browser, ein Browser |
| f | feminin | die Suchmaschine, eine Suchmaschine |
| n | neutrum | das Gerät, ein Gerät |
