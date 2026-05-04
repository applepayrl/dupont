export function formatPercent(value, decimals = 1) {
  if (!Number.isFinite(value)) return "n/a";
  return `${(value * 100).toFixed(decimals)}%`;
}

export function formatMultiple(value, decimals = 2) {
  if (!Number.isFinite(value)) return "n/a";
  return `${value.toFixed(decimals)}x`;
}

export function formatNumber(value, decimals = 1) {
  if (!Number.isFinite(value)) return "n/a";
  return value.toFixed(decimals);
}

export function formatMoney(value) {
  if (!Number.isFinite(value)) return "n/a";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000_000) return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`;
  if (abs >= 1_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `${sign}$${(abs / 1_000).toFixed(1)}K`;
  return `${sign}$${abs.toFixed(0)}`;
}

export function formatDate(value) {
  if (!value) return "n/a";
  return new Intl.DateTimeFormat("en-US", { year: "numeric", month: "short", day: "numeric" }).format(new Date(value));
}

export function accessionNoDashes(accession) {
  return accession?.replaceAll("-", "") ?? "";
}
