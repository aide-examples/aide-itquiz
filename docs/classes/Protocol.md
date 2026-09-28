# Protocol [reference_data]

[LABEL=name]
[PLURAL=de:Protokolle en:Protocols]

An agreement two programs follow so they can talk to each other — and almost always an abbreviation nobody has ever been told the long form of.

## About

A protocol is not a thing anybody makes and not a file anybody stores. It is an **agreement**:
if both sides follow it, two programs that have never met can work together. That is the whole
idea, and it is the one a layperson has never been offered — which is why „was ist eigentlich
ein Protokoll?" has no answer ready in most heads even for people who type `https` every day.

**Why its own entity and not a kind of `FileFormat`.** They have the same SHAPE — a named
standard with an abbreviation and a long form — and that is exactly the trap. A program *opens*
a file and *speaks* a protocol, and one entity with a `kind` column to tell the two apart is the
generic discriminator table the architecture guideline in this repo warns against: compose via
FK, keep the families separate. The architect decided it in one line: 🇩🇪 *„die sollen eine
eigene Entity werden!"*

**What belongs here, and what does not.** NAMED protocols a layperson can meet: HTTP, HTTPS,
MQTT, SIP. Not the machinery underneath — nobody needs UDP to understand the web, and the
DNS-side protocols are known to very few. And two words that get filed here by habit are not
protocols at all:

- **VOIP** is a purpose, not a protocol — the protocols under it are SIP and RTP. The architect
  named the reason it happens anyway: 🇩🇪 *„man ist halt oft faul und greift in ein pauschaleres
  Schubfach, um Dinge zu benennen."* That laziness is itself worth teaching, so VOIP earns a
  `note` on SIP rather than a row of its own.
- **A socket** is an endpoint, a place two programs plug into — not an agreement about what they
  say once plugged in.

**SMTP is here although nobody meets it directly.** Mail arrives, and the protocol behind it is
invisible unless something breaks. It is in for the reader the architect called *fortgeschrittene
Laien* — the ones who have heard the word and would like it to mean something.

## Attributes

```json
[
{"name":"name","type":"string","unique":true,"label":true,"description":"The short name, as it is written and said — almost always the abbreviation","example":"HTTPS"},
{"name":"long_name","type":"string","optional":true,"unique":true,"description":"What the abbreviation stands for, written out. This is the answer to „wofür steht das?\" and also what somebody types who knows the words but not the letters — hence `unique` and not `search`: the global search covers the label and every UNIQUE string field, while `search` feeds a different index (measured in `UISearchLoader`, 2026-09-28). And it says something true anyway — two formats do not share a long form","example":"Hypertext Transfer Protocol Secure"},
{"name":"purpose","type":"longString","description":"What the agreement is FOR, in one sentence a layperson understands. A PREDICATE and lower-case, like ProductType.purpose and for the same reason — it is substituted into several frames","example":"carries web pages between a server and a browser, encrypted so nobody in between can read along"},
{"name":"wikipedia_de","type":"wikipedia","optional":true,"description":"The German Wikipedia article — a TITLE, verified against the API rather than guessed","example":"Hypertext Transfer Protocol Secure"},
{"name":"wikipedia_en","type":"wikipedia","optional":true,"description":"The English article. Separate from the German one because an article title is an identifier in another system, not a translation","example":"HTTPS"},
{"name":"note","type":"longString","optional":true,"description":"A true remark worth showing after an answer — including what people commonly put in this drawer that does not belong in it, stated as an observation about people and never as a fact about the thing","example":"The padlock in the browser bar is this protocol and nothing else — it says the line is private, never that the site is honest"}
]
```

## Error Messages

| Code | en | de |
|------|----|----|
| unique_name | A protocol with this name already exists | Ein Protokoll mit diesem Namen gibt es schon |
