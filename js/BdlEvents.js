"use strict";

/*
 * The event bus: a Genero BDL program emits events with the bdlEvents.emit front call
 * (BdlEventsFrontCall.js), and customization code listens to them with bdlEvents.on.
 *
 * It is separate from the emitters of GBC (session, applications, widgets), so an event name
 * chosen in BDL can never reach a GBC listener. It exists as soon as the package is imported,
 * so code can subscribe before any session or application exists.
 */

/**
 * @typedef {Object} BdlEventInfo
 * @property {string} name the event name
 * @property {?Object} application the GBC application whose program emitted the event, or null
 *   for an event emitted from JavaScript without one
 */

/**
 * @callback BdlEventHandler
 * @param {*} data the value the program sent: an object for a RECORD, an array for a DYNAMIC
 *   ARRAY, a string, a number, or null. Every listener gets the same value: treat it as read-only
 * @param {BdlEventInfo} info
 */

/**
 * @typedef {Object} BdlEventListener
 * @property {BdlEventHandler} handler
 * @property {?(Object|number)} application the application filter: null for all applications
 */

/** @type {Map<string, Set<BdlEventListener>>} the listeners of each event name */
const listeners = new Map();

/** @type {Map<string, Map<?Object, {data: *, info: BdlEventInfo, order: number}>>} the last value of each event name, per application */
const lastValues = new Map();

/** Orders the remembered values, so that a replay without an application filter finds the latest */
let emitOrder = 0;

/**
 * @param {*} name
 * @returns {string} the name without surrounding blanks (a BDL CHAR variable is padded)
 */
const normalizeName = (name) => {
  const key = name === null || name === undefined ? "" : String(name).trim();
  if (key === "") {
    throw new TypeError("bdlEvents: the event name is empty");
  }
  return key;
};

/**
 * @param {?(Object|number)} filter an application, an application identifier, or null for all
 * @param {?Object} application the application of the event
 * @returns {boolean} true when an event of that application passes the filter
 */
const matchesApplication = (filter, application) => {
  if (filter === null || filter === undefined) {
    return true;
  }
  return application !== null && application !== undefined && (application === filter || application.applicationHash === filter);
};

/**
 * Calls one listener. A listener that fails does not stop the others, nor GBC.
 * @param {BdlEventListener} listener
 * @param {*} data
 * @param {BdlEventInfo} info
 */
const callListener = (listener, data, info) => {
  try {
    listener.handler(data, info);
  } catch (error) {
    console.error(`bdlEvents: a listener of "${info.name}" failed`, error);
  }
};

/**
 * @param {string} name
 * @param {?(Object|number)} filter
 * @returns {?{data: *, info: BdlEventInfo}} the last value of the event that passes the filter
 */
const lastValue = (name, filter) => {
  let latest = null;
  for (const [application, value] of lastValues.get(name) ?? []) {
    if (matchesApplication(filter, application) && (latest === null || value.order > latest.order)) {
      latest = value;
    }
  }
  return latest;
};

export const bdlEvents = {
  /**
   * Listens to an event.
   * @param {string} name the event name, as the program emits it (case-sensitive)
   * @param {BdlEventHandler} handler
   * @param {Object} [options]
   * @param {?(Object|number)} [options.application] only the events of this application: the
   *   application itself, or its identifier (a widget's getApplicationIdentifier())
   * @param {?Object} [options.widget] a GBC widget: the listener is removed when it is destroyed
   * @param {boolean} [options.replay] also call the handler at once with the last value of the
   *   event, if one was emitted (for events that describe a state)
   * @returns {function(): void} removes the listener
   */
  on(name, handler, { application = null, widget = null, replay = false } = {}) {
    const key = normalizeName(name);
    if (typeof handler !== "function") {
      throw new TypeError(`bdlEvents.on("${key}"): the handler is not a function`);
    }
    const listener = { handler, application };
    let set = listeners.get(key);
    if (!set) {
      set = new Set();
      listeners.set(key, set);
    }
    set.add(listener);

    let removed = false;
    const off = () => {
      if (removed) {
        return;
      }
      removed = true;
      set.delete(listener);
      if (set.size === 0 && listeners.get(key) === set) {
        listeners.delete(key);
      }
    };
    listener.off = off;
    if (widget) {
      widget.onDestroy(off);
    }
    if (replay) {
      const last = lastValue(key, application);
      if (last) {
        callListener(listener, last.data, last.info);
      }
    }
    return off;
  },

  /**
   * Emits an event. The bdlEvents.emit front call uses it, and JavaScript code can too.
   * @param {string} name the event name
   * @param {*} [data] the value given to the listeners
   * @param {?Object} [application] the application the event belongs to
   * @returns {number} the number of listeners called
   */
  emit(name, data = null, application = null) {
    const key = normalizeName(name);
    const info = Object.freeze({ name: key, application });
    let values = lastValues.get(key);
    if (!values) {
      values = new Map();
      lastValues.set(key, values);
    }
    values.set(application, { data, info, order: ++emitOrder });

    let called = 0;
    // A copy: a listener may remove itself, or another one
    for (const listener of [...(listeners.get(key) ?? [])]) {
      if (matchesApplication(listener.application, application)) {
        callListener(listener, data, info);
        called++;
      }
    }
    return called;
  },

  /**
   * @param {string} name
   * @returns {number} the number of listeners of the event, whatever their application filter
   */
  listenerCount(name) {
    return listeners.get(normalizeName(name))?.size ?? 0;
  }
};

/**
 * Forgets a closed application: its last values, and the listeners that listen to it only.
 * Not part of the public API: BdlEventsFrontCall.js calls it when an application closes.
 * @param {Object} application
 */
export function forgetApplication(application) {
  for (const [name, values] of lastValues) {
    values.delete(application);
    if (values.size === 0) {
      lastValues.delete(name);
    }
  }
  for (const set of listeners.values()) {
    for (const listener of [...set]) {
      if (listener.application !== null && matchesApplication(listener.application, application)) {
        listener.off();
      }
    }
  }
}
