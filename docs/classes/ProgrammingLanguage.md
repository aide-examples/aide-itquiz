# ProgrammingLanguage [reference_data]

[LABEL=name]
[PLURAL=de:Programmiersprachen en:Programming languages]

The notation a program is written in — and the thing a layperson hears named daily without ever being told what one is.

## About

A layperson meets these words constantly — *„das ist in Python geschrieben"*, *„dafür braucht man
JavaScript"* — and has been offered no way to tell them apart, or to tell any of them from a file
format, a protocol or a program. The gap this entity closes is not *which* language but **what kind
of thing a language is at all**: a notation a person writes and a machine carries out.

**Its own entity, and the argument is `Protocol`'s.** A protocol is not a kind of format because
a program *opens* a file and *speaks* a protocol — two different verbs, so two different tables. A
program is **written in** a language: a third verb, and the same conclusion. Nothing here is a
`Product` either, for the reason [Concept](Concept.md) states: the test is whether anybody makes
instances of it, and while the Python Software Foundation certainly makes *Python*, what a
programmer makes is a program *in* Python — the language is the notation, not the article.

**Where HTML is, and why it is not here.** `HTML` is a [FileFormat](FileFormat.md) in the
*Markup language* group, and it stays there. It describes a document rather than a procedure, the
model already says so, and a second home for one thing is the drift this system keeps finding in
itself (§1: a NAME counts as a module — before adding one, check the model does not have it).
`CSS` is here rather than beside it, deliberately: it is a language a person writes, and the
architect placed it at the second level himself.

**Not a taxonomy.** There is no `paradigm` attribute, no compiled-versus-interpreted flag, no
`typing` field. Each is a real distinction and none of them is what a beginner needs; the one that
matters for the questions this drives is *what is it for*, which `purpose` already carries (§43).
Where a distinction turns out to be askable, it is one attribute added later, not four guessed now.

**The oddities are deliberate.** `awk` and `sed` are programs with a small language inside them and
`Bash` is the command line's own — all three are languages by the test that matters here (somebody
writes them and a machine carries them out), and each note says what else it is. `SQL` is the
sharpest case: it is the only one on the list that does not describe *how* to do something, and
saying that is worth more than the classification it breaks.

## Attributes

```json
[
{"name":"name","type":"string","unique":true,"label":true,"description":"What the language is called, as a person would write it — including its own capitalisation, which is part of the name („awk\", not „AWK\")","example":"Python"},
{"name":"long_name","type":"string","optional":true,"unique":true,"description":"What the abbreviation stands for, where the name IS one. Absent for a name that abbreviates nothing — and it must differ from the name, or the question „what does it stand for?\" answers itself, which is a mistake this system has already made once","example":"Cascading Style Sheets"},
{"name":"purpose","type":"longString","description":"What one writes in it, in one sentence a layperson understands. A PREDICATE and lower-case, like every other `purpose` here — it is substituted into several frames and only a predicate fits them all","example":"reads almost like English, and is used for everything from a school lesson to analysing data"},
{"name":"wikipedia_de","type":"wikipedia","optional":true,"description":"The German article title, exactly as the API resolves it","example":"Python (Programmiersprache)"},
{"name":"wikipedia_en","type":"wikipedia","optional":true,"description":"The English article title","example":"Python (programming language)"},
{"name":"level","type":"Level","default":"basic","description":"How far into the subject this language sits. Only two are `basic` — the two whose NAMES a layperson has certainly heard","example":"expert"},
{"name":"note","type":"longString","optional":true,"description":"A true remark worth showing after an answer — typically what this language is commonly mixed up with, or what else the thing is besides a language","example":"Java and JavaScript are not related; the name was a marketing decision in 1995 and has confused people ever since"}
]
```

## Error Messages

| Code | en | de |
|------|----|----|
| unique_name | A language with this name already exists | Eine Sprache mit diesem Namen gibt es schon |
| unique_long_name | Another language already has that long form | Eine andere Sprache hat diese Langform schon |
