// Shared validation rules used by both the renderer (inline form errors) and the
// main process (last line of defence before writing to SQLite). Pure functions only:
// no Node or Electron imports, so the renderer bundle can import this file too.

export type FieldErrors<K extends string = string> = Partial<Record<K, string>>;

export const LIMITS = {
  nameMax: 80,
  codeMax: 30,
  descriptionMax: 300,
  notesMax: 500,
  maxPrice: 10_000_000,
  maxStock: 1_000_000,
  maxPoints: 1_000_000,
} as const;

// Pakistani mobile (03XX-XXXXXXX / +923XXXXXXXXX) or landline (0XX-XXXXXXX); spaces and dashes ignored.
const PHONE_PATTERN = /^(\+92|0092|0)[1-9]\d{8,10}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const CODE_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._-]*$/;
const BARCODE_PATTERN = /^[A-Za-z0-9-]{4,32}$/;

export const normalizePhone = (value: string) => value.replace(/[\s-]/g, '');

export function hasErrors(errors: FieldErrors) {
  return Object.values(errors).some(Boolean);
}

export function firstError(errors: FieldErrors) {
  return Object.values(errors).find(Boolean) ?? '';
}

// Parses a form value as a number. Empty or non-numeric input returns NaN rather than 0,
// so "abc" or "" can never silently become a valid amount.
export function parseNumber(value: string | number | null | undefined) {
  if (typeof value === 'number') return value;
  const trimmed = (value ?? '').trim();
  if (!trimmed) return Number.NaN;
  return Number(trimmed);
}

function checkName(value: string, label: string, required = true) {
  const trimmed = value.trim();
  if (!trimmed) return required ? `${label} is required` : undefined;
  if (trimmed.length < 2) return `${label} must be at least 2 characters`;
  if (trimmed.length > LIMITS.nameMax) return `${label} must be ${LIMITS.nameMax} characters or fewer`;
  return undefined;
}

function checkMoney(value: string | number, label: string, { allowZero = true } = {}) {
  const amount = parseNumber(value);
  if (!Number.isFinite(amount)) return `${label} must be a number`;
  if (amount < 0) return `${label} cannot be negative`;
  if (!allowZero && amount === 0) return `${label} must be greater than zero`;
  if (amount > LIMITS.maxPrice) return `${label} is too large`;
  if (Math.abs(amount * 100 - Math.round(amount * 100)) > 1e-6) {
    return `${label} can have at most 2 decimal places`;
  }
  return undefined;
}

function checkWholeNumber(value: string | number, label: string, max: number, min = 0) {
  const amount = parseNumber(value);
  if (!Number.isFinite(amount)) return `${label} must be a number`;
  if (!Number.isInteger(amount)) return `${label} must be a whole number`;
  if (amount < min) return min === 0 ? `${label} cannot be negative` : `${label} must be at least ${min}`;
  if (amount > max) return `${label} is too large`;
  return undefined;
}

function checkPhone(value: string, required: boolean) {
  const trimmed = value.trim();
  if (!trimmed) return required ? 'Phone number is required' : undefined;
  if (!PHONE_PATTERN.test(normalizePhone(trimmed))) return 'Enter a valid phone number, e.g. 0300-1234567';
  return undefined;
}

function checkEmail(value: string) {
  const trimmed = value.trim();
  if (!trimmed) return undefined;
  if (!EMAIL_PATTERN.test(trimmed)) return 'Enter a valid email address';
  return undefined;
}

export type CustomerInput = { name: string; phone?: string; email?: string; notes?: string };

export function validateCustomer(input: CustomerInput): FieldErrors<'name' | 'phone' | 'email' | 'notes'> {
  return {
    name: checkName(input.name ?? '', 'Customer name'),
    // Phone is how the front desk finds a client, so it is required.
    phone: checkPhone(input.phone ?? '', true),
    email: checkEmail(input.email ?? ''),
    notes:
      (input.notes ?? '').trim().length > LIMITS.notesMax
        ? `Notes must be ${LIMITS.notesMax} characters or fewer`
        : undefined,
  };
}

export type ProductInput = {
  sku: string;
  barcode: string;
  name: string;
  category: string;
  price: string | number;
  stock: string | number;
  // Stored as a fraction (0.17 = 17%).
  taxRate: string | number;
  redeemPoints?: string | number;
};

export function validateProduct(
  input: ProductInput
): FieldErrors<'sku' | 'barcode' | 'name' | 'category' | 'price' | 'stock' | 'taxRate' | 'redeemPoints'> {
  const sku = input.sku.trim();
  const barcode = input.barcode.trim();
  const taxRate = parseNumber(input.taxRate);
  return {
    name: checkName(input.name, 'Product name'),
    category: checkName(input.category, 'Category'),
    sku: !sku
      ? 'SKU is required'
      : !CODE_PATTERN.test(sku) || sku.length > LIMITS.codeMax
        ? 'SKU can only use letters, numbers, dots, dashes and underscores'
        : undefined,
    barcode: !barcode
      ? 'Barcode is required'
      : !BARCODE_PATTERN.test(barcode)
        ? 'Barcode must be 4–32 letters or numbers'
        : undefined,
    price: checkMoney(input.price, 'Price', { allowZero: false }),
    stock: checkWholeNumber(input.stock, 'Stock', LIMITS.maxStock),
    taxRate: !Number.isFinite(taxRate)
      ? 'Tax rate must be a number'
      : taxRate < 0 || taxRate > 1
        ? 'Tax rate must be between 0% and 100%'
        : undefined,
    redeemPoints: checkWholeNumber(input.redeemPoints ?? 0, 'Redeem points', LIMITS.maxPoints),
  };
}

export type ServiceInput = {
  code: string;
  name: string;
  description: string;
  price: string | number;
  redeemPoints?: string | number;
};

export function validateService(
  input: ServiceInput
): FieldErrors<'code' | 'name' | 'description' | 'price' | 'redeemPoints'> {
  const code = input.code.trim();
  const description = input.description.trim();
  return {
    code: !code
      ? 'Service code is required'
      : !CODE_PATTERN.test(code) || code.length > LIMITS.codeMax
        ? 'Code can only use letters, numbers, dots, dashes and underscores'
        : undefined,
    name: checkName(input.name, 'Service name'),
    description: !description
      ? 'Description is required'
      : description.length > LIMITS.descriptionMax
        ? `Description must be ${LIMITS.descriptionMax} characters or fewer`
        : undefined,
    price: checkMoney(input.price, 'Price', { allowZero: false }),
    redeemPoints: checkWholeNumber(input.redeemPoints ?? 0, 'Redeem points', LIMITS.maxPoints),
  };
}

export type SalonInfoInput = { name: string; phone?: string; email?: string; address?: string; tagline?: string };

export function validateSalonInfo(input: SalonInfoInput): FieldErrors<'name' | 'phone' | 'email' | 'address' | 'tagline'> {
  return {
    name: checkName(input.name ?? '', 'Salon name'),
    phone: checkPhone(input.phone ?? '', false),
    email: checkEmail(input.email ?? ''),
    address: (input.address ?? '').trim().length > 160 ? 'Address must be 160 characters or fewer' : undefined,
    tagline: (input.tagline ?? '').trim().length > 80 ? 'Tagline must be 80 characters or fewer' : undefined,
  };
}

export type LoyaltyRulesInput = { currencyPerPoint: string | number; minimumRedeemPoints: string | number };

export function validateLoyaltyRules(input: LoyaltyRulesInput): FieldErrors<'currencyPerPoint' | 'minimumRedeemPoints'> {
  const rate = parseNumber(input.currencyPerPoint);
  return {
    currencyPerPoint: !Number.isFinite(rate)
      ? 'Rupees per point must be a number'
      : rate < 1
        ? 'Rupees per point must be at least 1'
        : rate > 100_000
          ? 'Rupees per point is too large'
          : undefined,
    minimumRedeemPoints: checkWholeNumber(input.minimumRedeemPoints, 'Minimum redeem points', LIMITS.maxPoints),
  };
}

// Discount is entered either as rupees or as a percentage of the subtotal.
export function validateDiscount(value: string | number, type: 'pkr' | 'percent', billTotal: number) {
  const amount = parseNumber(value === '' ? '0' : value);
  if (!Number.isFinite(amount)) return 'Discount must be a number';
  if (amount < 0) return 'Discount cannot be negative';
  if (type === 'percent' && amount > 100) return 'Discount cannot be more than 100%';
  if (type === 'pkr' && amount > billTotal + 1e-9) return 'Discount cannot be more than the bill total';
  return undefined;
}
