import crypto from 'node:crypto';
import 'dotenv/config';

const SALT = process.env.NRIC_HASH_SALT || 'dev-only-salt-change-me';

// Privacy by design (PRD §10): the raw NRIC is hashed with a server-side
// secret salt and never persisted. The same NRIC always yields the same hash,
// which is how we retrieve a returning resident without ever storing identity.
export function hashNric(nric) {
  const normalised = String(nric).trim().toUpperCase();
  return crypto
    .createHmac('sha256', SALT)
    .update(normalised)
    .digest('hex');
}

// Basic shape check for a Singapore NRIC/FIN (e.g. S1234567A). This is a mock
// of Singpass/Myinfo verification — in production Singpass returns the verified
// identity and registered address directly.
export function isValidNric(nric) {
  return /^[STFGM]\d{7}[A-Z]$/i.test(String(nric).trim());
}
