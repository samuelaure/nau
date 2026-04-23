export class NauApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code: string,
  ) {
    super(message)
    this.name = 'NauApiError'
  }
}

export class NauUnauthorizedError extends NauApiError {
  constructor(message = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED')
  }
}

export class NauForbiddenError extends NauApiError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'FORBIDDEN')
  }
}

export class NauNotFoundError extends NauApiError {
  constructor(message = 'Not found') {
    super(message, 404, 'NOT_FOUND')
  }
}
