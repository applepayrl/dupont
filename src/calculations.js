import { averageFact, factValue, safeDivide, sumFacts, TAGS } from "./fact-selectors.js?v=3";
import { formatMoney, formatMultiple, formatPercent } from "./format.js?v=3";

export function buildAnnualAnalysis(companyFacts, filings) {
  return filings.map((filing, index) => {
    const prior = filings[index + 1] || {
      fiscalYear: String(Number(filing.fiscalYear) - 1),
      accession: filing.accession
    };
    const facts = collectFacts(companyFacts, filing, prior);
    return {
      filing,
      facts,
      traditional: traditionalDupont(filing, facts),
      operating: operatingRoe(filing, facts)
    };
  });
}

function collectFacts(companyFacts, filing, priorFiling) {
  const duration = { duration: "duration" };
  const instant = { duration: "instant" };
  const currentAssets = factValue(companyFacts, TAGS.assets, filing, instant);
  const priorAssets = factValue(companyFacts, TAGS.assets, priorFiling, instant);
  const currentEquity = factValue(companyFacts, TAGS.equity, filing, instant);
  const priorEquity = factValue(companyFacts, TAGS.equity, priorFiling, instant);

  const currentNetDebt = netDebt(companyFacts, filing);
  const priorNetDebt = netDebt(companyFacts, priorFiling);
  const taxExpense = factValue(companyFacts, TAGS.taxExpense, filing, duration);
  const pretaxIncome = factValue(companyFacts, TAGS.pretaxIncome, filing, duration);
  const taxRateRaw = safeDivide(taxExpense.value, pretaxIncome.value);
  const taxRate = Number.isFinite(taxRateRaw) ? Math.min(Math.max(taxRateRaw, 0), 0.45) : 0.21;

  const interestExpense = factValue(companyFacts, TAGS.interestExpense, filing, duration);
  const interestIncome = factValue(companyFacts, TAGS.interestIncome, filing, duration);
  const netInterestExpenseAfterTax = (Math.abs(valueOrZero(interestExpense)) - Math.abs(valueOrZero(interestIncome))) * (1 - taxRate);
  const netIncome = factValue(companyFacts, TAGS.netIncome, filing, duration);

  return {
    revenue: factValue(companyFacts, TAGS.revenue, filing, duration),
    netIncome,
    assets: currentAssets,
    equity: currentEquity,
    avgAssets: averageFact(currentAssets, priorAssets),
    avgEquity: averageFact(currentEquity, priorEquity),
    avgNetDebt: averageMoney(currentNetDebt.value, priorNetDebt.value),
    avgNetAssets: averageMoney(currentNetDebt.value, priorNetDebt.value) + averageFact(currentEquity, priorEquity),
    netDebt: currentNetDebt,
    taxExpense,
    pretaxIncome,
    taxRate,
    interestExpense,
    interestIncome,
    netInterestExpenseAfterTax,
    nopat: netIncome.value + netInterestExpenseAfterTax
  };
}

function traditionalDupont(filing, facts) {
  const profitMargin = safeDivide(facts.netIncome.value, facts.revenue.value);
  const assetTurnover = safeDivide(facts.revenue.value, facts.avgAssets);
  const equityMultiplier = safeDivide(facts.avgAssets, facts.avgEquity);
  const roe = profitMargin * assetTurnover * equityMultiplier;

  return [
    tile("Profit Margin", profitMargin, formatPercent(profitMargin), [
      `Net income ${formatMoney(facts.netIncome.value)} / revenue ${formatMoney(facts.revenue.value)}`,
      sourceLine(facts.netIncome),
      sourceLine(facts.revenue)
    ]),
    tile("Asset Turnover", assetTurnover, formatMultiple(assetTurnover), [
      `Revenue ${formatMoney(facts.revenue.value)} / average assets ${formatMoney(facts.avgAssets)}`,
      `Average assets use current and prior fiscal-year Assets when available.`,
      sourceLine(facts.assets)
    ]),
    tile("Equity Multiplier", equityMultiplier, formatMultiple(equityMultiplier), [
      `Average assets ${formatMoney(facts.avgAssets)} / average shareholders' equity ${formatMoney(facts.avgEquity)}`,
      sourceLine(facts.equity)
    ]),
    tile("ROE", roe, formatPercent(roe), [
      `${formatPercent(profitMargin)} x ${formatMultiple(assetTurnover)} x ${formatMultiple(equityMultiplier)} = ${formatPercent(roe)}`,
      `Fiscal year ${filing.fiscalYear}, ${filing.form}, accession ${filing.accession}`
    ])
  ];
}

function operatingRoe(filing, facts) {
  const operatingRoa = safeDivide(facts.nopat, facts.avgNetAssets);
  const effectiveInterestRateAfterTax = safeDivide(facts.netInterestExpenseAfterTax, facts.avgNetDebt);
  const spread = operatingRoa - effectiveInterestRateAfterTax;
  const nfl = safeDivide(facts.avgNetDebt, facts.avgEquity);
  const roe = operatingRoa + spread * nfl;

  return [
    tile("Operating ROA", operatingRoa, formatPercent(operatingRoa), [
      `NOPAT ${formatMoney(facts.nopat)} / average net assets ${formatMoney(facts.avgNetAssets)}`,
      `NOPAT = net income ${formatMoney(facts.netIncome.value)} + net interest expense after tax ${formatMoney(facts.netInterestExpenseAfterTax)}`,
      netAssetsLine(facts)
    ]),
    tile("Spread", spread, formatPercent(spread), [
      `Operating ROA ${formatPercent(operatingRoa)} - effective interest rate after tax ${formatPercent(effectiveInterestRateAfterTax)}`,
      `Effective interest rate after tax = ${formatMoney(facts.netInterestExpenseAfterTax)} / average net debt ${formatMoney(facts.avgNetDebt)}`
    ]),
    tile("Net Financial Leverage", nfl, formatMultiple(nfl), [
      `Average net debt ${formatMoney(facts.avgNetDebt)} / average shareholders' equity ${formatMoney(facts.avgEquity)}`,
      netDebtLine(facts)
    ]),
    tile("ROE", roe, formatPercent(roe), [
      `${formatPercent(operatingRoa)} + ${formatPercent(spread)} x ${formatMultiple(nfl)} = ${formatPercent(roe)}`,
      `Fiscal year ${filing.fiscalYear}, ${filing.form}, accession ${filing.accession}`
    ])
  ];
}

function netDebt(companyFacts, filing) {
  const debt = sumFacts(companyFacts, [TAGS.shortTermDebt, TAGS.longTermDebt], filing, { duration: "instant" });
  const cash = sumFacts(companyFacts, [TAGS.cash, TAGS.marketableSecurities], filing, { duration: "instant" });
  return {
    value: debt.value - cash.value,
    debt,
    cash
  };
}

function tile(label, raw, value, trace) {
  return { label, raw, value, trace, available: Number.isFinite(raw) };
}

function sourceLine(fact) {
  if (!fact || fact.present === false) return `Missing SEC fact for ${fact?.tag || "required value"}.`;
  return `SEC tag ${fact.tag}, period ending ${fact.end || "n/a"}, filed ${fact.filed || "n/a"}.`;
}

function valueOrZero(fact) {
  return Number.isFinite(fact?.value) ? fact.value : 0;
}

function averageMoney(current, prior) {
  if (Number.isFinite(current) && Number.isFinite(prior)) return (current + prior) / 2;
  if (Number.isFinite(current)) return current;
  return NaN;
}

function netDebtLine(facts) {
  return `Net debt = interest-bearing debt ${formatMoney(facts.netDebt.debt.value)} - cash and marketable securities ${formatMoney(facts.netDebt.cash.value)}.`;
}

function netAssetsLine(facts) {
  return `Average net assets use the net capital identity: average net debt ${formatMoney(facts.avgNetDebt)} + average shareholders' equity ${formatMoney(facts.avgEquity)}.`;
}
