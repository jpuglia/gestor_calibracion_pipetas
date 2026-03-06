/**
 * Utility functions for measurement parsing and transformation.
 */

/**
 * Normalizes a measurement input string by replacing commas with dots
 * and parsing it to a float.
 * @param input The raw input string from the user.
 * @returns The parsed number or NaN if invalid.
 */
export const parseMeasurementInput = (input: string): number => {
  if (typeof input !== 'string' || input.trim() === '') return NaN;

  // Replace all commas with dots
  const normalized = input.replace(/,/g, '.');

  // Check if there's more than one dot (invalid numeric format)
  const dotCount = (normalized.match(/\./g) || []).length;
  if (dotCount > 1) {
    console.warn(`[Parser] Invalid input with multiple dots/commas: "${input}"`);
    return NaN;
  }

  // Parse to float
  const parsed = parseFloat(normalized);

  // Ensure the whole string was a valid number (parseFloat can be too lenient)
  // e.g., parseFloat('1.2abc') returns 1.2
  // We can use a regex or check if the result of Number() is also not NaN
  if (isNaN(parsed) || isNaN(Number(normalized))) {
    console.warn(`[Parser] Failed to parse input: "${input}"`);
    return NaN;
  }

  console.log(
    `[Parser] Raw input: "${input}" -> Normalized: "${normalized}" -> Parsed: ${parsed}`,
  );

  return parsed;
};

/**
 * Returns the absolute value of a number.
 * @param value The numeric value.
 * @returns The absolute value.
 */
export const toAbsoluteValue = (value: number): number => {
  const absValue = Math.abs(value);
  // console.log(`[Transformer] Original: ${value} -> Absolute: ${absValue}`);
  return absValue;
};

/**
 * Formats a measurement value for display.
 * @param value The numeric value.
 * @param decimals Number of decimal places.
 * @returns Formatted string.
 */
export const formatMeasurement = (value: number, decimals: number = 2): string => {
  if (isNaN(value)) return 'N/A';
  return value.toFixed(decimals);
};
