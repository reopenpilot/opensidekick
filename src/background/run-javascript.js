// The run_javascript tool: execute model-written code in the active tab.
//
// Two paths, best first:
//
// 1. chrome.userScripts.execute() (Chrome 135+). The browser injects the source
//    itself, so the page's Content Security Policy does not apply. This is the
//    path Chrome documents for running user-provided code, and it is the only
//    one that works on sites without 'unsafe-eval' (GitHub, Google, most SaaS).
//    Chrome exposes chrome.userScripts only after the user turns on "Allow User
//    Scripts" for this extension (Chrome 138+) or Developer mode (120–137).
//
// 2. chrome.scripting.executeScript() + new Function(). Works everywhere the
//    User Scripts API is off, but evaluating a string runs under the page's CSP,
//    so strict-CSP sites refuse it. When that happens the error tells the model
//    (and through it, the user) how to turn on path 1.
//
// Both run in the page's MAIN world so the code sees the page's own globals,
// and both use function-body semantics: `return` sends a value back, and
// `await` works.

const MAX_RESULT_CHARS = 4000;

export const CSP_HINT =
  "This page's Content Security Policy blocks evaluating strings as code. " +
  "Ask the user to turn on \"Allow User Scripts\" for OpenSidekick " +
  "(chrome://extensions → OpenSidekick → Details), then try again: " +
  "run_javascript then injects code in a way the page's CSP does not block.";

const NO_RESULT =
  "No result. The code may have a syntax error. Write a function body and " +
  "use `return` to send a value back.";

// Serializes the result inside the page: only structured-clonable values cross
// back to the extension, and the model reads text anyway.
const SERIALIZE_IN_PAGE =
  "(out) => { let s; try { s = out === undefined ? 'undefined' : JSON.stringify(out); } " +
  "catch { s = String(out); } return { ok: true, result: s === undefined ? String(out) : s }; }";

/**
 * Wraps a function body as one script expression that resolves to
 * { ok, result | error }. The newline before the closing brace keeps a trailing
 * `// comment` in the model's code from swallowing it.
 */
export function wrapUserCode(code) {
  return `(async () => {\n${String(code || "")}\n})().then(${SERIALIZE_IN_PAGE}, ` +
    "(e) => ({ ok: false, error: String((e && e.message) || e) }))";
}

/** True when chrome.userScripts.execute can be called right now. */
export function userScriptsAvailable(api = globalThis.chrome) {
  try {
    // Chrome before 138 throws on access when Developer mode is off.
    return typeof api?.userScripts?.execute === "function";
  } catch {
    return false;
  }
}

function settle(r) {
  if (!r) return { ok: false, error: NO_RESULT };
  if (r.ok === false) return { ok: false, error: "JavaScript error: " + r.error };
  return { ok: true, result: String(r.result).slice(0, MAX_RESULT_CHARS) };
}

async function viaUserScripts(api, tabId, code) {
  const results = await api.userScripts.execute({
    target: { tabId },
    js: [{ code: wrapUserCode(code) }],
    world: "MAIN",
  });
  const first = results && results[0];
  if (first && first.error) return { ok: false, error: "JavaScript error: " + first.error };
  return settle(first && first.result);
}

async function viaScripting(api, tabId, code) {
  const results = await api.scripting.executeScript({
    target: { tabId },
    world: "MAIN",
    args: [String(code || "")],
    func: async (src) => {
      try {
        // Function body so `return` works; runs in the page's global scope.
        const out = await new Function(`return (async () => {\n${src}\n})();`)();
        let serialized;
        try {
          serialized = out === undefined ? "undefined" : JSON.stringify(out);
        } catch {
          serialized = String(out);
        }
        return { ok: true, result: serialized === undefined ? String(out) : serialized };
      } catch (e) {
        return { ok: false, error: String((e && e.message) || e) };
      }
    },
  });
  const r = settle(results && results[0] && results[0].result);
  if (!r.ok && /Content Security Policy|unsafe-eval/i.test(r.error)) r.error += " " + CSP_HINT;
  return r;
}

/** Runs `code` in tab `tabId`; returns { ok, url?, result | error, via }. */
export async function runJavascript(tabId, code, api = globalThis.chrome) {
  const via = userScriptsAvailable(api) ? "userScripts" : "scripting";
  try {
    const r = via === "userScripts" ? await viaUserScripts(api, tabId, code) : await viaScripting(api, tabId, code);
    if (!r.ok) return { ...r, via };
    // The URL lets chat history spot a sensitive page read this way.
    const tab = await api.tabs.get(tabId).catch(() => null);
    return { ...r, url: tab ? tab.url : undefined, via };
  } catch (e) {
    return { ok: false, error: "Could not run JavaScript here: " + ((e && e.message) || e), via };
  }
}
