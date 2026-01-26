import bcrypt from 'bcryptjs';

const SALT_ROUNDS = parseInt(process.env.BCRYPT_SALT_ROUNDS || '12');

/**
 * Hash a password
 */
export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * Compare password with hash
 */
export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/**
 * Validate password strength
 */
export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < 6) {
    errors.push('Senha deve ter pelo menos 6 caracteres');
  }

  if (password.length > 128) {
    errors.push('Senha deve ter no máximo 128 caracteres');
  }

  // Optional: Add more rules
  // if (!/[A-Z]/.test(password)) {
  //   errors.push('Senha deve conter pelo menos uma letra maiúscula');
  // }
  // if (!/[a-z]/.test(password)) {
  //   errors.push('Senha deve conter pelo menos uma letra minúscula');
  // }
  // if (!/[0-9]/.test(password)) {
  //   errors.push('Senha deve conter pelo menos um número');
  // }

  return {
    valid: errors.length === 0,
    errors,
  };
}
