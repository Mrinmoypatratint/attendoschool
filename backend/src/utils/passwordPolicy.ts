/**
 * Enterprise Password Policy Validator
 *
 * Rules:
 * 1. Minimum 8 characters in length
 * 2. At least 1 number (0-9)
 * 3. At least 1 special character (!@#$%^&*()_+-=[]{};':"|,.<>/?`~ etc.)
 * 4. At least 1 Capital (uppercase) letter (A-Z)
 * 5. At least 1 small (lowercase) letter (a-z)
 */

export interface PasswordValidationResult {
  valid: boolean;
  hasMinLength: boolean;
  hasUpperCase: boolean;
  hasLowerCase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
  message?: string;
}

export function validatePasswordStrength(password: string): PasswordValidationResult {
  const p = typeof password === 'string' ? password : '';
  const hasMinLength = p.length >= 8;
  const hasUpperCase = /[A-Z]/.test(p);
  const hasLowerCase = /[a-z]/.test(p);
  const hasNumber = /[0-9]/.test(p);
  const hasSpecialChar = /[^A-Za-z0-9]/.test(p);

  const valid = hasMinLength && hasUpperCase && hasLowerCase && hasNumber && hasSpecialChar;

  let message = '';
  if (!p) {
    message = 'Password is required.';
  } else if (!hasMinLength) {
    message = 'Password must be at least 8 characters in length.';
  } else if (!hasUpperCase) {
    message = 'Password must include at least 1 Capital letter (A-Z).';
  } else if (!hasLowerCase) {
    message = 'Password must include at least 1 small letter (a-z).';
  } else if (!hasNumber) {
    message = 'Password must include at least 1 number (0-9).';
  } else if (!hasSpecialChar) {
    message = 'Password must include at least 1 special character (e.g. !@#$%^&*).';
  }

  return {
    valid,
    hasMinLength,
    hasUpperCase,
    hasLowerCase,
    hasNumber,
    hasSpecialChar,
    message: valid ? undefined : message
  };
}

export const PASSWORD_POLICY_REQUIREMENT_TEXT =
  'Password must be at least 8 characters long and include at least 1 Capital letter, 1 small letter, 1 number, and 1 special character.';
