import { describe, it, expect } from 'vitest';

/**
 * Unit tests for billing calculation logic.
 * These test the pure math functions without database.
 */

// Extract the calculation logic for testability
function calculateBillTotals(subtotal, taxConfig, serviceChargePercent, discount) {
  let discountAmount = 0;
  if (discount && discount.type) {
    discountAmount = discount.type === 'percent'
      ? subtotal * (discount.value / 100)
      : Math.min(discount.value, subtotal);
  }

  const afterDiscount = subtotal - discountAmount;
  const taxRate = (taxConfig.cgst || 0) + (taxConfig.sgst || 0) + (taxConfig.vat || 0);
  const taxAmount = afterDiscount * (taxRate / 100);
  const serviceCharge = afterDiscount * (serviceChargePercent / 100);
  const total = afterDiscount + taxAmount + serviceCharge;

  return {
    subtotal: Math.round(subtotal * 100) / 100,
    discount_amount: Math.round(discountAmount * 100) / 100,
    tax_amount: Math.round(taxAmount * 100) / 100,
    service_charge: Math.round(serviceCharge * 100) / 100,
    total: Math.round(total * 100) / 100,
  };
}

describe('Billing Calculations', () => {
  const defaultTax = { cgst: 2.5, sgst: 2.5 };

  describe('Basic totals', () => {
    it('calculates subtotal, tax, and total correctly', () => {
      const result = calculateBillTotals(1000, defaultTax, 0, {});
      expect(result.subtotal).toBe(1000);
      expect(result.tax_amount).toBe(50); // 5% of 1000
      expect(result.total).toBe(1050);
    });

    it('handles zero subtotal', () => {
      const result = calculateBillTotals(0, defaultTax, 0, {});
      expect(result.total).toBe(0);
      expect(result.tax_amount).toBe(0);
    });

    it('handles VAT instead of CGST/SGST', () => {
      const result = calculateBillTotals(1000, { vat: 10 }, 0, {});
      expect(result.tax_amount).toBe(100);
      expect(result.total).toBe(1100);
    });
  });

  describe('Discounts', () => {
    it('applies percentage discount correctly', () => {
      const result = calculateBillTotals(1000, defaultTax, 0, { type: 'percent', value: 10 });
      expect(result.discount_amount).toBe(100);
      expect(result.tax_amount).toBe(45); // 5% of 900
      expect(result.total).toBe(945);
    });

    it('applies fixed discount correctly', () => {
      const result = calculateBillTotals(1000, defaultTax, 0, { type: 'fixed', value: 200 });
      expect(result.discount_amount).toBe(200);
      expect(result.tax_amount).toBe(40); // 5% of 800
      expect(result.total).toBe(840);
    });

    it('caps fixed discount at subtotal', () => {
      const result = calculateBillTotals(100, defaultTax, 0, { type: 'fixed', value: 500 });
      expect(result.discount_amount).toBe(100);
      expect(result.total).toBe(0);
    });

    it('handles 100% discount', () => {
      const result = calculateBillTotals(1000, defaultTax, 0, { type: 'percent', value: 100 });
      expect(result.discount_amount).toBe(1000);
      expect(result.total).toBe(0);
    });

    it('ignores empty discount object', () => {
      const result = calculateBillTotals(1000, defaultTax, 0, {});
      expect(result.discount_amount).toBe(0);
      expect(result.total).toBe(1050);
    });
  });

  describe('Service charge', () => {
    it('calculates service charge on after-discount amount', () => {
      const result = calculateBillTotals(1000, defaultTax, 5, {});
      expect(result.service_charge).toBe(50); // 5% of 1000
      expect(result.total).toBe(1100); // 1000 + 50 tax + 50 service
    });

    it('applies service charge after discount', () => {
      const result = calculateBillTotals(1000, defaultTax, 10, { type: 'percent', value: 20 });
      // After 20% discount: 800
      // Tax: 5% of 800 = 40
      // Service: 10% of 800 = 80
      // Total: 800 + 40 + 80 = 920
      expect(result.discount_amount).toBe(200);
      expect(result.service_charge).toBe(80);
      expect(result.total).toBe(920);
    });
  });

  describe('Rounding', () => {
    it('rounds to 2 decimal places', () => {
      const result = calculateBillTotals(333.33, { cgst: 2.5, sgst: 2.5 }, 0, {});
      expect(result.tax_amount).toBe(16.67); // 5% of 333.33 = 16.6665 → 16.67
      expect(result.total).toBe(350);
    });

    it('handles penny precision correctly', () => {
      const result = calculateBillTotals(99.99, defaultTax, 0, { type: 'percent', value: 15 });
      // Discount: 14.9985 → 15.00
      // After: 84.99
      // Tax: 4.2495 → 4.25
      // Total: 89.24
      expect(result.discount_amount).toBe(15);
    });
  });
});
