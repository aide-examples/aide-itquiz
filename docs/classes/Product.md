# Product [asset_instance]

[LABEL=name]
[PLURAL=de:Produkte en:Products]

A concrete thing somebody made: Chrome, Firefox, Google Search, Googlebot, Android. Exactly one type, exactly one maker.

## About

A concrete thing somebody made: Chrome, Firefox, Google Search, Googlebot, Android. It has exactly one type and exactly one maker, and those two facts produce most of the questions.

## Attributes

```json
[
{"name":"name","type":"string","unique":true,"label":true,"description":"The name people use","example":"Chrome"},
{"name":"product_type","type":"ProductType","description":"What kind of thing it is","example":"Browser"},
{"name":"manufacturer","type":"Company","description":"Who makes it","example":"Google"},
{"name":"icon","type":"media","optional":true,"mime":"img","description":"The product's mark — recognised long before the name is","example":"chrome.svg"},
{"name":"wikipedia_de","type":"wikipedia","optional":true,"description":"The title of the German Wikipedia article, exactly as the API resolves it. Stored and VERIFIED rather than derived from the name: „Safari\" is a disambiguation page, „Bing\" has no German article at all, and a guessed title that happens to resolve to the wrong article is the one kind of error this system must not make","example":"Webbrowser"},
{"name":"wikipedia_en","type":"wikipedia","optional":true,"description":"The English article title. A separate attribute rather than a translation child, because an article title is an IDENTIFIER in another system and not a translation of a name — the two wikis disagree about which is the article and which the redirect","example":"Web browser"},
{"name":"level","type":"Level","default":"basic","description":"How far into the subject this record sits. `default` and therefore OPTIONAL on purpose: the seed then marks only what is NOT everyday, which keeps the classification of ~140 records readable as a diff and makes the safe direction the free one — a new record counts as basic and a beginner meets it","example":"expert"},
{"name":"note","type":"longString","optional":true,"description":"One sentence of context, shown after an answer","example":"Built on the same engine as Edge and Opera"}
]
```
