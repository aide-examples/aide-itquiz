# Company [reference_data]

[LABEL=name]
[PLURAL=de:Hersteller en:Companies]

Whoever makes a product — its own record, never a string on the product, because a layperson confuses the maker with the thing it makes.

## About

Whoever makes a product. A layperson confuses the maker with the thing it makes — *„Ist Mozilla ein Browser?"* — so the maker has to be its own record, never a string on the product.

## Attributes

```json
[
{"name":"name","type":"string","unique":true,"label":true,"description":"How the company is known","example":"Mozilla"},
{"name":"logo","type":"media","optional":true,"mime":"img","description":"The company's mark — a layperson recognises the picture before the name","example":"mozilla.svg"},
{"name":"wikipedia_de","type":"string","optional":true,"description":"The title of the German Wikipedia article, exactly as the API resolves it. Stored and VERIFIED rather than derived from the name: „Safari\" is a disambiguation page, „Bing\" has no German article at all, and a guessed title that happens to resolve to the wrong article is the one kind of error this system must not make","example":"Webbrowser"},
{"name":"wikipedia_en","type":"string","optional":true,"description":"The English article title. A separate attribute rather than a translation child, because an article title is an IDENTIFIER in another system and not a translation of a name — the two wikis disagree about which is the article and which the redirect","example":"Web browser"},
{"name":"note","type":"string","optional":true,"description":"One sentence of context, shown after an answer","example":"A non-profit foundation, not a company in the usual sense"}
]
```
