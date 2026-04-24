import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common'
import { HttpAdapterHost } from '@nestjs/core'
import { Prisma } from '@prisma/client'

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name)

  constructor(private readonly httpAdapterHost: HttpAdapterHost) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost
    const ctx = host.switchToHttp()
    const request = ctx.getRequest<{ method: string }>()
    const path = httpAdapter.getRequestUrl(ctx.getRequest())

    let httpStatus = HttpStatus.INTERNAL_SERVER_ERROR
    let message = 'Internal server error'
    let error = 'InternalServerError'

    if (exception instanceof HttpException) {
      httpStatus = exception.getStatus()
      const response = exception.getResponse()
      message =
        typeof response === 'string'
          ? response
          : ((response as Record<string, unknown>).message as string) || exception.message
      error = exception.name
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          httpStatus = HttpStatus.CONFLICT
          message = `Unique constraint violation on: ${(exception.meta?.target as string[])?.join(', ') || 'unknown field'}`
          error = 'ConflictError'
          break
        case 'P2025':
          httpStatus = HttpStatus.NOT_FOUND
          message = 'Record not found'
          error = 'NotFoundError'
          break
        default:
          message = `Database error: ${exception.code}`
      }
    } else if (exception instanceof Prisma.PrismaClientValidationError) {
      httpStatus = HttpStatus.BAD_REQUEST
      message = 'Invalid data provided'
      error = 'ValidationError'
    } else if (exception instanceof Error) {
      message = exception.message
      error = exception.name
    }

    this.logger.error({
      statusCode: httpStatus,
      path,
      method: request.method,
      error,
      message,
      stack: exception instanceof Error ? exception.stack : undefined,
    })

    httpAdapter.reply(
      ctx.getResponse(),
      { statusCode: httpStatus, error, message, timestamp: new Date().toISOString(), path },
      httpStatus,
    )
  }
}
