/**
 * Currency formatting only. We never convert or invent prices — every amount
 * comes straight from the Kapruka MCP in its native currency (LKR by default;
 * the MCP also supports USD/GBP/AUD/CAD/EUR via the `currency` param).
 */

export function fmtPrice(amount: number, currency = "LKR"): string {
  if (currency === "LKR") {
    // Sri Lankan convention: "Rs 5,210".
    return "Rs " + Math.round(amount).toLocaleString("en-US");
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
