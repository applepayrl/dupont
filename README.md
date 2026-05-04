# Company Analyzer

A lightweight static app for visual ROE decomposition from annual SEC filings.

## Run Locally

Because this version has no build step, serve the folder with the included local proxy server:

```bash
python3 server.py
```

Then open `http://127.0.0.1:4174`.

The local server exposes `/sec?url=...`, so live SEC analysis works during development. Use the Demo button if you are opening the HTML without a server.

## SEC Proxy

The app expects a proxy base URL in `window.DUPONT_SEC_PROXY`. The included Cloudflare Worker exposes:

```text
GET /sec?url=<encoded SEC URL>
```

Set this in `config.js` before `src/app.js` loads:

```js
window.DUPONT_SEC_PROXY = "https://your-worker.your-subdomain.workers.dev";
```

The Worker adds an SEC-compliant `User-Agent`, restricts requests to `www.sec.gov` and `data.sec.gov`, and caches successful responses for six hours.

## Ratio Definitions

Traditional DuPont:

```text
ROE = Net Income / Revenue
  x Revenue / Average Assets
  x Average Assets / Average Shareholders' Equity
```

Operating decomposition:

```text
ROE = Operating ROA + Spread x Net Financial Leverage
Operating ROA = NOPAT / Average Net Assets
Spread = Operating ROA - Effective Interest Rate After Tax
Effective Interest Rate After Tax = Net Interest Expense After Tax / Average Net Debt
Net Financial Leverage = Average Net Debt / Average Equity
```

The first implementation uses SEC-standard US-GAAP tags and shows each calculation bridge in tile tooltips. Some companies, especially banks and insurers, may need industry-specific mappings.
