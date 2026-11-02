const CURRENCY_LOCALES = {
  INR: 'en-IN',
  USD: 'en-US',
};

const CURRENCY_SYMBOLS = {
  INR: '₹',
  USD: '$',
};

export function currencySymbol(currency) {
  const code = (currency || 'INR').toUpperCase();
  return CURRENCY_SYMBOLS[code] || code;
}

export function formatCurrency(amount, currency = 'INR') {
  const code = (currency || 'INR').toUpperCase();
  const value = Number(amount);
  if (Number.isNaN(value)) {
    return `${code} 0.00`;
  }
  return `${code} ${value.toLocaleString(CURRENCY_LOCALES[code] || 'en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
}
