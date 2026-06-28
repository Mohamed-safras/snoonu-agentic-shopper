/**
 * Currency formatting only. We never convert or invent prices — every amount
 * comes straight from the Snoonu MCP in its native currency (QAR by default;
 * the MCP also supports USD/GBP/AUD/CAD/EUR via the `currency` param).
 */

export function fmtPrice(amount: number, currency = "QAR"): string {
  if (currency === "QAR") {
    // Qatari convention: "QR 125.50" (2 decimals, no ISO code shown).
    return (
      "QR " +
      amount.toLocaleString("en-US", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      })
    );
  }
  try {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency,
      maximumFractionDigits: 2,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toLocaleString("en-US")}`;
  }
}
