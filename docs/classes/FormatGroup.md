# FormatGroup [reference_data]

[LABEL=name]
[LABEL2=purpose]
[PLURAL=de:Formatgruppen en:Format groups]

What a file format is a KIND of — a picture format, an audio format, a compression format.

## About

Ten formats in a list are ten things to learn. Sorted into half a dozen groups they are one
thing to learn plus examples, and the group is where the sentence worth remembering lives:
*a compression format makes a file smaller without losing anything*, and then JPEG, PNG and ZIP
stop being unrelated letters.

**Why an entity and not an enum.** An enum would give the group a name and nothing else. What
makes it worth having is the `purpose` — the sentence a reader can carry to the next format they
meet — and a purpose belongs to a record, not to a value in a list. It is the same reading
`ProductType` follows: the kind carries the explanation, the instances carry the names.

**Why not `part_of` on `FileFormat` itself.** A group is not a format. An image format is not
something one can save a file as, so a self-reference would put a thing that exists beside a
thing that does not and call them the same. `ProductType.part_of` is a different relation — a
processor really is *part of* a device — and the difference is worth keeping visible.

**The parallel this opens and does not take.** `ProductType` has no groups, and the same
argument would give it some: an SSD is a kind of storage medium, a laptop a kind of device.
That is a second question with its own answer, and this one does not need it (§43). Named here
so the asymmetry reads as a decision rather than an oversight.

## Attributes

```json
[
{"name":"name","type":"string","unique":true,"label":true,"description":"What the group is called, as a person would say it. ENGLISH, like every other model name — the German („Bildformat") lives in `Translation` with its gender","example":"Image format"},
{"name":"purpose","type":"longString","description":"What the formats in this group are FOR, in one sentence — the thing worth carrying to the next format one meets. A PREDICATE and lower-case, like every other purpose in this model","example":"holds a picture, as a photograph or as a drawing"},
{"name":"wikipedia_de","type":"wikipedia","optional":true,"description":"The German Wikipedia article — a TITLE, verified against the API rather than guessed","example":"Grafikformat"},
{"name":"wikipedia_en","type":"wikipedia","optional":true,"description":"The English article. Separate from the German one because an article title is an identifier in another system, not a translation","example":"Image file format"},
{"name":"level","type":"Level","default":"basic","description":"How far into the subject this record sits. `default` and therefore OPTIONAL on purpose: the seed then marks only what is NOT everyday, which keeps the classification of ~140 records readable as a diff and makes the safe direction the free one — a new record counts as basic and a beginner meets it","example":"expert"},
{"name":"note","type":"longString","optional":true,"description":"A true remark worth showing after an answer, including how this group is commonly misunderstood","example":"The split people actually meet is inside this group: a photo is a JPEG and a logo is a PNG, and almost nobody has been told why"}
]
```

## Error Messages

| Code | en | de |
|------|----|----|
| unique_name | A group with this name already exists | Eine Gruppe mit diesem Namen gibt es schon |
