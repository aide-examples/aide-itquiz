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
{"name":"note","type":"string","optional":true,"description":"One sentence of context, shown after an answer","example":"A non-profit foundation, not a company in the usual sense"}
]
```
