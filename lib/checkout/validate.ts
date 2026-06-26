/** Shared checkout field validators (manual CheckoutForm + autobuy's mini
 *  delivery form both validate the same way). */

/** Valid Qatari mobile: local 8 digits starting 3/5/6/7, or +974XXXXXXXX / 974XXXXXXXX. */
export function isValidPhone(value: string): boolean {
  const digits = value.replace(/[\s-]/g, "");
  return /^[3567]\d{7}$/.test(digits) || /^(\+?974)[3567]\d{7}$/.test(digits);
}
