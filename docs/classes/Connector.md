# Connector [reference_data]

[LABEL=name]
[PLURAL=de:Anschlüsse en:Connectors]

The shape of a plug and the socket it fits — the one standard in this system a person can hold in their hand and still not be able to name.

## About

HDMI, USB-C, RJ45, RCA, a headphone jack. A **connector** is an agreement about a shape and
what travels through it, and it is the third standard this model carries after
[FileFormat](FileFormat.md) and [Protocol](Protocol.md) — the same shape a third time: a named
thing with an abbreviation, that products support and nobody confuses with the products.

**Why it is worth teaching.** It is the only standard here a layperson meets *physically*. They
hold the cable, they can see it does not fit, and they still have no word for what they are
holding — „so ein flaches" or „das kleine runde". The gap between a thing one handles daily and
a thing one cannot name is exactly the gap this system exists to close, and nowhere is it wider.

**The relation is to a KIND, not to one product.** „Ein Laptop hat HDMI" is true and stays true;
„ein iPhone hat Lightning" was true for nine years and then was not. Tying a connector to the
kind keeps the model from ageing with every product generation, and it is what the architect's
own sentence says: 🇩🇪 *„Geräte haben Connectoren im Modell"* — and `Device` in this model is a
[ProductType](ProductType.md). The link lives in [ConnectorPort](ConnectorPort.md).

**What is deliberately not modelled yet.** Nothing says which kinds are PHYSICAL, so the model
would let a browser be given an HDMI port. The fact „this kind is a thing you can hold" belongs
on `ProductType` and would be worth a flag of its own — named here rather than built, because it
is a second question and this one does not need it (§43).

And no direction. A laptop's HDMI is an output and a screen's is an input, which is a real
distinction and the one that would make „womit verbindet man die beiden?" precise — but the
question that exists today is answered without it. When one needs it, it is a column on
`ConnectorPort` and not a new entity.

## Attributes

```json
[
{"name":"name","type":"string","unique":true,"label":true,"description":"What the connector is called, as it is written on a box or said in a shop","example":"HDMI"},
{"name":"long_name","type":"string","optional":true,"unique":true,"description":"What the abbreviation stands for, written out — the answer to „wofür steht das?\", and what somebody searches for who knows the words but not the letters. `unique` rather than `search`, because the global search covers the label and every unique string field","example":"High-Definition Multimedia Interface"},
{"name":"purpose","type":"longString","description":"What travels through it, in one sentence a layperson understands. A PREDICATE and lower-case, like every other purpose in this model","example":"carries picture and sound over a single cable"},
{"name":"looks_like","type":"longString","optional":true,"description":"How to recognise it by eye, for the reader who is holding the cable and has no word for it. The one attribute in this system written for somebody looking at a thing rather than reading about it","example":"a flat, slightly tapered plug about two centimetres wide"},
{"name":"icon","type":"media","optional":true,"mime":"img","description":"The connector's own mark or a picture of the plug — the fastest way to recognise one","example":"hdmi.svg"},
{"name":"wikipedia_de","type":"wikipedia","optional":true,"description":"The German Wikipedia article — a TITLE, verified against the API rather than guessed","example":"High Definition Multimedia Interface"},
{"name":"wikipedia_en","type":"wikipedia","optional":true,"description":"The English article. Separate from the German one because an article title is an identifier in another system, not a translation","example":"HDMI"},
{"name":"level","type":"Level","default":"basic","description":"How far into the subject this record sits. `default` and therefore OPTIONAL on purpose: the seed then marks only what is NOT everyday, which keeps the classification of ~140 records readable as a diff and makes the safe direction the free one — a new record counts as basic and a beginner meets it","example":"expert"},
{"name":"note","type":"longString","optional":true,"description":"A true remark worth showing after an answer — including what people commonly mix this up with, stated as an observation about people and never as a fact about the thing","example":"The one everybody recognises and few can name: „das flache breite\" is HDMI in most households"}
]
```

## Error Messages

| Code | en | de |
|------|----|----|
| unique_name | A connector with this name already exists | Einen Anschluss mit diesem Namen gibt es schon |
