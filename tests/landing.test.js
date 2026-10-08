"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.join(__dirname, "../landing.js"), "utf8");

function setup({ hash = "", reduced = false, flightAvailable = true, flightThrows = false } = {}) {
  const classes = new Set();
  const handlers = {};
  const timers = new Map();
  const button = { addEventListener: (name, callback) => { handlers[`button:${name}`] = callback; } };
  const hero = { querySelector: () => button, hidden: false, classList: { remove: () => {} } };
  const flight = { starts: [], disposed: false, start(reduced) {
    this.starts.push(reduced);
    if (flightThrows) throw new Error("WebGL context unavailable");
    return true;
  }, dispose() { this.disposed = true; } };
  const content = { inert: false };
  const header = { inert: false };
  const heading = { focus: () => { heading.focused = true; } };
  const motion = { matches: reduced, addEventListener: (name, callback) => { handlers.motion = callback; } };
  const document = {
    body: { classList: {
      add: (...names) => names.forEach((name) => classes.add(name)),
      remove: (...names) => names.forEach((name) => classes.delete(name))
    } },
    querySelector: (selector) => ({ ".hero-section": hero, ".main-content": content, ".topbar": header })[selector],
    querySelectorAll: () => [],
    getElementById: () => heading
  };
  const window = {
    PristineFlight3D: flightAvailable ? flight : undefined,
    scrollY: 0,
    matchMedia: () => motion,
    addEventListener: (name, callback) => { handlers[name] = callback; },
    dispatchEvent: () => {}
  };
  let timerId = 0;
  vm.runInNewContext(source, {
    window, document, location: { hash }, Event: class {}, console: { warn() {} },
    setTimeout: (callback, delay) => { timers.set(++timerId, { callback, delay }); return timerId; },
    clearTimeout: (id) => timers.delete(id)
  });
  return { classes, handlers, timers, hero, content, header, heading, motion, flight };
}

for (const trigger of ["wheel", "keyboard", "touch"]) {
  const state = setup();
  assert.equal(state.content.inert, true);
  let prevented = false;
  const preventDefault = () => { prevented = true; };
  if (trigger === "wheel") state.handlers.wheel({ deltaY: 30, preventDefault });
  if (trigger === "keyboard") state.handlers.keydown({ key: "PageDown", preventDefault });
  if (trigger === "touch") {
    state.handlers.touchmove({ touches: [{ clientY: 240 }], preventDefault });
  }
  assert.equal(state.classes.has("landing-departing"), false, `${trigger} must not activate entrance`);
  assert.equal(prevented, true);
  assert.equal(state.timers.size, 0);
  state.handlers["button:click"]();
  state.handlers["button:click"]();
  assert.deepEqual(state.flight.starts, [false], "repeated clicks cannot restart the flight");
  assert.equal(state.classes.has("landing-departing"), true);
  assert.deepEqual([...state.timers.values()].map((timer) => timer.delay), [6500, 8100]);
  const callbacks = [...state.timers.values()];
  callbacks[0].callback();
  assert.equal(state.classes.has("landing-content-visible"), true);
  callbacks[1].callback();
  assert.equal(state.classes.has("landing-complete"), true);
  assert.equal(state.hero.hidden, true);
  assert.equal(state.content.inert, false);
  assert.equal(state.header.inert, false);
  assert.equal(state.flight.disposed, true);
  assert.equal(state.heading.focused, true);
  prevented = false;
  state.handlers.wheel({ deltaY: 30, preventDefault });
  assert.equal(prevented, false, "normal scrolling resumes");
}

const reduced = setup({ reduced: true });
reduced.handlers["button:click"]();
assert.deepEqual([...reduced.timers.values()].map((timer) => timer.delay), [3600, 3900]);
const deepLink = setup({ hash: "#analysis" });
assert.equal(deepLink.hero.hidden, true);
assert.equal(deepLink.content.inert, false);
const changedMotion = setup();
changedMotion.handlers["button:click"]();
changedMotion.handlers.motion({ matches: true });
assert.equal(changedMotion.content.inert, false);
assert.equal(changedMotion.timers.size, 0);
for (const options of [{ flightAvailable: false }, { flightThrows: true }, { flightAvailable: false, reduced: true }]) {
  const fallback = setup(options);
  fallback.handlers["button:click"]();
  assert.deepEqual([...fallback.timers.values()].map(timer => timer.delay), options.reduced ? [1400, 1700] : [2600, 4200]);
  [...fallback.timers.values()][1].callback();
  assert.equal(fallback.content.inert, false, "rendering failures must not trap the visitor");
}
console.log("Landing transition tests passed.");
