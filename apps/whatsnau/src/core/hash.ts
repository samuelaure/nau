import crypto from 'crypto';

/**
 * Generates a SHA-256 hash of the given content
 */
export function generateContentHash(content: string): string {
    return crypto.createHash('sha256').update(content).digest('hex');
}

/**
 * Validates if a string is a valid SHA-256 hash
 */
export function isValidHash(hash: string): boolean {
    return /^[a-f0-9]{64}$/i.test(hash);
}
