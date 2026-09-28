const PILOT_BOOKING_WINDOW_DAYS = 7;

/** @param {Date} date @returns {string} */
const localDate = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;

/** @param {Date} [now] @returns {{minimumDate:string,maximumDate:string}} */
export function pilotBookingDateRange(now = new Date()) {
  const lastDay = new Date(now);
  lastDay.setDate(lastDay.getDate() + PILOT_BOOKING_WINDOW_DAYS);
  return { minimumDate: localDate(now), maximumDate: localDate(lastDay) };
}
