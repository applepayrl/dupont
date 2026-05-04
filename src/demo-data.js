export const demoCompany = {
  cik: "0000320193",
  ticker: "AAPL",
  name: "Apple Inc.",
  exchange: "Nasdaq"
};

export const demoAnalysis = [
  year("2025", ["24.3%", "1.07x", "5.18x", "134.6%"], ["31.0%", "18.2%", "5.71x", "135.0%"]),
  year("2024", ["23.9%", "1.12x", "5.05x", "135.2%"], ["30.7%", "17.9%", "5.85x", "135.4%"]),
  year("2023", ["25.3%", "1.09x", "4.69x", "129.1%"], ["32.4%", "16.5%", "5.86x", "129.1%"])
];

function year(fiscalYear, traditionalValues, operatingValues) {
  const filing = {
    fiscalYear,
    form: "10-K",
    accession: `demo-${fiscalYear}`,
    filingDate: `${fiscalYear}-10-31`
  };
  return {
    filing,
    traditional: labels(["Profit Margin", "Asset Turnover", "Equity Multiplier", "ROE"], traditionalValues, fiscalYear),
    operating: labels(["Operating ROA", "Spread", "Net Financial Leverage", "ROE"], operatingValues, fiscalYear)
  };
}

function labels(labelList, values, fiscalYear) {
  return labelList.map((label, index) => ({
    label,
    value: values[index],
    available: true,
    trace: [
      `Demo calculation bridge for ${label}, fiscal year ${fiscalYear}.`,
      "Live mode replaces this with SEC tag names, values, filing accession, and formula arithmetic."
    ]
  }));
}
