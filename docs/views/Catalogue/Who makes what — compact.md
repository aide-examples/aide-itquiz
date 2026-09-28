# Who makes what — compact

The same tree as [Who makes what](Who%20makes%20what.md), in the form that fits on a screen:
one line per node instead of a table under each.

Built to be compared with the long form rather than to replace it — the two differ in exactly
one thing, and that is what makes the comparison worth having.

## What makes it compact, and it is not the view

**No node carries an attribute list.** A detail child written without `: attrs` renders as a
plain list of clickable labels rather than a table with a header row
([aide-rap#324](https://github.com/aide-examples/aide-rap/issues/324)). That is the whole
difference in the template: four lines instead of four lines with columns on them.

**The second line comes from the ENTITY, not from here.** `[LABEL2=purpose]` on
[ProductType](../../classes/ProductType.md) puts the purpose under the name wherever a kind is
shown — in this tree, in an FK dropdown, in the detail panel. Nothing is declared per view,
which is the point: the kind's purpose is a property of the kind, and saying so once beats
listing it in every view that shows one.

`[LABEL2=part_of]` is the alternative and would read differently: the group under the name
(`Word processor` / *Office suite*) instead of the purpose. It was measured before choosing —
a kind with no group produces `_label2 = null`, so the line is simply absent rather than empty.
The purpose won because it is what this system is for; flipping it is one line in the class.

## Two things this view asked for, and got — in the framework

Both were findings of building it, both were the renderer's rather than this template's, and both
were filed and closed as [aide-rap#499](https://github.com/aide-examples/aide-rap/issues/499).
They are recorded here because this is the view that surfaced them, and because what they changed
is exactly what makes the compact form carry its weight.

**The caption lost its redundant half.** An FK node used to read
`product_type: Word processor (ProductType)` — the label right, and two of three parts frame. The
parenthetical is now dropped where the field name already says the type, matched
case-insensitively with separators and a trailing `_id` ignored, and then by equality. So
`product_type` loses its `(ProductType)` while `manufacturer` keeps its `(Company)` — the maker
is not the thing, which is the question this system asks. And `part_of` keeps its `(ProductType)`,
because the name is the relation, not the type.

Where the parenthetical goes, a small **➤** takes its place. That was Gero's correction and it
closed a hole the shortening had opened: a detail node's label toggles the node rather than
navigating, so the type in parentheses had been the only way out.

**`[LABEL2=purpose]` now reaches these nodes.** It was
[#498](https://github.com/aide-examples/aide-rap/issues/498) one field over, in the same two
functions: `GET /api/entities/ProductType` answered with `_label` and `_label2`, the same record
inside `GET /api/views/<detail>` with `_label` alone. A value the row already carried, dropped on
the way out. So a kind now shows its purpose under its name here as it does in an FK dropdown —
and in this shape the subtitle is the only attribute visible without naming one, which is most of
the reason to choose it.

A third thing came along with them: a back-reference group in a detail tree had no ➤ to the full
table, while the schema-derived group has had one for a long time. The two headers render
identically, so the absence read as a group without an arrow rather than a path with no way out.

## What it cannot do, and why

A kind shown as an **attribute** of the product (`Product: name, product_type`) would be more
compact still — one line, no node at all. It also ends there: an attribute is a value in a row,
a node is a child, and only a child can be descended into. The group behind the kind would be
unreachable.

Writing both does not help, and that is worth knowing rather than discovering: they share one
key in the record, the child loop runs after the attribute loop, and the node silently wins.
Measured — `product_type` came back as the object, never as the display string.

## Table

```detail
base: Company(ORDER BY name)
expand: 3
  Product(ORDER BY name)
    product_type
      part_of
```
