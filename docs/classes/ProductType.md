# ProductType [asset_type]

[LABEL=name]
[LABEL2=purpose]
[PLURAL=de:Arten en:Product types]

A KIND of thing — browser, search engine, spider, operating system. Its `purpose` is the sentence that separates them.

## Why `part_of` sits on the TYPE and not on the product

*„MS-Word ist ein Textprogramm von MS; Textprogramme sind Teil von Office-Paketen; das
Office-Paket von MS heißt MS-Office."* Three facts, and only the middle one is new — the
other two the model already holds. Put the part-relation on the TYPE and the chain closes by
itself: nobody has to enter that Word is in Microsoft Office, because Word is a word
processor, a word processor is part of an office suite, and Microsoft's office suite is
Microsoft Office.

On the product it would have been the same fact written once per product, and wrong the day
somebody adds a word processor and forgets the edge. On the type it is one row and it holds
for everything of that kind, including what is entered tomorrow (§48 — the model carries the
fact, so nobody sweeps).

It also reaches where products do not exist. A `Prozessor`, an `Arbeitsspeicher`, a
`Bildschirm` are kinds a layperson meets constantly and can name — but there is no single
product of them with a household name, and this model gives a product a manufacturer. As
types with a `part_of` they are fully usable; as products they could not have been entered at
all without inventing facts.

## The three sentences the whole system rests on

A KIND of thing — browser, search engine, spider, operating system. This is where the whole system earns its keep: the confusions it exists to dissolve are confusions between types, and `purpose` is the sentence that separates them.

Three of those sentences, as the architect wrote them:

> **Browser** — displays web pages. > **Search engine** — keeps an index of web pages, and is itself a website. > **Spider** — walks web pages and builds the index a search engine keeps.

No wrong statement is stored anywhere. A reader who believes a browser and a search engine are the same thing meets three correct sentences that cannot all be true of one thing.

## Attributes

```json
[
{"name":"name","type":"string","unique":true,"label":true,"description":"What this kind of thing is called","example":"Browser"},
{"name":"purpose","type":"string","description":"What it is FOR, in one sentence a layperson understands — the load-bearing field of this system. A PREDICATE and lower-case, not a noun phrase and not a whole sentence: it is used in several frames („Wie nennt man ein Ding, das Folgendes tut: …\" and „Ein Browser …\"), and only a predicate fits them all. `Device` was written as a noun phrase and produced „Ein Gerät das Ding, das man in der Hand hält\" the day a second frame appeared","example":"displays web pages"},
{"name":"icon","type":"media","optional":true,"mime":"img","description":"A GENERIC pictogram of the kind — a browser window, a RAM stick, a disk. Deliberately not a brand mark: a product logo is a trademark, and a hand-drawn imitation would be a false fact in a system whose first rule is that it stores none. It is what makes „Welche Art von Ding ist das?\" askable at all","example":"browser.svg"},
{"name":"part_of","type":"ProductType","optional":true,"description":"The KIND this kind is a part of — a word processor is part of an office suite, a processor is part of a device. A statement about kinds, not about two particular things, so it holds for every product of the type without anybody entering it twice","example":"Office suite"},
{"name":"wikipedia_de","type":"wikipedia","optional":true,"description":"The title of the German Wikipedia article, exactly as the API resolves it. Stored and VERIFIED rather than derived from the name: „Safari\" is a disambiguation page, „Bing\" has no German article at all, and a guessed title that happens to resolve to the wrong article is the one kind of error this system must not make","example":"Webbrowser"},
{"name":"wikipedia_en","type":"wikipedia","optional":true,"description":"The English article title. A separate attribute rather than a translation child, because an article title is an IDENTIFIER in another system and not a translation of a name — the two wikis disagree about which is the article and which the redirect","example":"Web browser"},
{"name":"note","type":"string","optional":true,"description":"A true remark worth showing after an answer — including how this type is commonly confused with another, stated as an observation about people and never as a fact about the thing","example":"Many people set a search engine as their browser's home page, which is why the two seem to be one"}
]
```
