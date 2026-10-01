# CRUD

Which entities the selector offers, in which order.

The **grouping** is not here. An entity's area — the coloured heading it stands under — comes from
[DataModel.md](DataModel.md), and the selector opens a new group whenever that area changes as it
walks this list. So the `## <Area>` headings below are structure for a reader: what decides where an
entity appears is its **position** in this list, and `---` is a column break. Guarded by
`area-membership-drift`.

`sort:` looks like a table option and is not one — it reaches the SQL, so it governs every list of
that entity: the API, every FK picker, the back-reference blocks, exports. Why, in
[rap:developer/areas-source.md](rap:developer/areas-source.md).

Views live beside this, one file per view under [views/](views/), the folder naming the
group the selector shows them under.

## Facts

- ProductType
- ProductGroup
- Product
- Company
- FormatGroup
- FileFormat
- FormatSupport
- Protocol
- Connector
- ConnectorPort
- StorageMedium
- Concept
- ProgrammingLanguage
- Framework
- Translation

## Questions

- QuestionTemplate
- QuestionPhrase

## History

- Player
- AskedQuestion

## System

- Media
- MediaGroup
- MediaGroupMember
- Audit

`MediaGroup` and `MediaGroupMember` are listed because the title page IS a medium: the
operator who maintains it has to be able to see the group it lives in. Without them the
page can be uploaded and never curated.
