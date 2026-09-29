const PILOT_BOOKING_WINDOW_DAYS = 7;
const PILOT_BOOKING_NOTICE_DAYS = 1;

/** @param {Date} date @returns {string} */
const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** @param {Date} [now] @returns {{minimumDate:string,maximumDate:string}} */
export function pilotBookingDateRange(now = new Date()) {
  const firstDay = new Date(now);
  firstDay.setDate(firstDay.getDate() + PILOT_BOOKING_NOTICE_DAYS);
  const lastDay = new Date(now);
  lastDay.setDate(lastDay.getDate() + PILOT_BOOKING_WINDOW_DAYS);
  return { minimumDate: localDate(firstDay), maximumDate: localDate(lastDay) };
}
