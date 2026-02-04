/**
 * Retry a function with exponential backoff
 * @param fn Function to retry
 * @param maxAttempts Maximum number of attempts (default: 3)
 * @param baseDelay Base delay in milliseconds (default: 1000)
 * @returns Promise that resolves with the function result or rejects after all attempts fail
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts = 3,
  baseDelay = 1000,
): Promise<T> {
  let lastError: Error | null = null

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error as Error

      if (attempt === maxAttempts) {
        throw lastError
      }

      // Exponential backoff: 1s, 2s, 4s, 8s, etc.
      const delay = baseDelay * Math.pow(2, attempt - 1)
      console.warn(`Attempt ${attempt} failed, retrying in ${delay}ms...`, error)

      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError || new Error('Retry failed')
}

/**
 * Check if the browser is online
 */
export function isOnline(): boolean {
  return typeof navigator !== 'undefined' && navigator.onLine
}

/**
 * Wait for the browser to come online
 * @param timeout Maximum time to wait in milliseconds (default: 30000)
 * @returns Promise that resolves when online or rejects on timeout
 */
export function waitForOnline(timeout = 30000): Promise<void> {
  if (isOnline()) {
    return Promise.resolve()
  }

  return new Promise((resolve, reject) => {
    const timeoutId = setTimeout(() => {
      window.removeEventListener('online', handleOnline)
      reject(new Error('Timeout waiting for network connection'))
    }, timeout)

    const handleOnline = () => {
      clearTimeout(timeoutId)
      window.removeEventListener('online', handleOnline)
      resolve()
    }

    window.addEventListener('online', handleOnline)
  })
}
