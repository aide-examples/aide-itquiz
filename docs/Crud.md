# CRUD

Which entities the selector offers, in which order.

Views live beside this, one file per view under [views/](views/), the folder naming the
group the selector shows them under.

## Facts

- ProductType
- ProductTypeText
- Product
- Company
- FormatGroup
- FileFormat
- FormatSupport
- Protocol
- Connector
- ConnectorPort
- Concept

## Questions

- QuestionTemplate
- QuestionPhrase

## History

- AskedQuestion

## System

- Media
- MediaGroup
- MediaGroupMember
- Audit

`MediaGroup` and `MediaGroupMember` are listed because the title page IS a medium: the
operator who maintains it has to be able to see the group it lives in. Without them the
page can be uploaded and never curated.
