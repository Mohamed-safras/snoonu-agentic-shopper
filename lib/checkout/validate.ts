/** Shared checkout field validators (manual CheckoutForm + autobuy's mini
 *  delivery form both validate the same way). */

/** Valid Sri Lankan phone: local 0XXXXXXXXX or +94XXXXXXXXX / 94XXXXXXXXX. */
export function isValidPhone(value: string): boolean {
  const digits = value.replace(/[\s-]/g, "");
  return /^0\d{9}$/.test(digits) || /^(\+?94)\d{9}$/.test(digits);
}
