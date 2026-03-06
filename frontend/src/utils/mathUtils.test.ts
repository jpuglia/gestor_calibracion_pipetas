import { describe, expect, it } from 'vitest';

import { formatMeasurement, parseMeasurementInput, toAbsoluteValue } from './mathUtils';

describe('mathUtils', () => {
  describe('parseMeasurementInput', () => {
    it('should parse simple decimal string with dot', () => {
      expect(parseMeasurementInput('1.23')).toBe(1.23);
    });

    it('should parse decimal string with comma', () => {
      expect(parseMeasurementInput('1,23')).toBe(1.23);
    });

    it('should parse negative decimal with dot', () => {
      expect(parseMeasurementInput('-0.45')).toBe(-0.45);
    });

    it('should parse negative decimal with comma', () => {
      expect(parseMeasurementInput('-0,45')).toBe(-0.45);
    });

    it('should handle multiple commas (replace all)', () => {
      // This is an edge case, but we replace all commas
      expect(parseMeasurementInput('1,234,5')).toBe(NaN); // parseFloat('1.234.5') is 1.234 but we want to be safe
    });

    it('should return NaN for non-numeric strings', () => {
      expect(parseMeasurementInput('abc')).toBeNaN();
    });

    it('should return NaN for strings with letters', () => {
      expect(parseMeasurementInput('1.2abc')).toBeNaN();
    });
  });

  describe('toAbsoluteValue', () => {
    it('should return positive for positive input', () => {
      expect(toAbsoluteValue(1.5)).toBe(1.5);
    });

    it('should return positive for negative input', () => {
      expect(toAbsoluteValue(-1.5)).toBe(1.5);
    });

    it('should return zero for zero input', () => {
      expect(toAbsoluteValue(0)).toBe(0);
    });
  });

  describe('formatMeasurement', () => {
    it('should format with default decimals (2)', () => {
      expect(formatMeasurement(1.2345)).toBe('1.23');
    });

    it('should format with specified decimals', () => {
      // Using 1.2346 to avoid rounding ambiguity in precision
      expect(formatMeasurement(1.2346, 3)).toBe('1.235');
    });

    it('should return N/A for NaN', () => {
      expect(formatMeasurement(NaN)).toBe('N/A');
    });
  });
});
