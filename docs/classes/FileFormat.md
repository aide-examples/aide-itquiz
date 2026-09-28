# FileFormat [reference_data]

[LABEL=name]
[PLURAL=de:Dateiformate en:File formats]

A KIND of file, known to a layperson by the letters after the dot — and the second half of the confusion this system is about: what a thing IS versus what it can OPEN.

## About

A kind of file, identified in daily life by its extension. `.pdf`, `.odt`, `.mp3` — a reader
recognises the suffix long before they could say what a format is, which is exactly the handle
this entity offers.

**Why `FileFormat` and not `FileType`.** The model already has `ProductType`, and a reader
meeting `FileType` beside it would expect a parallel that does not exist — a `ProductType` is a
kind of *program*, a file format is a kind of *document*. „Format" is also what the thing is
called: a `.pdf` is a format, and what a program does with it is a capability, not a type.

**What it is FOR, didactically.** The confusions this system teaches so far are about *things*:
a maker is not the thing it makes, a browser is not a search engine. The file format adds the
other half a layperson gets wrong — **what opens what.** „Womit kann man eine `.pdf` ansehen?"
has several right answers and no obvious one, and the reason people cannot answer it is that
they have never been told that a format and a program are different kinds of thing at all.

The link to a program is not an attribute here but its own entity — see
[FormatSupport](FormatSupport.md) — because it carries a fact of its own: *what* the program can
do with the file.

## Attributes

```json
[
{"name":"name","type":"string","unique":true,"label":true,"description":"What the format is called, as a person would say it","example":"PDF"},
{"name":"extension","type":"string","unique":true,"description":"The letters after the dot, WITH the dot and lower-case — this is the handle a layperson actually has, and the one a question is asked with. Stored with the dot because that is how it is read aloud and written: „eine Datei, die auf .pdf endet\"","example":".pdf"},
{"name":"long_name","type":"string","optional":true,"unique":true,"description":"What the abbreviation stands for, written out. Almost every format IS an abbreviation, and the long form is both the answer to „wofür steht das?\" and the thing somebody types into the search when they do not know the short one — hence `unique` and not `search`: the global search covers the label and every UNIQUE string field, while `search` feeds a different index (measured in `UISearchLoader`, 2026-09-28). And it says something true anyway — two formats do not share a long form","example":"Portable Document Format"},
{"name":"purpose","type":"longString","description":"What a file of this format HOLDS, in one sentence a layperson understands. A PREDICATE and lower-case, like ProductType.purpose and for the same reason: it is substituted into several frames and only a predicate fits them all","example":"holds a document that looks the same everywhere it is opened"},
{"name":"icon","type":"media","optional":true,"mime":"img","description":"The format's mark, where it has one people would recognise","example":"pdf.svg"},
{"name":"wikipedia_de","type":"wikipedia","optional":true,"description":"The German Wikipedia article — a TITLE, verified against the API rather than guessed","example":"Portable Document Format"},
{"name":"wikipedia_en","type":"wikipedia","optional":true,"description":"The English article. Separate from the German one because an article title is an identifier in another system, not a translation","example":"PDF"},
{"name":"note","type":"longString","optional":true,"description":"A true remark worth showing after an answer — including how this format is commonly misunderstood, stated as an observation about people and never as a fact about the thing","example":"People say „ein PDF\" for any document they cannot change, which is most of what the format is known for"}
]
```

## Error Messages

| Code | en | de |
|------|----|----|
| unique_extension | A format with this extension already exists | Ein Format mit dieser Endung gibt es schon |
