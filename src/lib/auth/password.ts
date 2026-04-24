import bcrypt from "bcryptjs";

const BCRYPT_ROUNDS = 12;

export function hashPassword(password: string) {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export function verifyPassword(password: string, passwordHash: string) {
  return bcrypt.compare(password, passwordHash);
}

export function needsRehash(passwordHash: string) {
  const rounds = bcrypt.getRounds(passwordHash);
  return Number.isFinite(rounds) && rounds < BCRYPT_ROUNDS;
}
