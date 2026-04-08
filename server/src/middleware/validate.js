import { ValidationError } from '../utils/errors.js';

/**
 * Zod-based request validation middleware.
 * Pass schemas for body, params, and/or query.
 *
 * Usage:
 *   route.addHook('preHandler', validate({ body: createItemSchema }))
 */
export function validate({ body, params, query }) {
  return function (request, reply, done) {
    try {
      if (body) {
        const result = body.safeParse(request.body);
        if (!result.success) {
          throw new ValidationError('Invalid request body', formatZodErrors(result.error));
        }
        request.body = result.data;
      }

      if (params) {
        const result = params.safeParse(request.params);
        if (!result.success) {
          throw new ValidationError('Invalid parameters', formatZodErrors(result.error));
        }
        request.params = result.data;
      }

      if (query) {
        const result = query.safeParse(request.query);
        if (!result.success) {
          throw new ValidationError('Invalid query parameters', formatZodErrors(result.error));
        }
        request.query = result.data;
      }

      done();
    } catch (err) {
      done(err);
    }
  };
}

function formatZodErrors(error) {
  return error.issues.map((issue) => ({
    path: issue.path.join('.'),
    message: issue.message,
  }));
}
