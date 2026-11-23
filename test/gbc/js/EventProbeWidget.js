/*
 * Test widget for @fourjs/gbc-bdl-events: a LABEL with STYLE "eventProbe" records every "probe"
 * and "command" event of its own application in data-events, as JSON.
 */
import { bdlEvents } from "@fourjs/gbc-bdl-events";

modulum("EventProbeWidget", ["LabelWidget", "WidgetFactory"], function (context, cls) {
  cls.EventProbeWidget = context.oo.Class(cls.LabelWidget, function ($super) {
    return {
      __name: "EventProbeWidget",
      __templateName: "LabelWidget",

      _initElement: function () {
        $super._initElement.call(this);
        const element = this.getElement();
        element.classList.add("eventProbe");
        element.dataset.app = String(this.getApplicationIdentifier());
        element.dataset.events = "[]";
        const record = (data, info) => {
          const events = JSON.parse(element.dataset.events);
          events.push({ name: info.name, data, app: info.application?.applicationHash ?? null, at: Date.now() });
          element.dataset.events = JSON.stringify(events);
        };
        const application = this.getApplicationIdentifier();
        bdlEvents.on("probe", record, { widget: this, application, replay: true });
        bdlEvents.on("command", record, { widget: this, application });
      }
    };
  });
  cls.WidgetFactory.registerBuilder("Label[customWidget=eventProbe]", cls.EventProbeWidget);
});
