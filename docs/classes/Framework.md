# Framework [reference_data]

[LABEL=name]
[PLURAL=de:Frameworks en:Frameworks]

A ready-made scaffold somebody writes their own program inside — and it belongs to exactly one language.

## About

A layperson hears *„das ist mit React gebaut"* and cannot place the word at all: not a program they
could install, not a language, not a file. A **framework** is the answer to a question nobody asked
them: most of what any program of a given sort has to do is the same every time, so somebody wrote
that part once and left the gaps for everybody else to fill.

**The one fact this entity exists for is `language`.** *Vue is JavaScript. Hibernate is Java.
Laravel is PHP.* That is the sentence worth carrying, and it is the reason this is its own entity
rather than a `ProductType` with products: a `Product` has a kind and a maker and no way to say
which language it belongs to, so the statement would have had nowhere to live. It is also the reason
the reference is **required** — a framework without a language is not a framework, it is a program.

**Why not a kind of program.** A framework is not something you run. It is something your own
program is written *inside*, which is a relation to a LANGUAGE and not a purpose of its own — and
`ProductType.purpose` answers *what does it do for me*, a question a framework answers only by
naming what it saves you.

**What is deliberately absent.** No version, no maker, no `part_of` between frameworks, no
distinction between a framework and a library — which is a real distinction, genuinely argued over
by the people who use them, and worth nothing to somebody who does not yet know what either is
(§43). `jQuery` and `Bootstrap` are on the list and would both lose that argument; they are here
because they are names a layperson has actually seen.

**The level is the framework's, not its language's.** `Vue` is `advanced` while `JavaScript` is
`basic`: the language is a word everybody has heard and the framework is not. A question about a
framework therefore only reaches a player who asked for that level, and the language it names may
be one they already know — which is the direction a question should run.

## Attributes

```json
[
{"name":"name","type":"string","unique":true,"label":true,"description":"What the framework is called, with its own capitalisation („jQuery\")","example":"Vue"},
{"name":"language","type":"ProgrammingLanguage","description":"Which language one writes in when using it. REQUIRED, because it is the fact this entity exists to state — a framework belongs to exactly one language, and that is what a learner takes away","example":"JavaScript"},
{"name":"purpose","type":"longString","description":"What it saves you writing yourself, in one sentence a layperson understands. A PREDICATE and lower-case, like every other `purpose` here","example":"keeps a page and the data behind it in step, so a change in one shows up in the other without being copied across by hand"},
{"name":"wikipedia_de","type":"wikipedia","optional":true,"description":"The German article title, exactly as the API resolves it","example":"Vue.js"},
{"name":"wikipedia_en","type":"wikipedia","optional":true,"description":"The English article title","example":"Vue.js"},
{"name":"level","type":"Level","default":"basic","description":"How far into the subject this framework sits — its own level and not its language's: a name a layperson has seen is `advanced`, one only a developer meets is `expert`","example":"expert"},
{"name":"note","type":"longString","optional":true,"description":"A true remark worth showing after an answer — typically which framework it is confused with, or what it was the first of","example":"Struts was the framework a great many Java web applications were built on around 2005, and a fair number of them are still running"}
]
```

## Error Messages

| Code | en | de |
|------|----|----|
| unique_name | A framework with this name already exists | Ein Framework mit diesem Namen gibt es schon |
