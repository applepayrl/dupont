import { buildAnnualAnalysis } from "./calculations.js?v=3";
import { demoAnalysis, demoCompany } from "./demo-data.js?v=3";
import { filingUrl, latestAnnualFilingsFromRecordSets, SecClient } from "./sec-client.js?v=3";

const state = {
  companies: [],
  activeIndex: -1,
  selectedCompany: null,
  client: new SecClient()
};

const elements = {
  input: document.querySelector("#company-search"),
  results: document.querySelector("#company-results"),
  status: document.querySelector("#search-status"),
  analyzer: document.querySelector("#analyzer"),
  demoButton: document.querySelector("#demo-button")
};

init();

function init() {
  elements.input.addEventListener("focus", ensureCompaniesLoaded);
  elements.input.addEventListener("input", onSearchInput);
  elements.input.addEventListener("keydown", onSearchKeydown);
  elements.demoButton.addEventListener("click", () => renderAnalyzer(demoCompany, demoAnalysis, { demo: true }));
  document.addEventListener("click", (event) => {
    if (!event.target.closest(".search-panel")) hideResults();
  });
}

async function ensureCompaniesLoaded() {
  if (state.companies.length) return;
  setStatus("Loading SEC company index...");
  try {
    state.companies = await state.client.companies();
    setStatus("Type a company name or ticker.");
    if (elements.input.value.trim()) onSearchInput();
  } catch (error) {
    setStatus(`Could not load SEC company index. Configure a proxy or use Demo. ${error.message}`);
  }
}

function onSearchInput() {
  const query = elements.input.value.trim();
  state.activeIndex = -1;
  if (query.length < 1) {
    hideResults();
    return;
  }
  const matches = searchCompanies(query).slice(0, 9);
  renderResults(matches);
}

function onSearchKeydown(event) {
  const options = [...elements.results.querySelectorAll(".result-item")];
  if (!options.length) return;

  if (event.key === "ArrowDown") {
    event.preventDefault();
    state.activeIndex = Math.min(state.activeIndex + 1, options.length - 1);
    updateActiveOption(options);
  }

  if (event.key === "ArrowUp") {
    event.preventDefault();
    state.activeIndex = Math.max(state.activeIndex - 1, 0);
    updateActiveOption(options);
  }

  if (event.key === "Enter" && state.activeIndex >= 0) {
    event.preventDefault();
    options[state.activeIndex].click();
  }

  if (event.key === "Escape") hideResults();
}

function searchCompanies(query) {
  const normalized = query.toLowerCase();
  return state.companies
    .map((company) => {
      const ticker = company.ticker.toLowerCase();
      const name = company.name.toLowerCase();
      let score = 0;
      if (ticker === normalized) score += 100;
      if (ticker.startsWith(normalized)) score += 70;
      if (name.startsWith(normalized)) score += 55;
      if (name.includes(normalized)) score += 25;
      if (ticker.includes(normalized)) score += 20;
      return { company, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.company.name.localeCompare(b.company.name))
    .map((entry) => entry.company);
}

function renderResults(matches) {
  elements.results.innerHTML = "";
  if (!matches.length) {
    elements.results.hidden = true;
    elements.input.setAttribute("aria-expanded", "false");
    return;
  }

  const fragment = document.createDocumentFragment();
  matches.forEach((company, index) => {
    const button = document.createElement("button");
    button.className = "result-item";
    button.type = "button";
    button.role = "option";
    button.dataset.index = String(index);
    button.innerHTML = `
      <span class="ticker">${escapeHtml(company.ticker)}</span>
      <span class="name">${escapeHtml(company.name)}</span>
      <span class="exchange">${escapeHtml(company.exchange || "US")}</span>
    `;
    button.addEventListener("click", () => selectCompany(company));
    fragment.append(button);
  });
  elements.results.append(fragment);
  elements.results.hidden = false;
  elements.input.setAttribute("aria-expanded", "true");
}

function updateActiveOption(options) {
  options.forEach((option, index) => {
    option.classList.toggle("active", index === state.activeIndex);
    option.setAttribute("aria-selected", index === state.activeIndex ? "true" : "false");
  });
}

function hideResults() {
  elements.results.hidden = true;
  elements.input.setAttribute("aria-expanded", "false");
}

async function selectCompany(company) {
  state.selectedCompany = company;
  elements.input.value = `${company.ticker} - ${company.name}`;
  hideResults();
  setStatus(`Fetching latest annual filings for ${company.ticker}...`);
  elements.analyzer.innerHTML = loadingMarkup(company);

  try {
    const [submissions, companyFacts] = await Promise.all([
      state.client.submissions(company.cik),
      state.client.companyFacts(company.cik)
    ]);
    const filings = await loadAnnualFilings(company.cik, submissions, 4);
    const displayFilings = filings.slice(0, 3);
    if (displayFilings.length < 3) {
      throw new Error("Fewer than 3 annual filings were available in SEC submissions.");
    }
    const analysis = buildAnnualAnalysis(companyFacts, filings).slice(0, 3);
    setStatus(`Loaded ${company.ticker} filings through fiscal ${analysis[0].filing.fiscalYear}.`);
    renderAnalyzer(company, analysis, { cik: company.cik });
  } catch (error) {
    setStatus(`Unable to complete live analysis. ${error.message}`);
    elements.analyzer.innerHTML = errorMarkup(company, error);
  }
}

async function loadAnnualFilings(cik, submissions, count) {
  const recordSets = [submissions?.filings?.recent || {}];
  let filings = latestAnnualFilingsFromRecordSets(recordSets, count);
  for (const file of submissions?.filings?.files || []) {
    if (filings.length >= count) break;
    setStatus(`Fetching older annual filing index ${file.filingFrom} to ${file.filingTo}...`);
    const archivedRecords = await state.client.submissionFile(file.name);
    recordSets.push(archivedRecords);
    filings = latestAnnualFilingsFromRecordSets(recordSets, count);
  }
  return filings;
}

function renderAnalyzer(company, analysis, options = {}) {
  const latest = analysis[0]?.filing;
  const sourceLabel = options.demo ? "Demo data" : "SEC EDGAR live data";
  elements.analyzer.innerHTML = `
    <section class="company-card">
      <div>
        <p class="eyebrow">${sourceLabel}</p>
        <h2>${escapeHtml(company.name)}</h2>
        <p class="company-meta">
          <strong>${escapeHtml(company.ticker)}</strong>
          <span>${escapeHtml(company.exchange || "US listed")}</span>
          <span>Latest fiscal year ${escapeHtml(latest?.fiscalYear || "n/a")}</span>
        </p>
      </div>
      ${options.demo ? `<span class="source-pill">Demo mode</span>` : `<a class="source-pill" href="${filingUrl(options.cik, latest)}" target="_blank" rel="noreferrer">Latest 10-K</a>`}
    </section>

    <section class="note-band">
      <p>
        Hover a tile to inspect the bridge from SEC facts to the ratio. On mobile, press and hold a tile.
      </p>
    </section>

    ${ratioSection("Traditional DuPont ROE", ["Profit Margin", "Asset Turnover", "Equity Multiplier", "ROE"], ["x", "x"], analysis, "traditional")}
    ${ratioSection("Operating ROE Decomposition", ["Operating ROA", "Spread", "Net Financial Leverage", "ROE"], ["+", "x"], analysis, "operating")}
  `;
  bindTileInteractions();
}

function ratioSection(title, headers, operators, analysis, key) {
  const rows = analysis
    .map((year) => equationRow(year.filing.fiscalYear, year[key], operators))
    .join("");
  return `
    <section class="ratio-section">
      <div class="section-heading">
        <h3>${title}</h3>
      </div>
      <div class="equation-grid" style="--columns: ${headers.length + operators.length + 1}">
        <div class="grid-header year-header">Year</div>
        <div class="grid-header">${headers[0]}</div>
        <div class="operator-header"></div>
        <div class="grid-header">${headers[1]}</div>
        <div class="operator-header"></div>
        <div class="grid-header">${headers[2]}</div>
        <div class="operator-header"></div>
        <div class="grid-header">${headers[3]}</div>
        ${rows}
      </div>
    </section>
  `;
}

function equationRow(year, tiles, operators) {
  return `
    <div class="year-cell">${escapeHtml(year)}</div>
    ${ratioTile(tiles[0])}
    <div class="operator">${operators[0]}</div>
    ${ratioTile(tiles[1])}
    <div class="operator">${operators[1]}</div>
    ${ratioTile(tiles[2])}
    <div class="operator equals">=</div>
    ${ratioTile(tiles[3], true)}
  `;
}

function ratioTile(tile, isResult = false) {
  const trace = tile.trace.map((line) => `<li>${escapeHtml(line)}</li>`).join("");
  return `
    <button class="ratio-tile ${isResult ? "result-tile" : ""} ${tile.available ? "" : "missing"}" type="button">
      <span class="tile-label">${escapeHtml(tile.label)}</span>
      <span class="tile-value">${escapeHtml(tile.value)}</span>
      <span class="tooltip" role="tooltip">
        <strong>${escapeHtml(tile.label)}</strong>
        <ul>${trace}</ul>
      </span>
    </button>
  `;
}

function bindTileInteractions() {
  document.querySelectorAll(".ratio-tile").forEach((tile) => {
    tile.addEventListener("pointerdown", () => tile.classList.add("pressed"));
    tile.addEventListener("pointerup", () => tile.classList.remove("pressed"));
    tile.addEventListener("pointercancel", () => tile.classList.remove("pressed"));
    tile.addEventListener("pointerleave", () => tile.classList.remove("pressed"));
  });
}

function loadingMarkup(company) {
  return `
    <section class="company-card skeleton">
      <div>
        <p class="eyebrow">Loading SEC data</p>
        <h2>${escapeHtml(company.name)}</h2>
        <p class="company-meta"><strong>${escapeHtml(company.ticker)}</strong><span>Fetching submissions and XBRL facts...</span></p>
      </div>
    </section>
  `;
}

function errorMarkup(company, error) {
  return `
    <section class="note-band warning">
      <h2>${escapeHtml(company.ticker)} could not be analyzed yet</h2>
      <p>${escapeHtml(error.message)}</p>
      <p>
        For GitHub Pages, deploy the included Worker proxy and set <code>window.DUPONT_SEC_PROXY</code> before loading <code>src/app.js</code>.
      </p>
    </section>
  `;
}

function setStatus(message) {
  elements.status.textContent = message;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
