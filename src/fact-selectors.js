const USD = ["USD"];
const PURE = ["pure"];
const SHARES = ["shares"];

export const TAGS = {
  revenue: [
    "RevenueFromContractWithCustomerExcludingAssessedTax",
    "Revenues",
    "SalesRevenueNet",
    "RevenuesNetOfInterestExpense"
  ],
  netIncome: ["NetIncomeLoss", "ProfitLoss"],
  assets: ["Assets"],
  equity: ["StockholdersEquity", "StockholdersEquityIncludingPortionAttributableToNoncontrollingInterest"],
  currentAssets: ["AssetsCurrent"],
  currentLiabilities: ["LiabilitiesCurrent"],
  cash: [
    "CashAndCashEquivalentsAtCarryingValue",
    "CashCashEquivalentsRestrictedCashAndRestrictedCashEquivalents",
    "CashAndDueFromBanks"
  ],
  marketableSecurities: ["ShortTermInvestments", "MarketableSecuritiesCurrent"],
  shortTermDebt: [
    "ShortTermBorrowings",
    "ShortTermDebt",
    "ShortTermDebtAndCurrentMaturitiesOfLongTermDebt",
    "LongTermDebtCurrent"
  ],
  longTermDebt: ["LongTermDebtNoncurrent", "LongTermDebtAndFinanceLeaseObligationsNoncurrent"],
  liabilities: ["Liabilities"],
  taxExpense: ["IncomeTaxExpenseBenefit"],
  pretaxIncome: ["IncomeLossFromContinuingOperationsBeforeIncomeTaxesExtraordinaryItemsNoncontrollingInterest"],
  interestExpense: [
    "InterestExpenseNonOperating",
    "InterestExpenseDebt",
    "InterestExpense",
    "InterestAndDebtExpense",
    "FinanceLeaseInterestExpense"
  ],
  interestIncome: ["InvestmentIncomeInterest", "InterestIncomeNonOperating"]
};

export function factValue(companyFacts, tagNames, filing, options = {}) {
  const { units = USD, duration = "any", instantEnd, preferAnnual = true } = options;
  for (const tagName of tagNames) {
    const tag = companyFacts?.facts?.["us-gaap"]?.[tagName];
    if (!tag?.units) continue;
    const facts = units.flatMap((unit) => tag.units[unit] || []);
    const chosen = chooseFact(facts, filing, { duration, instantEnd, preferAnnual });
    if (chosen) {
      return {
        value: Number(chosen.val),
        tag: tagName,
        unit: chosen.unit || units[0],
        start: chosen.start,
        end: chosen.end,
        filed: chosen.filed,
        form: chosen.form,
        accession: chosen.accn,
        fy: chosen.fy,
        fp: chosen.fp
      };
    }
  }
  return missingFact(tagNames);
}

export function sumFacts(companyFacts, factRequests, filing, options) {
  const parts = factRequests.map((request) => factValue(companyFacts, request, filing, options));
  const present = parts.filter((part) => part.present !== false && Number.isFinite(part.value));
  return {
    value: present.reduce((sum, fact) => sum + fact.value, 0),
    tag: present.map((fact) => fact.tag).join(" + ") || "missing",
    parts,
    present: present.length > 0
  };
}

function chooseFact(facts, filing, { duration, instantEnd, preferAnnual }) {
  const accessionMatches = facts.filter((fact) => fact.accn === filing.accession);
  const fiscalMatches = facts.filter((fact) => String(fact.fy) === filing.fiscalYear && ["10-K", "10-K/A"].includes(fact.form));
  let candidates = accessionMatches.length ? accessionMatches : fiscalMatches;

  if (filing.reportDate) {
    const reportDateMatches = candidates.filter((fact) => fact.end === filing.reportDate);
    if (reportDateMatches.length) candidates = reportDateMatches;
  }

  const yearMatches = candidates.filter((fact) => String(fact.fy) === filing.fiscalYear);
  if (yearMatches.length) candidates = yearMatches;

  if (instantEnd) {
    const exact = candidates.filter((fact) => fact.end === instantEnd);
    if (exact.length) candidates = exact;
  }

  if (duration === "duration") {
    candidates = candidates.filter((fact) => fact.start && fact.end && fact.start !== fact.end);
  }

  if (duration === "instant") {
    candidates = candidates.filter((fact) => !fact.start || fact.start === fact.end);
  }

  if (preferAnnual) {
    const annual = candidates.filter((fact) => fact.fp === "FY");
    if (annual.length) candidates = annual;

    const fullYear = candidates.filter((fact) => {
      if (!fact.start || !fact.end) return false;
      const days = (new Date(fact.end) - new Date(fact.start)) / 86400000;
      return days >= 300 && days <= 380;
    });
    if (fullYear.length) candidates = fullYear;
  }

  return candidates
    .filter((fact) => Number.isFinite(Number(fact.val)))
    .sort((a, b) => {
      const endDelta = new Date(b.end || 0) - new Date(a.end || 0);
      if (endDelta) return endDelta;
      return new Date(b.filed || 0) - new Date(a.filed || 0);
    })[0];
}

function missingFact(tagNames) {
  return {
    value: NaN,
    tag: tagNames.join(" | "),
    present: false
  };
}

export function safeDivide(numerator, denominator) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator === 0) return NaN;
  return numerator / denominator;
}

export function averageFact(current, prior) {
  if (Number.isFinite(current?.value) && Number.isFinite(prior?.value)) return (current.value + prior.value) / 2;
  if (Number.isFinite(current?.value)) return current.value;
  return NaN;
}

export function unitsFor(kind) {
  if (kind === "pure") return PURE;
  if (kind === "shares") return SHARES;
  return USD;
}
