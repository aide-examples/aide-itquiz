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
| FormatGroup | Format group | What a format is a kind of — Image format, Compression format |
| Concept | Concept | Something one reads and types that nobody makes — Web address, Domain |
| StorageMedium | Storage medium | A thing bytes sit on — CD-ROM, SSD, SD card |
| ProductGroup | Product group | What a KIND of thing is a kind of — Web service, Hardware component |
| ProgrammingLanguage | Programming language | The notation a program is written in — Python, PHP, awk |
| Framework | Framework | A ready-made scaffold a program is written inside, belonging to one language — Vue, Hibernate |

### Language

The languages a question can be asked in. The model itself is English; only the question texts
are multilingual, because they are what a learner reads.

| Internal | External | Description |
|----------|----------|-------------|
| de | Deutsch | German |
| en | English | English |

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

