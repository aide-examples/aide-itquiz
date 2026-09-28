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

**The pair is unique.** A kind of device has a kind of socket or it does not; saying so twice
says nothing new, and a duplicate would give a question two identical right answers.

## Attributes

```json
[
{"name":"product_type","type":"ProductType","description":"The kind of thing that has the socket","example":"Device"},
{"name":"connector","type":"Connector","description":"The kind of socket it has","example":"HDMI"}
]
```

## Unique Keys

| Key | Columns | Why |
|-----|---------|-----|
| one_row_per_pair | product_type, connector | A kind either has that socket or it does not. A second row says nothing and would give a question the same answer twice |

## Error Messages

| Code | en | de |
|------|----|----|
| unique_one_row_per_pair | This kind already has that connector | Diese Art hat diesen Anschluss schon |
