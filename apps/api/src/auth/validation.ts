import { checkSignup, type SignupInput } from '@store/shared';
import { HttpError } from '../http/errors.js';

/** Validates and normalises sign-up input, throwing field errors the form can show inline. */
export function validateSignup(input: unknown): SignupInput {
  const { errors, values } = checkSignup((typeof input === 'object' && input !== null ? input : {}) as Record<string, unknown>);
  if (Object.keys(errors).length) throw new HttpError(400, 'VALIDATION', 'Please check the highlighted fields', { fields: errors });
  return values;
}
