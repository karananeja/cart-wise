import { describe, expect, it } from 'vitest';
import { checkSignup, maskEmail } from './auth.js';

describe('maskEmail (F-016)', () => {
  it('keeps the first character and the domain', () => {
    expect(maskEmail('karan@example.com')).toBe('k••••@example.com');
    expect(maskEmail('k@gmail.com')).toBe('k••••@gmail.com');
  });

  it('never reveals more than the first character of a long local part', () => {
    expect(maskEmail('asha.ramakrishnan@example.com')).toBe('a••••@example.com');
  });

  it('copes with input that is not an email', () => {
    expect(maskEmail('nope')).toBe('••••');
  });
});

describe('checkSignup', () => {
  const valid = { name: 'Asha Rao', email: 'Asha@Example.com', password: 'correct horse battery' };

  it('accepts a sign-up without a mobile', () => {
    expect(checkSignup({ ...valid, mobile: '  ' })).toEqual({ errors: {}, values: { name: 'Asha Rao', email: 'asha@example.com', mobile: null, password: valid.password } });
    expect(checkSignup(valid).values.mobile).toBeNull();
  });

  it('normalises a mobile when one is given, and rejects an invalid one', () => {
    expect(checkSignup({ ...valid, mobile: '+91 98765 43210' }).values.mobile).toBe('9876543210');
    expect(checkSignup({ ...valid, mobile: '12345' }).errors).toEqual({ mobile: 'Enter a 10-digit Indian mobile number' });
  });
});
