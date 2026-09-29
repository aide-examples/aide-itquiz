# ProductGroup [reference_data]

[LABEL=name]
[LABEL2=purpose]
[PLURAL=de:Produktgruppen en:Product groups]

What a kind of thing is a KIND of — a web service, a document program, a hardware component.

## About

Twenty-six kinds in one list are twenty-six things to learn. Sorted into seven families they are
seven things to learn plus examples, and the family is where the sentence worth carrying lives:
*a web service runs on somebody else's computer, and you reach it instead of installing it* — and
then a search engine, a map service and a video platform stop being three unrelated words.

This is the parallel [FormatGroup](FormatGroup.md) named and deliberately did not take. It is taken
now because the inventory grew, and because the architect decided the player should meet **both**
relations rather than one (#7).

**It does NOT replace `part_of`, and the difference is the teaching.** The worry when this was
deferred was that a group would be confused with `ProductType.part_of`, which means composition. The
answer is not to avoid the collision but to state it, because both sentences are true about the same
record and a learner who holds both has understood something:

> A processor is **part of** a device. A processor is **a kind of** hardware component.

The first is about where the thing sits; the second is about what sort of thing it is. Nothing in the
model prevents an entry from having both, and five records do — the components of a device are also a
family of their own.

**Where the cut was made, and it is by PURPOSE rather than by name.** Every membership below is
argued from the type's own `purpose` sentence, not from its label:

| group | the sentence a learner carries | members |
|---|---|---|
| Web service | runs on somebody else's computer; you reach it instead of installing it | Search engine, Online encyclopedia, Map service, Video platform, App store, Cloud storage, AI assistant |
| Web client | fetches web pages itself, rather than being what pages are fetched from | Browser, Spider |
| Document program | makes or shows something meant to be read as pages | Word processor, Spreadsheet, Office suite, Document viewer |
| Message program | carries what one person writes to another | Messenger, Mail client |
| System program | runs the machine and what is on it, rather than a task of yours | Operating system, File manager |
| Decoder | turns a recorded or printed form back into what it stands for | Media player, Barcode scanner |
| Hardware component | a part inside a device, of no use on its own | Processor, Working memory, Storage medium, Screen, Battery |

**Seven small families rather than two or three large ones**, on the architect's instruction:
🇩🇪 *„mir würden zB 6 auch mehr einleuchten, als zwei oder drei pauschale Auffangbegriffe.“* A group
called *Application* would hold eleven of the twenty-six and teach nothing — the whole value of a
family is that naming it says something, and a catch-all says only *not hardware*.

**The cut separates the confusions this system exists for.** *Browser* and *Search engine* are the
pair `ProductType.note` calls out — one is a web client, the other a web service, and the groups put
them on opposite sides. *Cloud storage* and *Network storage* likewise: one is somebody else's
computer, the other a box in your house.

**Two records have no group, and that is the answer rather than a gap.** `Device` is the whole that
five components are `part_of` — it is not a member of a family, it is what the family assembles into.
`Network storage` is a box of its own: not a component, not a service, and not a program. `group` is
therefore optional, exactly as `FileFormat.group` is, and an empty one means *no family yet* and not
*forgotten*.

**Decoder is the one name a layperson may not own**, and it is kept because the kinship it names is
one nobody sees: a media player and a barcode scanner do the same thing to different marks. The
`purpose` sentence carries it, which is what `purpose` is for here.

## Attributes

```json
[
{"name":"name","type":"string","unique":true,"label":true,"description":"What the family is called, as a person would say it. ENGLISH, like every other model name — the German lives in `Translation` with its gender","example":"Web service"},
{"name":"purpose","type":"longString","label2":true,"description":"What every member of this family has in common, in one sentence a layperson understands. A PREDICATE and lower-case, like `ProductType.purpose` and for the same reason: it is substituted into several frames and only a predicate fits them all","example":"runs on somebody else's computer; you reach it instead of installing it"},
{"name":"wikipedia_de","type":"wikipedia","optional":true,"description":"The German article title, where one exists for the family itself. Often absent: a family is a teaching device and not always an established term","example":"Webservice"},
{"name":"wikipedia_en","type":"wikipedia","optional":true,"description":"The English article title, where one exists","example":"Web service"},
{"name":"level","type":"Level","default":"basic","description":"How far into the subject the FAMILY sits, independently of its members. `Decoder` is advanced even though a media player is everyday — the word is the hard part, not the thing","example":"advanced"},
{"name":"note","type":"longString","optional":true,"description":"A true remark worth showing after an answer — typically what this family is commonly mixed up with","example":"A web service and a web client are easy to swap: the search engine is the service, the browser is the client that reaches it"}
]
```

## Error Messages

| Code | en | de |
|------|----|----|
| unique_name | A group with this name already exists | Eine Gruppe mit diesem Namen gibt es schon |
