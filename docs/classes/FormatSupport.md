# FormatSupport [reference_data]

[LABEL=concat(product, ' ', support, ' ', format)]
[PLURAL=de:Dateiunterstützungen en:Format support]

What one program can do with one kind of file — the fact behind „womit kann man eine .pdf ansehen?", and the reason that question has several right answers.

## About

One row says: **this product can do this with this format.** Chrome views a PDF; Microsoft Word
edits a DOCX; VLC views an MP4.

**Why an entity and not an attribute.** A product handles many formats and a format is handled
by many products, so the link is many-to-many and needs a home of its own. But it is not a bare
junction either: it carries a fact — *what* the program can do — and that fact is the whole
point of the questions built on it. An `[ASSOCIATION]` would say there is nothing to know here,
and there is.

**`edit` implies `view`, so one row is enough.** Nothing edits a file it cannot open. A product
declared as an editor therefore answers the *view* question too, and storing a second `view` row
beside it would be storing the same fact twice — where the copy is what drifts (global
CLAUDE.md §17). The implication lives in the `FileSupport` enum, whose row order IS the order
everywhere (aide-rap#288) and here also the strength.

**The pair is unique.** One product, one format, one row — the strongest thing it can do. Two
rows for one pair would let a question have two right answers while the generator names the
first, and a player would be told their correct answer is wrong. That has happened once in this
system already (`product_of_company` had to learn to check), so the model prevents it here
instead of the generator having to.

## Attributes

```json
[
{"name":"product","type":"Product","description":"The program","example":"Chrome"},
{"name":"format","type":"FileFormat","description":"The kind of file","example":"PDF"},
{"name":"support","type":"FileSupport","description":"What it can do with it. `edit` includes `view` — see Types.md, the order of the enum is the strength","example":"view"},
{"name":"note","type":"longString","optional":true,"description":"A true remark about THIS pairing, where there is one worth showing","example":"Every browser shows a PDF today, which is why nobody installs a reader any more"}
]
```

## Unique Keys

| Key | Columns | Why |
|-----|---------|-----|
| one_row_per_pair | product, format | The strongest support, once. A second row for the same pair would give a question two right answers while the generator names one |

## Error Messages

| Code | en | de |
|------|----|----|
| unique_one_row_per_pair | This product already has an entry for this format — change that one instead | Für dieses Produkt gibt es zu diesem Format schon einen Eintrag — ändere den vorhandenen |
