import { Request, Response, NextFunction } from 'express';
import { ZodError } from 'zod';
import { AppError } from '../utils/errors';
import { logger } from '../utils/logger';

/**
 * Global error handler middleware
 */
export function errorHandler(
  error: Error,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error
  logger.error({
    error: {
      name: error.name,
      message: error.message,
      stack: error.stack,
    },
    request: {
      method: req.method,
      url: req.url,
      body: req.body,
    },
  });

  // Handle Zod validation errors
  if (error instanceof ZodError) {
    res.status(400).json({
      error: {
        code: 'VALIDATION_ERROR',
        message: 'Dados inválidos',
        details: error.errors.map(e => ({
          path: e.path.join('.'),
          message: e.message,
        })),
      },
    });
    return;
  }

  // Handle operational errors
  if (error instanceof AppError) {
    res.status(error.statusCode).json({
      error: {
        code: error.code,
        message: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
    });
    return;
  }

  // Handle Prisma errors
  if (error.name === 'PrismaClientKnownRequestError') {
    const prismaError = error as any;

    switch (prismaError.code) {
      case 'P2002':
        res.status(409).json({
          error: {
            code: 'CONFLICT',
            message: 'Registro duplicado',
            details: { field: prismaError.meta?.target },
          },
        });
        return;

      case 'P2025':
        res.status(404).json({
          error: {
            code: 'NOT_FOUND',
            message: 'Registro não encontrado',
          },
        });
        return;

      case 'P2003':
        res.status(400).json({
          error: {
            code: 'FOREIGN_KEY_ERROR',
            message: 'Referência inválida',
          },
        });
        return;
    }
  }

  // Default error response
  const isDevelopment = process.env.NODE_ENV !== 'production';

  res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: isDevelopment ? error.message : 'Erro interno do servidor',
      ...(isDevelopment ? { stack: error.stack } : {}),
    },
  });
}

/**
 * Not found handler
 */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Rota ${req.method} ${req.path} não encontrada`,
    },
  });
}

/**
 * Async handler wrapper
 */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<void>
) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
