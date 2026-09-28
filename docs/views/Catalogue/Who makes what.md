# Who makes what

A maker, the things it makes, and what kind of thing each one is.

The tree answers the question this whole system is about, in the one direction a layperson
never has it: not *„was ist Chrome?"* but *„was alles kommt eigentlich von Google?"*. Seeing
`Chrome · Google Search · Googlebot · Android` under one name is the fastest way to stop
equating a maker with one kind of thing — which is the confusion `Company` exists for.

## How it is built, and why that is not how it reads

It reads **Company → kind → thing**. It is BUILT the other way round: from the company to its
products, and the kind is fetched from each product.

That is the grammar rather than a choice. A child node in PascalCase is a back-reference
(`Product` points at `Company`), a child in snake_case is an FK drill-down (`product_type`
follows the product's own key outward). There is no relation from `Company` to `ProductType`
at all — a company does not have kinds, it has things, and the things have kinds. So the kind
can only be reached through the product, and it therefore hangs *under* it.

What that costs is a grouping: a company with two browsers shows the browser kind twice rather
than once above both. What it buys is that the tree states no relation the model does not have.

`expand: 2` opens the makers and their products; the kind opens on a click, which is the
moment the question *„und was ist das eigentlich?"* actually arises.

**And one level further, where there is one.** A kind that is part of another kind shows it:
`Microsoft Word` → `Word processor` → `Office suite`. The chain the whole model was built
around, walkable in the tree — and it appears only for the kinds that have a `part_of`, which
is the tree saying nothing where the model says nothing.

The product row shows its **name and nothing else**. `icon` belonged there and was taken out
again: no product carries a mark yet — a logo is a trademark and has to be supplied — so the
column stood empty across every row, which is a column that says „there is nothing here" in
the place where a reader looks for something. It goes back in the moment the first product has
one.

## Table

```detail
base: Company(ORDER BY name)
expand: 2
: name, note
  Product(ORDER BY name): name
    product_type: name, purpose
      part_of: name, purpose
```
