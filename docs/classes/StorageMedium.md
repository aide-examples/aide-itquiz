# StorageMedium [reference_data]

[LABEL=name]
[LABEL2=purpose]
[PLURAL=de:Speichermedien en:Storage media]

A thing bytes sit on — a disc, a disk, a card, a stick. You can hold it, and nobody asks who made it.

## About

`Storage medium` already exists as a [ProductType](ProductType.md), and it stays: it is the
GENERAL idea — *bewahrt Dateien auf, sodass sie nach dem Ausschalten noch da sind* — the thing a
laptop has one of. What it never had is instances, and the reason is worth stating because it is
what decided this entity.

**A DVD is not a Product.** A product has a maker and a proper name: Chrome, iCloud, OneDrive.
Nobody asks who makes a DVD, and "DVD" is not a name anybody chose for their version of one.

**And it is not `part_of` a storage medium either.** That relation is composition — a processor
is *part of* a device — and a DVD is not part of a Massenspeicher, it **is** one. Using
`part_of` for both would give one attribute two meanings, and the first question that walked the
chain would mix them.

So this sits **beside** [Connector](Connector.md), and the parallel is what makes it obvious in
hindsight: something physical, held in a hand, with no manufacturer worth naming and a
`looks_like` written for whoever is holding it without a word for it. The two are the only
entities in this system addressed to someone looking at a thing rather than reading about it.

**What it unlocks that nothing else could.** Three question shapes the model could not build
before: how much fits on one, whether it can be written again, and what it looks like. The last
is the one a layperson actually needs — they are holding a card and do not know it is called an
SD card.

## Attributes

```json
[
{"name":"name","type":"string","unique":true,"label":true,"description":"What it is called, as a person would say it","example":"DVD"},
{"name":"long_name","type":"string","optional":true,"description":"What the abbreviation stands for, where it is one. Absent for a name that is already a word — a Festplatte abbreviates nothing","example":"Digital Versatile Disc"},
{"name":"purpose","type":"longString","description":"What it is FOR, in one sentence a layperson understands. A PREDICATE and lower-case, like every other purpose in this model","example":"holds a film or a few gigabytes of files on a disc you can carry"},
{"name":"looks_like","type":"longString","optional":true,"description":"How to recognise it by eye, for the reader who is holding the thing and has no word for it. Written for somebody looking rather than reading — the same job this field does on Connector","example":"a shiny disc twelve centimetres across, silver on one side"},
{"name":"capacity_mb","type":"int","optional":true,"description":"Roughly how much it holds, in megabytes. A NUMBER because its ORDER is the point — „was passt auf mehr?\" is a question the model should be able to answer, and an order read off a string sorts 10 before 9. The display form („4,7 GB\") is derived and never stored beside it","example":4700},
{"name":"rewritable","type":"bool","optional":true,"description":"Can it be written again after it is full? The one property of this group a person meets as a surprise — a CD-ROM cannot, and the RO in its name has been saying so all along","example":true},
{"name":"icon","type":"media","optional":true,"mime":"img","description":"A picture of the thing — the fastest way to recognise one, and the reason this entity was asked for","example":"dvd.jpg"},
{"name":"wikipedia_de","type":"wikipedia","optional":true,"description":"The German Wikipedia article — a TITLE, verified against the API rather than guessed","example":"DVD"},
{"name":"wikipedia_en","type":"wikipedia","optional":true,"description":"The English article. Separate from the German one because an article title is an identifier in another system, not a translation","example":"DVD"},
{"name":"note","type":"longString","optional":true,"description":"A true remark worth showing after an answer, including how this one is commonly misunderstood","example":"The RO in CD-ROM means read-only, and it is the reason a music CD cannot be recorded over — a distinction the word „CD\" alone hides"}
]
```

## Error Messages

| Code | en | de |
|------|----|----|
| unique_name | A storage medium with this name already exists | Ein Speichermedium mit diesem Namen gibt es schon |
