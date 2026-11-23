"use strict";

/*
 * Runs code once the GBC classes and services it uses exist, in both GBC generations:
 *
 * - GBC 6.00.07 and 6.00.09 define every module with modulum("Id", [dependencies], body). The body
 *   runs as soon as its dependencies are loaded, and receives (context, cls).
 * - A GBC without modulum (native ES6 classes) loads its whole core before the first customization
 *   file runs: the body runs right away, with window.gbc and window.gbc.classes.
 *
 * The same helper as in the @fourjs/gbc-loading-animations package.
 */

/**
 * @param {string} moduleName name of the modulum module
 * @param {string[]} dependencies names of the modulum modules body uses
 * @param {Function} body called with (context, cls)
 */
export function whenGbcReady(moduleName, dependencies, body) {
  if (typeof modulum === "function") {
    modulum(moduleName, dependencies, body);
    return;
  }
  const context = window.gbc;
  if (!context?.classes) {
    throw new Error(`${moduleName}: GBC is not loaded (window.gbc is missing)`);
  }
  body(context, context.classes);
}
