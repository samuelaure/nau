/**
 * Validation Utilities
 * Ensures data integrity for video editor properties
 */
import { VideoTemplate } from '@/types/video-schema'

export interface ValidationResult<T> {
  value: T
  isValid: boolean
  error?: string
}

/**
 * Validates a numeric value within a range
 */
export function validateNumber(
  value: string | number,
  min: number = -Infinity,
  max: number = Infinity,
  integer: boolean = false,
): ValidationResult<number> {
  let num = typeof value === 'string' ? parseFloat(value) : value

  if (isNaN(num) || !isFinite(num)) {
    return { value: min, isValid: false, error: 'Invalid number' }
  }

  if (integer) {
    num = Math.round(num)
  }

  if (num < min) {
    return { value: min, isValid: false, error: `Minimum value is ${min}` }
  }

  if (num > max) {
    return { value: max, isValid: false, error: `Maximum value is ${max}` }
  }

  return { value: num, isValid: true }
}

/**
 * Validates element dimensions (width/height)
 */
export function validateDimension(
  value: string | number,
  template: VideoTemplate,
): ValidationResult<number> {
  // Allow up to 4x the template size, but minimum 1px
  return validateNumber(value, 1, Math.max(template.width, template.height) * 4)
}

/**
 * Validates spatial coordinates (x/y)
 */
export function validatePosition(
  value: string | number,
  template: VideoTemplate,
): ValidationResult<number> {
  // Allow elements to be partially off-screen
  const overflow = 2000
  return validateNumber(value, -overflow, Math.max(template.width, template.height) + overflow)
}

/**
 * Validates scale/opacity
 */
export function validatePercentage(
  value: string | number,
  allowOver100: boolean = false,
): ValidationResult<number> {
  return validateNumber(value, 0, allowOver100 ? 500 : 100) // 0-100 or 0-500
}

/**
 * Validates frame positions
 */
export function validateFrame(
  value: string | number,
  maxDuration: number,
): ValidationResult<number> {
  return validateNumber(value, 0, maxDuration, true)
}

/**
 * Helper to process an input change and return the numeric value if valid
 * Returns null if invalid (or corrected value if auto-correct is desired)
 */
export function processNumericInput(
  inputValue: string,
  validator: (val: string) => ValidationResult<number>,
  onValid: (val: number) => void,
  onError?: (msg: string) => void,
) {
  const result = validator(inputValue)
  if (result.isValid) {
    onValid(result.value)
  } else if (result.error && onError) {
    onError(result.error)
  }
}
