import { logger } from '../logger.js';

export async function withRetry<T>(
    fn: () => Promise<T>,
    options: {
        retries?: number;
        delay?: number;
        onRetry?: (error: any, attempt: number) => void;
    } = {}
): Promise<T> {
    const { retries = 3, delay = 1000, onRetry } = options;
    let lastError: any;

    for (let attempt = 1; attempt <= retries + 1; attempt++) {
        try {
            return await fn();
        } catch (error: any) {
            lastError = error;
            if (attempt <= retries) {
                if (onRetry) onRetry(error, attempt);
                const backoff = delay * Math.pow(2, attempt - 1);
                logger.warn({ attempt, error: error.message, backoff }, 'Retrying operation...');
                await new Promise(resolve => setTimeout(resolve, backoff));
            }
        }
    }

    throw lastError;
}
