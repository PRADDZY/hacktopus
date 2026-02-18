import assert from 'node:assert/strict';
import { formatCurrency } from '../../lib/format';

export const run = () => {
  const formatter = new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  });

  {
    const value = 125000;
    assert.equal(formatCurrency(value), formatter.format(value));
  }

  {
    const value = 125000.7;
    assert.equal(formatCurrency(value), formatter.format(value));
  }
};
