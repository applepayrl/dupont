import { accessionNoDashes } from "./format.js";

const SEC_ORIGIN = "https://www.sec.gov";
const SEC_DATA_ORIGIN = "https://data.sec.gov";

export const DEFAULT_PROXY = proxyDefault();

export class SecClient {
  constructor(proxyBase = DEFAULT_PROXY) {
    this.proxyBase = proxyBase.replace(/\/$/, "");
  }

  async fetchJson(url) {
    const endpoint = this.proxyBase ? `${this.proxyBase}/sec?url=${encodeURIComponent(url)}` : url;
    const response = await fetch(endpoint, { headers: { Accept: "application/json" } });
    if (!response.ok) {
      throw new Error(`SEC request failed (${response.status}) for ${url}`);
    }
    return response.json();
  }

  async companies() {
    const data = await this.fetchJson(`${SEC_ORIGIN}/files/company_tickers_exchange.json`);
    const fields = data.fields || [];
    const rows = data.data || [];
    const idx = Object.fromEntries(fields.map((field, index) => [field, index]));
    return rows
      .map((row) => ({
        cik: String(row[idx.cik]).padStart(10, "0"),
        ticker: String(row[idx.ticker] || "").toUpperCase(),
        name: row[idx.name] || "",
        exchange: row[idx.exchange] || ""
      }))
      .filter((company) => company.ticker && company.name);
  }

  async submissions(cik) {
    return this.fetchJson(`${SEC_DATA_ORIGIN}/submissions/CIK${cik}.json`);
  }

  async companyFacts(cik) {
    return this.fetchJson(`${SEC_DATA_ORIGIN}/api/xbrl/companyfacts/CIK${cik}.json`);
  }
}

function proxyDefault() {
  const browserWindow = globalThis.window;
  if (!browserWindow) return "";
  if (browserWindow.DUPONT_SEC_PROXY) return browserWindow.DUPONT_SEC_PROXY;
  const host = browserWindow.location?.hostname;
  if (host === "127.0.0.1" || host === "localhost") return browserWindow.location.origin;
  return "";
}

export function latestAnnualFilings(submissions, count = 3) {
  const recent = submissions?.filings?.recent || {};
  const filings = [];
  const forms = recent.form || [];
  for (let index = 0; index < forms.length; index += 1) {
    if (!["10-K", "10-K/A"].includes(forms[index])) continue;
    const accession = recent.accessionNumber?.[index];
    const fiscalYear = recent.reportDate?.[index]?.slice(0, 4) || recent.filingDate?.[index]?.slice(0, 4);
    if (!accession || !fiscalYear) continue;
    if (filings.some((filing) => filing.fiscalYear === fiscalYear)) continue;
    filings.push({
      accession,
      accessionCompact: accessionNoDashes(accession),
      form: forms[index],
      fiscalYear,
      reportDate: recent.reportDate?.[index],
      filingDate: recent.filingDate?.[index],
      primaryDocument: recent.primaryDocument?.[index]
    });
    if (filings.length === count) break;
  }
  return filings;
}

export function filingUrl(cik, filing) {
  return `${SEC_ORIGIN}/Archives/edgar/data/${Number(cik)}/${filing.accessionCompact}/${filing.primaryDocument || ""}`;
}
