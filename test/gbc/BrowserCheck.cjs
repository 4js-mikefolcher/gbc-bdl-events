// Browser checks for @fourjs/gbc-bdl-events in GBC 6.00.10 (test customization zzbdlevents).
const { chromium } = require("playwright-core");
const URL = "http://localhost:6491/ua/r/BdlEventsTest?gbc=" + (process.argv[2] || "zzbdlevents");
const results = [];
const check = (name, ok, detail = "") => results.push(`${ok ? "PASS" : "FAIL"}  ${name}${detail ? "  (" + detail + ")" : ""}`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ channel: "chrome", headless: true });
  const page = await browser.newPage();
  const errors = [];
  page.on("console", (m) => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  await page.goto(URL);
  await page.locator(".eventProbe").first().waitFor({ timeout: 60000 });
  await sleep(500);

  // Every probe of every program: its application and the events it recorded. Found through the
  // GBC model, not the DOM: GBC detaches the widgets of a program that is not the current one.
  const probes = () => page.evaluate(() => gbc.SessionService.getCurrent().getApplications().flatMap((a) => {
    const found = [];
    const walk = (n) => {
      if (n.getTag() === "FormField" && n.attribute("name")?.endsWith(".probe")) {
        const w = n.getController()?.getWidget();
        if (w) found.push({ app: String(w.getApplicationIdentifier()), events: JSON.parse(w.getElement().dataset.events || "[]") });
      }
      n.getChildren().forEach(walk);
    };
    const ui = a.getNode(0); // not there yet while a program starts
    if (ui) walk(ui);
    return found;
  }));
  const appCount = () => gbc.SessionService.getCurrent().getApplications().length;
  // The visible program's two fields, in form order: errorStatus, errorText
  const fields = () => page.evaluate(() => {
    const inputs = [...document.querySelectorAll("input.gbc_EditWidget__input")].filter((e) => e.offsetParent);
    return { status: inputs[0]?.value ?? null, text: inputs[1]?.value ?? null };
  });
  const runAction = (name) => page.evaluate((n) => gbc.SessionService.getCurrent().getCurrentApplication().getActionApplicationService().executeActionByName(n), name);
  const lastCommand = async (app) => {
    const probe = (await probes()).find((p) => p.app === app);
    return probe.events.filter((e) => e.name === "command").at(-1);
  };

  const version = await page.evaluate(() => gbc.version);
  check("GBC " + (process.argv[3] || "6.00.10") + " with the test customization", version.startsWith((process.argv[3] || "6.00.10") + ".zzbdlevents"), version);
  check("gbc.bdlEvents exposed", await page.evaluate(() => typeof gbc.bdlEvents?.on === "function"));

  let [parent] = await probes();
  const steps = parent.events.map((e) => e.name + ":" + e.data.step);
  check("replay: state emitted before the window reaches the new probe", steps[0] === "probe:beforeWindow", steps.join(", "));
  check("same AUI update: the probe created with the window gets the event", steps[1] === "probe:sameOrder" && steps.length === 2, steps.join(", "));
  check("events carry the probe's own application", parent.events.every((e) => String(e.app) === parent.app), `probe app ${parent.app}, events ${parent.events.map((e) => e.app).join(",")}`);

  // A listener for every application, added from page code with replay
  await page.evaluate(() => {
    window.__all = [];
    gbc.bdlEvents.on("probe", (data, info) => window.__all.push(info.application.applicationHash + ":" + data.step), { replay: true });
  });
  check("replay without application filter gives the latest", (await page.evaluate(() => window.__all.join())).endsWith(":sameOrder"), await page.evaluate(() => window.__all.join()));

  await runAction("emitrecord");
  await sleep(800);
  let cmd = await lastCommand(parent.app);
  const d = cmd?.data ?? {};
  check("RECORD arrives as an object with typed members",
    d.step === "record" && d.count === 42 && d.amount === 1234.56 && d.flag === true && Array.isArray(d.tags) && d.tags.join() === "red,green" && typeof d.day === "string",
    JSON.stringify(d));
  check("front call status 0", (await fields()).status === "0", JSON.stringify(await fields()));

  await runAction("emitarray");
  await sleep(800);
  cmd = await lastCommand(parent.app);
  check("DYNAMIC ARRAY arrives as an array", Array.isArray(cmd?.data) && cmd.data.join() === "one,two", JSON.stringify(cmd?.data));

  await runAction("emitstring");
  await sleep(800);
  cmd = await lastCommand(parent.app);
  check("STRING arrives as the string", cmd?.data === "Hello", JSON.stringify(cmd?.data));

  await runAction("emitnodata");
  await sleep(800);
  cmd = await lastCommand(parent.app);
  check("no data arrives as null", cmd?.data === null, JSON.stringify(cmd));

  await runAction("emituppercase");
  await sleep(800);
  cmd = await lastCommand(parent.app);
  check("module and function names in upper case work", cmd?.data === "upper" && (await fields()).status === "0", JSON.stringify(cmd?.data));

  const countBefore = (await probes())[0].events.length;
  await runAction("emitnullname");
  await sleep(800);
  let f = await fields();
  check("NULL name: error -6333 with the reason", f.status === "-6333" && /NULL or empty/.test(f.text), JSON.stringify(f));
  await runAction("emitnoparameters");
  await sleep(800);
  f = await fields();
  check("no parameters: error -6334", f.status === "-6334", JSON.stringify(f));
  await runAction("emittoomany");
  await sleep(800);
  f = await fields();
  check("too many parameters: error -6334", f.status === "-6334", JSON.stringify(f));
  check("failed calls emit nothing", (await probes())[0].events.length === countBefore);

  // Delivered before the program goes on: the program sleeps 3 s after the front call
  const t0 = Date.now();
  await runAction("emitthensleep");
  let tEvent = null, tSlept = null;
  while (Date.now() - t0 < 10000 && (tEvent === null || tSlept === null)) {
    if (tEvent === null && (await lastCommand(parent.app))?.data?.step === "beforeSleep") tEvent = Date.now() - t0;
    if (tSlept === null && (await fields()).text === "slept") tSlept = Date.now() - t0;
    await sleep(100);
  }
  check("delivered at once, not when the program next talks to GBC", tEvent !== null && tSlept !== null && tEvent < 1500 && tSlept - tEvent > 1500, `event after ${tEvent} ms, program went on after ${tSlept} ms`);

  // A second program in the same session
  const counts = () => page.evaluate(() => ({ probe: gbc.bdlEvents.listenerCount("probe"), command: gbc.bdlEvents.listenerCount("command") }));
  const before = await counts();
  await runAction("child");
  await page.waitForFunction(appCount, null, { timeout: 30000 }).catch(() => {});
  for (let i = 0; i < 100 && (await probes()).find((p) => p.app !== parent.app)?.events.length !== 2; i++) await sleep(200);
  const all = await probes();
  parent = all.find((p) => p.app === parent.app);
  const child = all.find((p) => p.app !== parent.app);
  const childSteps = child.events.map((e) => e.data.step);
  check("child program: its probe gets its own events", childSteps.join() === "childBeforeWindow,childSameOrder", childSteps.join(", "));
  check("parent probe gets none of the child's events", !parent.events.some((e) => /^child/.test(e.data?.step ?? "")), parent.events.map((e) => e.data?.step ?? e.data).join(", "));
  check("unfiltered listener gets both programs' events", (await page.evaluate(() => window.__all.join())).includes(":childSameOrder"), await page.evaluate(() => window.__all.join()));
  const withChild = await counts();
  check("listener counts with the child", withChild.probe === before.probe + 1 && withChild.command === before.command + 1, `${JSON.stringify(before)} -> ${JSON.stringify(withChild)}`);

  await runAction("quit"); // the child is the current application
  await page.waitForFunction(() => gbc.SessionService.getCurrent().getApplications().length === 1, null, { timeout: 30000 });
  await sleep(800);
  const afterChild = await counts();
  check("child closed: its listeners are removed", afterChild.probe === before.probe && afterChild.command === before.command, JSON.stringify(afterChild));

  check("no browser errors", errors.length === 0, errors.join(" || ").slice(0, 500));
  await browser.close();
  console.log(results.join("\n"));
  process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
})().catch((e) => { console.log(results.join("\n")); console.error("STOPPED:", e.message.split("\n")[0]); process.exit(1); });
