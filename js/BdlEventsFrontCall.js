"use strict";

/*
 * The bdlEvents front call module: a Genero BDL program emits an event with
 *
 *    CALL ui.Interface.frontCall("bdlEvents", "emit", [name, data], [])
 *
 * The front call returns at once, and the listeners run as soon as GBC has finished processing the
 * update that carried it (a zero-delay timer). A listener therefore sees the widgets of a window
 * the program opened just before the front call, and the program does not wait for it.
 *
 * Not through the application's scheduler (callbackCommand): a command added while a front call
 * runs is held until the program next talks to GBC, so an event emitted before a long query or a
 * SLEEP would reach the listeners only after it.
 */
import { whenGbcReady } from "./GbcReady.js";
import { bdlEvents, forgetApplication } from "./BdlEvents.js";

whenGbcReady("BdlEventsFrontCall", ["FrontCallService", "ModelHelper"], function (context, cls) {
  // For customization code that does not import the package: gbc.bdlEvents
  context.bdlEvents = bdlEvents;

  // Registered in lower case: GBC lower-cases the module and function names when it starts, and
  // looks them up in lower case, so the program may write "bdlEvents" in any case. A name in
  // mixed case registered after that start would never be found.
  context.FrontCallService.modules.bdlevents = {
    /**
     * Front call bdlEvents.emit(name [, data]). Runs with the front call controller as this.
     * @param {...*} parameters the event name, then the optional data: a RECORD or a DYNAMIC
     *   ARRAY arrives parsed (GBC 6), any other type as its value
     * @returns {?Array} no return values, or nothing after an error
     */
    emit(...parameters) {
      if (parameters.length < 1 || parameters.length > 2) {
        this.parametersError("bdlEvents.emit takes an event name and an optional value");
        return null;
      }
      const [name, data = null] = parameters;
      if (name === null || String(name).trim() === "") {
        this.runtimeError("the event name is NULL or empty");
        return null;
      }
      const application = this.getAnchorNode().getApplication();
      window.setTimeout(() => {
        bdlEvents.emit(name, data, application);
      }, 0);
      return [];
    }
  };

  const model = new cls.ModelHelper(null);
  model.addCloseApplicationListener((application) => {
    forgetApplication(application);
  });
});
