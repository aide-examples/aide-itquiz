# Concept [reference_data]

[LABEL=name]
[LABEL2=purpose]
[PLURAL=de:Begriffe en:Concepts]

Something a person meets every day and nobody manufactures — a web address, the part of it before the first slash, the dot-something at the end.

## About

The other three standards in this model — [FileFormat](FileFormat.md),
[Protocol](Protocol.md), [Connector](Connector.md) — are things a product **supports**. A
concept is different: it is something a person **reads and types**, and there is no maker to
ask about and no product to name.

That is the test for belonging here, and it is a sharp one: *does anybody make instances of
this?* A browser has a maker. A PDF has a committee. A web address has neither — it is a way of
writing something down.

**The relation is `part_of`, and it came from the examples rather than from a design.** The
architect asked for DOMAIN and TLD in the same breath as the web address, and the three stand in
one line: `.de` is part of `wikipedia.de`, which is part of `https://de.wikipedia.org/wiki/…`.
Modelled that way the entity teaches the structure by holding it, and the question „wovon ist
eine TLD ein Teil?" needs no new machinery — `ProductType` already carries the same
self-reference and the same question type runs on it.

**What this resolves.** A web address had no home while the model held only makers, things and
standards, which is why it waited: 🇩🇪 *„Erst klären, wie wir mit PROTOKOLLEN umgehen."* With
`Protocol` in place the line is clean — `https://` **names** a protocol and a place. The
notation is not the standard, and this is where the notation lives.

**Socket and VOIP are here and not in `Protocol`,** for the reason the protocol file gives: a
socket is an endpoint rather than an agreement, and VOIP is a purpose whose protocols are called
SIP and RTP. Both are words people use as if they were protocols, and a model that quietly
agreed with them would teach the confusion instead of naming it.

## Attributes

```json
[
{"name":"name","type":"string","unique":true,"label":true,"description":"What the thing is called, as a person would say or read it. ENGLISH — the German („Webadresse") is a `Translation` row","example":"Web address"},
{"name":"abbreviation","type":"string","optional":true,"unique":true,"description":"The short form, where the short form is what people actually meet. `unique` rather than `search`, because the global search covers the label and every unique string field — so somebody typing „TLD\" lands here","example":"URL"},
{"name":"long_name","type":"string","optional":true,"unique":true,"description":"What the abbreviation stands for, written out — the answer to „wofür steht das?\". Also `unique`, for the same reason and because two concepts do not share a long form","example":"Uniform Resource Locator"},
{"name":"purpose","type":"longString","description":"What it is FOR, in one sentence a layperson understands. A PREDICATE and lower-case, like every other purpose in this model — it is substituted into several frames and only a predicate fits them all","example":"names one page on the web so exactly that no other page has the same one"},
{"name":"example","type":"longString","optional":true,"description":"One real instance, written out. The fastest way to recognise a thing one has met a thousand times without a name — and for this entity in particular, the example IS the explanation","example":"https://de.wikipedia.org/wiki/Webbrowser"},
{"name":"part_of","type":"Concept","optional":true,"description":"The larger thing this is a part of, where there is one. `.de` is part of a domain, a domain is part of a web address — one line that teaches the structure by holding it","example":"Domain"},
{"name":"wikipedia_de","type":"wikipedia","optional":true,"description":"The German Wikipedia article — a TITLE, verified against the API rather than guessed","example":"Uniform Resource Locator"},
{"name":"wikipedia_en","type":"wikipedia","optional":true,"description":"The English article. Separate from the German one because an article title is an identifier in another system, not a translation","example":"URL"},
{"name":"level","type":"Level","default":"basic","description":"How far into the subject this record sits. `default` and therefore OPTIONAL on purpose: the seed then marks only what is NOT everyday, which keeps the classification of ~140 records readable as a diff and makes the safe direction the free one — a new record counts as basic and a beginner meets it","example":"expert"},
{"name":"note","type":"longString","optional":true,"description":"A true remark worth showing after an answer — including what people commonly mix this up with, stated as an observation about people and never as a fact about the thing","example":"The address bar and the search box are one field in every modern browser, which is why „ins Internet gehen\" and „googeln\" have become the same gesture"}
]
```

## Error Messages

| Code | en | de |
|------|----|----|
| unique_name | A concept with this name already exists | Einen Begriff mit diesem Namen gibt es schon |
| unique_abbreviation | That abbreviation is already taken | Diese Abkürzung ist schon vergeben |
