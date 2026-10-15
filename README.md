# OpenSidekick (userScripts fork)

Fork of [esterhuizen/opensidekick](https://github.com/esterhuizen/opensidekick) 0.3.1 with one change: the `run_javascript` tool runs code through Chrome's User Scripts API, so it also works on sites with a strict Content Security Policy (GitHub, Google, most web apps). Upstream evaluates the code with `new Function`, which those sites block.

## Install

1. Download `opensidekick-0.3.1-userscripts.zip` from [Releases](https://github.com/reopenpilot/opensidekick/releases/latest) and unzip it.
2. Open `chrome://extensions`, turn on **Developer mode**, click **Load unpacked**, and select the unzipped folder.
3. If you also have OpenSidekick from the Chrome Web Store, turn that one off. This is a separate extension, so add your model provider again in its settings.

To update, replace the folder with the new release and click the reload icon on the extension's card. Unpacked extensions don't update by themselves.

## Enable JavaScript on strict-CSP sites

1. At `chrome://extensions`, open OpenSidekick's **Details** and turn on **Allow User Scripts** (Chrome 135+; before Chrome 138, Developer mode is enough).
2. In OpenSidekick settings → Behavior, check **Enable the run-JavaScript tool**. The settings page confirms when User Scripts are in use.

With the switch off, `run_javascript` works as it does upstream.

For everything else, see the [upstream README](https://github.com/esterhuizen/opensidekick#readme). MIT licensed, see [LICENSE](LICENSE).
