export class HttpError extends Error {
  constructor(public statusCode: number, public code: string, message: string) {
    super(message);
  }
}
export const badRequest = (code: string, message: string) => new HttpError(400, code, message);
export const unauthorized = (message = 'Sign in required') => new HttpError(401, 'UNAUTHENTICATED', message);
export const forbidden = (code = 'FORBIDDEN', message = 'Not allowed') => new HttpError(403, code, message);
export const notFound = (message = 'Not found') => new HttpError(404, 'NOT_FOUND', message);
export const conflict = (code: string, message: string) => new HttpError(409, code, message);
