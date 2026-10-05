/**
 * Password Policy:
 * 1. Minimum 8 characters in length
 * 2. At least 1 number (0-9)
 * 3. At least 1 special character (!@#$%^&* etc.)
 * 4. At least 1 Capital letter (A-Z)
 * 5. At least 1 small letter (a-z)
 */

export interface PasswordRuleResult {
  valid: boolean;
  hasMinLength: boolean;
  hasUpperCase: boolean;
  hasLowerCase: boolean;
  hasNumber: boolean;
  hasSpecialChar: boolean;
  message?: string;
}

export function validatePassword(password: string): PasswordRuleResult {
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

export const PASSWORD_REQUIREMENTS_CHECKLIST = [
  { id: 'min_length', label: 'At least 8 characters in length', check: (p: string) => (p || '').length >= 8 },
  { id: 'uppercase', label: 'At least 1 Capital letter (A-Z)', check: (p: string) => /[A-Z]/.test(p || '') },
  { id: 'lowercase', label: 'At least 1 small letter (a-z)', check: (p: string) => /[a-z]/.test(p || '') },
  { id: 'number', label: 'At least 1 number (0-9)', check: (p: string) => /[0-9]/.test(p || '') },
  { id: 'special', label: 'At least 1 special character (e.g. !@#$%)', check: (p: string) => /[^A-Za-z0-9]/.test(p || '') }
];
