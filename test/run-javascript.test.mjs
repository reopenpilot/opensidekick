// Unit tests for run_javascript: the code wrapper and the choice between the
// User Scripts path and the chrome.scripting fallback (chrome APIs faked).

import { wrapUserCode, userScriptsAvailable, runJavascript, CSP_HINT } from "../src/background/run-javascript.js";

let fail = 0;
const ok = (c, m) => { console.log((c ? "ok  : " : "FAIL: ") + m); if (!c) fail = 1; };

// The wrapper is what the browser evaluates in the page; evaluate it here too.
const runWrapped = (code) => eval(wrapUserCode(code));

// --- wrapUserCode: function-body semantics, async, in-page serialization ---
let r = await runWrapped("return 1 + 1");
ok(r.ok === true && r.result === "2", "return value comes back as JSON text");
r = await runWrapped("await new Promise((res) => setTimeout(res, 5)); return { a: [1, 2] }");
ok(r.ok === true && r.result === '{"a":[1,2]}', "await works and objects are JSON-serialized");
r = await runWrapped("const x = 1;");
ok(r.ok === true && r.result === "undefined", "no return → \"undefined\"");
r = await runWrapped("throw new Error('boom')");
ok(r.ok === false && r.error === "boom", "a thrown error comes back as { ok: false, error }");
r = await runWrapped("const o = {}; o.self = o; return o;");
ok(r.ok === true && r.result === "[object Object]", "unserializable value falls back to String()");
r = await runWrapped("return 3 // trailing comment");
ok(r.ok === true && r.result === "3", "a trailing line comment does not swallow the wrapper");

// --- userScriptsAvailable ---
ok(userScriptsAvailable({ userScripts: { execute() {} } }) === true, "available when userScripts.execute exists");
ok(userScriptsAvailable({}) === false, "unavailable when chrome.userScripts is undefined (toggle off, Chrome 138+)");
ok(userScriptsAvailable({ get userScripts() { throw new Error("dev mode off"); } }) === false,
  "unavailable when access throws (Developer mode off, Chrome before 138)");
ok(userScriptsAvailable({ userScripts: {} }) === false, "unavailable without execute() (Chrome before 135)");

// --- runJavascript path choice, with fake chrome APIs ---
const tabs = { get: async (id) => ({ id, url: "https://example.com/" }) };
let injected = null;
const withUserScripts = {
  tabs,
  userScripts: {
    execute: async (inj) => { injected = inj; return [{ result: await eval(inj.js[0].code), frameId: 0 }]; },
  },
  scripting: { executeScript: async () => { throw new Error("scripting path must not run"); } },
};
r = await runJavascript(7, "return document_title_stub", withUserScripts);
ok(r.ok === false && r.via === "userScripts" && /document_title_stub is not defined/.test(r.error),
  "userScripts path: a ReferenceError in the code is reported");
r = await runJavascript(7, "return 6 * 7", withUserScripts);
ok(r.ok === true && r.result === "42" && r.url === "https://example.com/" && r.via === "userScripts",
  "userScripts path: result, url and via are returned");
ok(injected.world === "MAIN" && injected.target.tabId === 7, "userScripts path injects into the tab's MAIN world");

r = await runJavascript(7, "return 1 +;", { tabs, userScripts: { execute: async () => [{ result: null }] } });
ok(r.ok === false && /syntax error/.test(r.error), "userScripts path: a null result (syntax error) gets a clear message");
r = await runJavascript(7, "x", { tabs, userScripts: { execute: async () => [{ error: "Script failed" }] } });
ok(r.ok === false && r.error === "JavaScript error: Script failed", "userScripts path: an InjectionResult error is surfaced");
r = await runJavascript(7, "x", { tabs, userScripts: { execute: async () => { throw new Error("Cannot access a chrome:// URL"); } } });
ok(r.ok === false && /^Could not run JavaScript here: Cannot access/.test(r.error), "restricted pages explain why");

const cspError = "Evaluating a string as JavaScript violates the following Content Security Policy directive because 'unsafe-eval' is not an allowed source of script";
r = await runJavascript(7, "return 1", { tabs, scripting: { executeScript: async () => [{ result: { ok: false, error: cspError } }] } });
ok(r.ok === false && r.via === "scripting" && r.error.endsWith(CSP_HINT),
  "fallback: a CSP refusal tells the model how to turn on Allow User Scripts");
r = await runJavascript(7, "return 1", { tabs, scripting: { executeScript: async () => [{ result: { ok: true, result: "1" } }] } });
ok(r.ok === true && r.result === "1" && r.via === "scripting", "fallback: works where the page allows eval");

console.log(fail ? "\nSOME RUN-JAVASCRIPT TESTS FAILED" : "\nALL RUN-JAVASCRIPT TESTS PASSED");
process.exit(fail);
