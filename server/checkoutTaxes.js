// GST/HST only: CRA rates verified 2026-10-11. No separate PST/QST
// registrations have been confirmed. Export treatment assumes dispatch from Canada.
export const GST_HST = Object.freeze({
  AB: 500, BC: 500, MB: 500, NB: 1500, NL: 1500, NS: 1400, NT: 500,
  NU: 500, ON: 1300, PE: 1500, QC: 500, SK: 500, YT: 500,
});
export const COUNTRIES = new Set(('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW').split(' '));
export function cleanAddress(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('Enter your shipping address.');
  const result = {};
  for (const key of ['name','line1','line2','city','region','postalCode','country','email']) {
    const value = input[key] ?? '';
    if (typeof value !== 'string' || value.length > 150 || /[\x00-\x1f<>]/.test(value)) throw new Error('Invalid shipping address.');
    result[key] = value.trim();
  }
  result.country = result.country.toUpperCase();
  result.region = result.region.toUpperCase();
  if (!COUNTRIES.has(result.country) || !result.name || !result.line1 || !result.city ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(result.email)) throw new Error('Complete your name, email, street, city and country.');
  if (result.country === 'CA') {
    if (!Object.hasOwn(GST_HST, result.region)) throw new Error('Select a Canadian province or territory.');
    result.postalCode = result.postalCode.toUpperCase().replace(/\s/g, '');
    if (!/^[ABCEGHJ-NPRSTVXY]\d[ABCEGHJ-NPRSTV-Z]\d[ABCEGHJ-NPRSTV-Z]\d$/.test(result.postalCode)) throw new Error('Enter a valid Canadian postal code.');
    const prefixes = {A:['NL'], B:['NS'], C:['PE'], E:['NB'], G:['QC'], H:['QC'], J:['QC'], K:['ON'], L:['ON'], M:['ON'], N:['ON'], P:['ON'], R:['MB'], S:['SK'], T:['AB'], V:['BC'], X:['NT','NU'], Y:['YT']};
    if (!prefixes[result.postalCode[0]].includes(result.region)) throw new Error('Postal code does not match the province.');
  }
  if (result.country === 'US' && (!/^[A-Z]{2}$/.test(result.region) || !/^\d{5}(-\d{4})?$/.test(result.postalCode))) throw new Error('Enter a US state code and ZIP code.');
  return result;
}
export function totals(subtotalCents, address, salesTaxEnabled = true) {
  if (!Number.isSafeInteger(subtotalCents) || subtotalCents <= 0 || subtotalCents > 100000000) throw new Error('Cart total is outside the supported checkout range.');
  const rate = salesTaxEnabled === false ? 0 : address.country === 'CA' ? GST_HST[address.region] : 0;
  if (rate === undefined) throw new Error('Unknown Canadian province.');
  const taxCents = Math.round(subtotalCents * rate / 10000);
  return {currency:'CAD', subtotalCents, shippingCents:0, taxCents, totalCents:subtotalCents + taxCents,
    taxLabel: salesTaxEnabled === false ? 'Sales tax · not charged' : address.country !== 'CA' ? 'Canadian GST/HST · export (0%)' : `${rate > 500 ? 'HST' : 'GST'} (${rate / 100}%)`};
}
