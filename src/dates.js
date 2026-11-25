'use strict';
// Jalali dates in Asia/Tehran, Persian digits for humans, ISO for machines.
// Money is always integer Rial. The bot never stores Toman.
const FA_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
function toFaDigits(s) {
  return String(s).replace(/\d/g, (d) => FA_DIGITS[d]);
}
function jalaliParts(date) {
  const parts = new Intl.DateTimeFormat('en-u-ca-persian', {
    timeZone: 'Asia/Tehran', year: 'numeric', month: 'numeric', day: 'numeric',
  }).formatToParts(date);
  const get = (t) => Number(parts.find((p) => p.type === t).value);
  return { y: get('year'), m: get('month'), d: get('day') };
}
function todayJalali(date = new Date()) {
  const { y, m, d } = jalaliParts(date);
  return toFaDigits(`${y}/${String(m).padStart(2, '0')}/${String(d).padStart(2, '0')}`);
}
function timeTehran(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Tehran', hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(date);
  const get = (t) => parts.find((p) => p.type === t).value;
  return toFaDigits(`${get('hour')}:${get('minute')}`);
}
module.exports = { toFaDigits, jalaliParts, todayJalali, timeTehran };
