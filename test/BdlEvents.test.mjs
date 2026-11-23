import assert from "node:assert/strict";
import { bdlEvents, forgetApplication } from "../js/BdlEvents.js";

const results = [];
const test = (name, fn) => { try { fn(); results.push("PASS  " + name); } catch (e) { results.push("FAIL  " + name + "  (" + e.message.split("\n")[0] + ")"); } };
const appA = { applicationHash: 1 }, appB = { applicationHash: 2 };
const origError = console.error; const errors = []; console.error = (...a) => errors.push(a.join(" "));

test("on + emit delivers data and info", () => {
  const got = [];
  const off = bdlEvents.on("t1", (d, i) => got.push([d, i.name, i.application]));
  assert.equal(bdlEvents.emit("t1", { a: 1 }, appA), 1);
  assert.deepEqual(got, [[{ a: 1 }, "t1", appA]]);
  off(); off();
  assert.equal(bdlEvents.listenerCount("t1"), 0);
  assert.equal(bdlEvents.emit("t1", 2), 0);
});
test("names are trimmed and case-sensitive", () => {
  const got = [];
  const off = bdlEvents.on("Badge", (d) => got.push(d));
  bdlEvents.emit("Badge   ", 1); bdlEvents.emit("badge", 2);
  assert.deepEqual(got, [1]); off();
});
test("empty name or bad handler throws", () => {
  assert.throws(() => bdlEvents.emit("  ", 1));
  assert.throws(() => bdlEvents.on(null, () => {}));
  assert.throws(() => bdlEvents.on("x", "nope"));
});
test("application filter by object and by hash", () => {
  const a = [], b = [], all = [];
  const o1 = bdlEvents.on("t2", (d) => a.push(d), { application: appA });
  const o2 = bdlEvents.on("t2", (d) => b.push(d), { application: 2 });
  const o3 = bdlEvents.on("t2", (d) => all.push(d));
  bdlEvents.emit("t2", "fromA", appA); bdlEvents.emit("t2", "fromB", appB); bdlEvents.emit("t2", "fromJs");
  assert.deepEqual(a, ["fromA"]); assert.deepEqual(b, ["fromB"]); assert.deepEqual(all, ["fromA", "fromB", "fromJs"]);
  o1(); o2(); o3();
});
test("replay gives the last value, per application or latest overall", () => {
  bdlEvents.emit("state", "A1", appA); bdlEvents.emit("state", "B1", appB); bdlEvents.emit("state", "A2", appA);
  const a = [], b = [], any = [], none = [];
  const offs = [
    bdlEvents.on("state", (d) => a.push(d), { application: appA, replay: true }),
    bdlEvents.on("state", (d) => b.push(d), { application: 2, replay: true }),
    bdlEvents.on("state", (d) => any.push(d), { replay: true }),
    bdlEvents.on("state", (d) => none.push(d))
  ];
  assert.deepEqual(a, ["A2"]); assert.deepEqual(b, ["B1"]); assert.deepEqual(any, ["A2"]); assert.deepEqual(none, []);
  assert.deepEqual([...[], ...[]], []);
  bdlEvents.on("never", () => assert.fail("no value to replay"), { replay: true })();
  offs.forEach((o) => o());
});
test("widget option removes the listener on destroy", () => {
  let hook = null; const widget = { onDestroy: (h) => { hook = h; } };
  bdlEvents.on("t3", () => {}, { widget });
  assert.equal(bdlEvents.listenerCount("t3"), 1); hook(); assert.equal(bdlEvents.listenerCount("t3"), 0);
});
test("a failing listener does not stop the others", () => {
  const got = [];
  const o1 = bdlEvents.on("t4", () => { throw new Error("boom"); });
  const o2 = bdlEvents.on("t4", (d) => got.push(d));
  assert.equal(bdlEvents.emit("t4", 5), 2); assert.deepEqual(got, [5]);
  assert.ok(errors.some((e) => e.includes('a listener of "t4" failed')));
  o1(); o2();
});
test("a listener may remove itself during emit", () => {
  const got = []; let off;
  off = bdlEvents.on("t5", (d) => { got.push(d); off(); });
  bdlEvents.emit("t5", 1); bdlEvents.emit("t5", 2);
  assert.deepEqual(got, [1]);
});
test("forgetApplication drops its values and its scoped listeners only", () => {
  bdlEvents.emit("t6", "A", appA); bdlEvents.emit("t6", "B", appB);
  bdlEvents.on("t6", () => {}, { application: appA }); bdlEvents.on("t6", () => {}, { application: 1 });
  const keep = bdlEvents.on("t6", () => {});
  forgetApplication(appA);
  assert.equal(bdlEvents.listenerCount("t6"), 1);
  const r = []; bdlEvents.on("t6", (d) => r.push(d), { replay: true })();
  assert.deepEqual(r, ["B"]); keep();
});
console.error = origError;
console.log(results.join("\n"));
process.exit(results.some((r) => r.startsWith("FAIL")) ? 1 : 0);
