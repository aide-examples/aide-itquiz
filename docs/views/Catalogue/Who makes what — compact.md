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

## Two things it does not hide, and they are the tree's own vocabulary

An FK node captions itself with the **field name and the target entity**:
`product_type: Word processor (ProductType)`. In the long form that caption sits above a table
and reads as a heading; here it is the whole line, and it is three quarters technical. The
label is right, the frame around it is not.

And `[LABEL2=purpose]` does **not** reach these nodes — a kind shows its purpose under its name
in an FK dropdown and in the detail panel, but not here. Measured, not assumed; it is why the
compact form carries less than it could.

Both are the renderer's, not the template's, and both are worth a look before this form is
preferred over the long one.

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
