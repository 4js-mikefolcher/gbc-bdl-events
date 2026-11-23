# @fourjs/gbc-bdl-events

Events from a Genero BDL program to the code of a Genero Browser Client (GBC 6) customization.
The program emits an event with a front call, and customization code listens to it:

```4gl
CALL ui.Interface.frontCall("bdlEvents", "emit", ["badgeCount", badge], [])
```

```js
import { bdlEvents } from "@fourjs/gbc-bdl-events";

bdlEvents.on("badgeCount", (badge) => { /* badge is the BDL record, as an object */ });
```

Typical uses: badge counts in the title bar, the user name or version in a footer, a command for
a table such as "reset the sort".

Needs a GBC 6 project built with Vite (`gbc build --vite`). Tested with GBC 6.00.09 and 6.00.10.

## Install it in a customization

The examples use a customization `customization/acme` of a GBC project.

1. Tell npm where the `@fourjs` packages are. Add a file `customization/acme/.npmrc`:

   ```
   @fourjs:registry=https://fourjs.jfrog.io/artifactory/api/npm/gbc-packages/
   ```

   Only the `@fourjs` packages come from there; everything else still comes from npmjs. Your
   Artifactory credentials go in your own `~/.npmrc` (the "Set Me Up" page of the `gbc-packages`
   repository gives the line), never in the customization.

2. Give the customization its own `package.json`, then install the package there. Without one,
   npm uses the `package.json` of the GBC project and adds the package to GBC's own
   dependencies. A minimal one is enough:

   ```json
   { "name": "acme", "private": true }
   ```

   ```
   cd customization/acme
   npm install @fourjs/gbc-bdl-events
   ```

   npm adds the package to that `package.json` and writes a `package-lock.json` next to it.
   Commit both with the customization, but not `node_modules`.

3. Import it from any `.js` file in the customization's `js/` folder, for example a new
   `js/Packages.js`:

   ```js
   import "@fourjs/gbc-bdl-events";
   ```

   The files that listen to events import `bdlEvents` from it too (see below). The package has
   no stylesheet.

4. Build from the GBC project root. A fresh copy of the project needs both installs:

   ```
   npm install                             # GBC's own dependencies (GBC ships no package-lock.json)
   npm ci --prefix customization/acme      # the customization's packages, from its package-lock.json
   gbc build --customization customization/acme --vite
   ```

## Emitting an event from BDL

```4gl
CALL ui.Interface.frontCall("bdlEvents", "emit", [eventName, data], [])
```

- **`eventName`**: the name the listeners use. It is case-sensitive (`"badgeCount"` and
  `"BadgeCount"` are two events); blanks around it are removed, so a `CHAR` variable works.
  The module and function names, `bdlEvents` and `emit`, can be written in any case.
- **`data`**, optional: what the listeners receive. A `RECORD` arrives as an object and a
  `DYNAMIC ARRAY` as an array: the runtime converts them to JSON, following the `json_name`
  and `json_null` attributes, and GBC parses it. In a record, numbers and `DECIMAL`s become
  numbers, a `BOOLEAN` `true` or `false`, and a `DATE` `"2026-11-23"`. As a parameter of its
  own, a `STRING` arrives as text, an `INTEGER`, `SMALLINT` or `FLOAT` as a number, and any
  other type as text: put it in a record to keep its JSON type. Without `data`, listeners
  receive `null`.
- **No return value.** The front call returns at once. The listeners run as soon as GBC has
  processed the update that carried the front call, so they see a window the program opened
  just before it. The program does not wait for them: an event emitted before a long query
  reaches the listeners while the query runs.

Errors:

| Error | When |
| ----- | ---- |
| -6331 | the front-end has no `bdlEvents` module: GDC, or a GBC built without this package |
| -6333 | the event name is NULL or empty (`err_get()` says so) |
| -6334 | no parameter, or more than two |

A program that can run on another front-end catches -6331:

```4gl
PUBLIC TYPE tBadge RECORD
   actionName  STRING,
   actionCount INTEGER
END RECORD

PUBLIC FUNCTION showBadge(badge tBadge) RETURNS ()
   TRY
      CALL ui.Interface.frontCall("bdlEvents", "emit", ["badgeCount", badge], [])
   CATCH
      # Not a GBC with @fourjs/gbc-bdl-events: no badge
   END TRY
END FUNCTION
```

## Listening in JavaScript

```js
import { bdlEvents } from "@fourjs/gbc-bdl-events";

const off = bdlEvents.on(name, handler, { application, widget, replay });
```

- **`handler(data, info)`**: `data` is what the program sent; `info.name` is the event name and
  `info.application` the GBC application of the program that sent it.
- **`application`**: only the events of that program: an application, or its identifier
  (`widget.getApplicationIdentifier()`, `application.applicationHash`). Without it, the
  listener gets the events of every program of the session.
- **`widget`**: a GBC widget. The listener is removed when the widget is destroyed.
- **`replay`**: if the event was already emitted, the handler is called at once with its last
  value. For events that describe a state (a count, a user name): a widget created after the
  front call still shows it.
- **`off()`** removes the listener. Without `widget`, call it when the listener is no longer
  needed.

In a widget, all three together:

```js
_initElement: function () {
  $super._initElement.call(this);
  bdlEvents.on("badgeCount", (badge) => this._showBadge(badge), {
    widget: this,                                 // removed with the widget
    application: this.getApplicationIdentifier(), // this program's events only
    replay: true                                  // the current count, even if sent before
  });
}
```

`getApplicationIdentifier()` is null for a widget that belongs to no program, which then gets
the events of every program.

Code that does not import the package can use `gbc.bdlEvents`. JavaScript can emit too:
`bdlEvents.emit(name, data, application)` calls the listeners at once and returns how many it
called. `bdlEvents.listenerCount(name)` counts the listeners of an event.

## Behaviour

- **Several programs in one session** (`RUN ... WITHOUT WAITING`): each event carries its
  program, and a listener with `application` gets only that program's events.
- **Last values** are kept per event name and per program, for `replay`. A listener without
  `application` replays the latest value of any program.
- **A program that closes** takes its last values with it, and the listeners that listen to it
  only are removed.
- **A listener that fails** does not stop the others; the browser console shows the event
  name, not the data.
- **Every listener gets the same data object**: treat it as read-only.
- **Separate from GBC's own events.** An event name cannot reach a GBC listener, whatever it is.

## Limits

- One way: listeners cannot answer the program. To send something back, a listener can run an
  action of the program's current dialog.
- Builds with Vite only, and needs GBC 6: GBC 5 passes records as JSON text.
- Tested in a browser through the GAS only, not in GDC or mobile apps in Universal Rendering.

## Coming from a JSONInfo.BDLInfo front call

Some customizations have a `JSONInfo.BDLInfo` front call that re-emits a JSON string on the GBC
session. With this package:

| | Before | Now |
| - | ------ | --- |
| BDL | `frontCall("JSONInfo", "BDLInfo", [name, util.JSON.stringify(rec)], [result])` | `frontCall("bdlEvents", "emit", [name, rec], [])` |
| JavaScript | `session.when(name, (event, session, obj) => ...)`, kept in a member and never removed | `bdlEvents.on(name, (obj) => ..., { widget: this, application: ... })` |
| Timing | 100 ms after the front call | as soon as GBC has processed the update |
| Scope | every program of the session | the emitting program, when `application` is given |

## License

MIT, see `LICENSE`.
