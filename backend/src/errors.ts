/**
 * Errors that carry an HTTP status, in their own module so that services can throw
 * them without importing the Fastify app and closing an import cycle.
 */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'HttpError';
  }
}

export const notFound = (what: string) => new HttpError(404, `${what} not found`);
export const badRequest = (why: string) => new HttpError(400, why);
