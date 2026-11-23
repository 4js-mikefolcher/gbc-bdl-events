/*
 * @fourjs/gbc-bdl-events: events from a Genero BDL program to the code of a GBC customization.
 *
 * Importing the package registers the bdlEvents front call module. Customization code listens
 * with the exported bdlEvents object (also available as gbc.bdlEvents):
 *
 *    import { bdlEvents } from "@fourjs/gbc-bdl-events";
 *    bdlEvents.on("badgeCount", (badge, { application }) => { ... });
 */
import "./js/BdlEventsFrontCall.js";

export { bdlEvents } from "./js/BdlEvents.js";
