# Product [asset_instance]

[LABEL=name]
[PLURAL=de:Produkte en:Products]

A concrete thing somebody made: Chrome, Firefox, Google Search, Googlebot, Android. It has
exactly one type and exactly one maker, and those two facts produce most of the questions.

## Attributes

```json
[
{"name":"name","type":"string","unique":true,"label":true,"description":"The name people use","example":"Chrome"},
{"name":"product_type","type":"ProductType","description":"What kind of thing it is","example":"Browser"},
{"name":"manufacturer","type":"Company","description":"Who makes it","example":"Google"},
{"name":"icon","type":"media","optional":true,"mime":"img","description":"The product's mark — recognised long before the name is","example":"chrome.svg"},
{"name":"note","type":"string","optional":true,"description":"One sentence of context, shown after an answer","example":"Built on the same engine as Edge and Opera"}
]
```
