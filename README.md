# OpenSidekick (userScripts fork)

Fork of [esterhuizen/opensidekick](https://github.com/esterhuizen/opensidekick) 0.3.1 with one change: the `run_javascript` tool runs code through Chrome's User Scripts API, so it also works on sites with a strict Content Security Policy (GitHub, Google, most web apps). Upstream evaluates the code with `new Function`, which those sites block.

## Enable

1. Load this folder at `chrome://extensions` (Developer mode → Load unpacked).
2. OpenSidekick → **Details** → turn on **Allow User Scripts** (Chrome 135+; before Chrome 138, Developer mode is enough).
3. OpenSidekick settings → Behavior → **Enable the run-JavaScript tool**. The settings page confirms when User Scripts are in use.

With the switch off, `run_javascript` works as it does upstream.

For everything else, see the [upstream README](https://github.com/esterhuizen/opensidekick#readme). MIT licensed, see [LICENSE](LICENSE).
