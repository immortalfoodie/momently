/**
 * Formats an integer INR rupee amount with standard Indian digit grouping and the rupee symbol.
 * WHY: Indian financial conventions group thousands as 3 digits and subsequent magnitudes
 * (lakhs, crores) in pairs of 2 digits, ensuring natural readability for Indian hosts.
 *
 * @param amount - Non-negative integer INR rupee amount.
 * @returns Formatted currency string (e.g., 150000 -> "₹1,50,000").
 */
export function formatInr(amount: number): string {
  const rounded = Math.round(amount);
  return `₹${new Intl.NumberFormat('en-IN').format(rounded)}`;
}

/**
 * Formats an integer INR amount into a compact human-readable representation using lakh and crore units.
 * WHY: Compact figures keep overview dashboards and card headers legible without cluttering the UI,
 * while amounts under one lakh retain full precision grouping.
 *
 * @param amount - Non-negative integer INR rupee amount.
 * @returns Compact formatted currency string (e.g., "₹1.5 lakh", "₹2 crore", "₹45,000").
 */
export function formatInrCompact(amount: number): string {
  const rounded = Math.round(amount);

  if (rounded < 100_000) {
    return formatInr(rounded);
  }

  if (rounded >= 10_000_000) {
    const crores = rounded / 10_000_000;
    const formatted =
      crores % 1 === 0 ? crores.toString() : parseFloat(crores.toFixed(2)).toString();
    return `₹${formatted} crore`;
  }

  const lakhs = rounded / 100_000;
  const formatted =
    lakhs % 1 === 0 ? lakhs.toString() : parseFloat(lakhs.toFixed(2)).toString();
  return `₹${formatted} lakh`;
}

/**
 * Converts minutes elapsed since midnight into a 12-hour AM/PM formatted time string.
 * WHY: Storing schedule offsets as pure integer minutes (0-1439) avoids timezone and daylight
 * savings corruption while calculating schedule sequences, but users need familiar 12-hour display.
 *
 * @param minute - Integer minutes since midnight (0 to 1439).
 * @returns Human-readable 12-hour time (e.g., 1170 -> "7:30 PM").
 */
export function formatMinuteOfDay(minute: number): string {
  const normalized = Math.max(0, Math.min(1439, Math.floor(minute)));
  const hours24 = Math.floor(normalized / 60);
  const minutes = normalized % 60;
  const period = hours24 >= 12 ? 'PM' : 'AM';
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const paddedMinutes = minutes.toString().padStart(2, '0');
  return `${hours12}:${paddedMinutes} ${period}`;
}
