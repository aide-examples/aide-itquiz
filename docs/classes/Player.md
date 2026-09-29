# Player [reference_data]

[LABEL=user]
[PLURAL=de:Spieler en:Players]

One person's settings — which level of question they want, and in which language.

## About

The quiz had no record of a person at all. `AskedQuestion.user` is a **string**: whatever name
was logged in when the question was asked. That was enough while every question was the same
question for everybody, and it stopped being enough the moment the subject matter acquired a
level (see [Types.md](../Types.md) → *Level*).

**The level is CHOSEN, not earned.** The architect was explicit: 🇩🇪 *„Der User kann den Level
aber frei auswählen."* Nothing here watches the answers and promotes anybody. That is a
deliberate limit rather than a simplification — a quiz that decides for you when you are ready
is making a claim about you, and this one does not.

The answer history is put to work elsewhere instead, and for a different job: pushing the
repetition of a question already answered correctly as far out as it can go. Which is what a
history is actually good for.

**It is a setting, not an account.** RAP owns the identity — `_users`, the roles, the login.
This holds what the QUIZ needs to know about a person and nothing else, so a player who never
touches the level selector never gets a row. An absent row is not an error: it means the
defaults, which is what a first-time visitor should get.

**Why the key is the username and not a foreign key.** RAP's `_users` is a system table, and
pointing an application entity at it would bind this system's data model to the framework's
internals. `AskedQuestion.user` already made that call, for the same reason, and one answer to
one question beats two (§17).

## Attributes

```json
[
{"name":"user","type":"string","unique":true,"label":true,"description":"The username, as RAP's login supplies it. Unique, because a person has one set of settings","example":"anna"},
{"name":"level","type":"Level","default":"basic","description":"The hardest questions this player wants to be asked. It is a CEILING and not a band: somebody who picks `expert` still meets Browser and DVD, because a quiz that only asked hard questions would teach nothing about how the easy and the hard connect","example":"advanced"},
{"name":"language","type":"Language","optional":true,"description":"The language they last played in, so it does not have to be picked again. Optional: absent means the page decides, which is what it did before this entity existed","example":"de"},
{"name":"note","type":"longString","optional":true,"description":"An operator's remark about this player — why their level was set by hand, for instance","example":"Schulungsteilnehmerin, Woche 2 — auf Aufbaustufe gesetzt"}
]
```

## Error Messages

| Code | en | de |
|------|----|----|
| unique_user | This player already has settings | Für diesen Spieler gibt es schon Einstellungen |
