export enum ErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  NOT_FOUND = 'NOT_FOUND',
  EXTERNAL_SERVICE_ERROR = 'EXTERNAL_SERVICE_ERROR',
  UNAUTHORIZED = 'UNAUTHORIZED',
  INTERNAL_ERROR = 'INTERNAL_ERROR',
  TRANSITION_ERROR = 'TRANSITION_ERROR',
}

export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public errorCode: ErrorCode = ErrorCode.INTERNAL_ERROR,
    public isOperational: boolean = true,
    public details?: any
  ) {
    super(message);
    Object.setPrototypeOf(this, new.target.prototype);
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends AppError {
  constructor(message: string, details?: any) {
    super(message, 400, ErrorCode.VALIDATION_ERROR, true, details);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string) {
    super(message, 404, ErrorCode.NOT_FOUND);
  }
}

export class ExternalServiceError extends AppError {
  constructor(service: string, message: string, details?: any) {
    super(
      `External service failure [${service}]: ${message}`,
      502,
      ErrorCode.EXTERNAL_SERVICE_ERROR,
      true,
      details
    );
  }
}
