# Tests

Not published with the package (`files` in `package.json` leaves this folder out).

## The event bus

```
npm test
```

`BdlEvents.test.mjs` checks `js/BdlEvents.js` in Node, without GBC: listeners, application
filters, replay, removal with a widget, a failing listener, a closed application.

## In GBC

`gbc/` drives the package in a browser, through a GAS:

- `gbc/js/EventProbeWidget.js`: a test widget. A LABEL with STYLE "eventProbe" records the
  "probe" and "command" events of its program in `data-events`.
- `gbc/bdl/`: a BDL program whose MENU emits each kind of event (record, array, string, no data,
  NULL name, wrong parameter counts, upper-case module name, an emit followed by a SLEEP), and
  starts a second copy of itself in the same session.
- `gbc/BrowserCheck.cjs`: 23 Playwright checks of what the probes recorded.

To run it:

1. Make a test customization in a GBC 6 project: `config.json`, an empty
   `sass/customization.scss`, a `package.json`, the package installed from `npm pack`,
   `js/Packages.js` with `import "@fourjs/gbc-bdl-events";`, and `gbc/js/EventProbeWidget.js`
   in its `js/`. Set `customizationSuffix` to `zzbdlevents` in `config.json`. Build it with
   `gbc build --customization customization/<name> --vite`.
2. Compile the program: `fglcomp -M -Wall -Werror` for both modules (the controller first),
   `fglform -M -W all` for the form, and copy the `.4st` next to them.
3. Start a dispatcher on port 6491 with an application `BdlEventsTest` whose `FGLLDPATH`,
   `FGLRESOURCEPATH` and working directory are the compiled program, and
   `res.path.gbc.user` a directory that holds the built customization.
4. With `playwright-core` installed and Chrome on the machine:
   `node gbc/BrowserCheck.cjs <gbc-name> <gbc-version>`, for example
   `node gbc/BrowserCheck.cjs zzbdlevents 6.00.10`.
