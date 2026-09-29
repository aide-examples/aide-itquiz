# ConnectorPort [reference_data]

[ASSOCIATION]
[PLURAL=de:Anschlussstellen en:Connector ports]

One kind of device has one kind of socket — „ein Laptop hat HDMI".

## About

A pure pairing: a [ProductType](ProductType.md) and a [Connector](Connector.md), nothing else.
It is what makes „womit verbinde ich die beiden?" answerable, because the answer is whatever
socket both of them have.

**`[ASSOCIATION]` and not a label**, and the difference from its neighbour is worth seeing.
[FormatSupport](FormatSupport.md) looks like the same thing and is not: it carries `support`,
a fact of its own that the questions are built on, so it earns a label and its own identity.
This one carries nothing — the pair IS the statement — and the framework has a word for exactly
that. Declaring it rather than inventing a label keeps the absence a decision instead of an
oversight (aide-rap: every entity carries a label or says why it has none).

**No direction, deliberately.** A laptop's HDMI is an output and a screen's is an input. That is
true and it is the distinction that would make the answer precise rather than merely right — but
the question this serves today is answered without it, and a column added when a question needs
it costs one migration, while one added now costs the discipline of filling it correctly for
every row forever (§43).

**The pair is unique**, and it is declared as `uk:1` on both attributes. A kind of device has a kind
of socket or it does not; saying so twice says nothing new, and a duplicate would give a question
two identical right answers.

*Lehrgeld 2026-09-29.* That sentence used to stand above a `## Unique Keys` chapter — a table of key
name, columns and reason — and the framework reads no such chapter. So nothing was declared, and
because `[ASSOCIATION]` means there is no label either, the seed loader had nothing at all to
recognise a row by: one ordinary reload turned twelve pairs into twenty-four, silently. The two
facts compound, which is why it is worth stating here rather than only in the framework's issue
(aide-rap#525): an association without a `uk` cannot be seeded twice.

## Attributes

```json
[
{"name":"product_type","type":"ProductType","uk":1,"description":"The kind of thing that has the socket","example":"Device"},
{"name":"connector","type":"Connector","uk":1,"description":"The kind of socket it has","example":"HDMI"}
]
```


## Error Messages

| Code | en | de |
|------|----|----|
| unique_one_row_per_pair | This kind already has that connector | Diese Art hat diesen Anschluss schon |
