# ProductType [asset_type]

[LABEL=name]
[PLURAL=de:Arten en:Product types]

A KIND of thing — browser, search engine, spider, operating system. This is where the whole
system earns its keep: the confusions it exists to dissolve are confusions between types, and
`purpose` is the sentence that separates them.

Three of those sentences, as the architect wrote them:

> **Browser** — displays web pages.
> **Search engine** — keeps an index of web pages, and is itself a website.
> **Spider** — walks web pages and builds the index a search engine keeps.

No wrong statement is stored anywhere. A reader who believes a browser and a search engine are
the same thing meets three correct sentences that cannot all be true of one thing.

## Attributes

```json
[
{"name":"name","type":"string","unique":true,"label":true,"description":"What this kind of thing is called","example":"Browser"},
{"name":"purpose","type":"string","description":"What it is FOR, in one sentence a layperson understands — the load-bearing field of this system","example":"Displays web pages"},
{"name":"note","type":"string","optional":true,"description":"A true remark worth showing after an answer — including how this type is commonly confused with another, stated as an observation about people and never as a fact about the thing","example":"Many people set a search engine as their browser's home page, which is why the two seem to be one"}
]
```
