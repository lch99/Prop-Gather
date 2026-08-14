export class ApiError extends Error {
  constructor(status, message, details) {
    super(message)
    this.status = status
    this.details = details
  }
}

// Default messages are shown to residents as-is, so they read as plain English
// and say what to do next rather than naming the rule that was broken.
export const badRequest = (message, details) => new ApiError(400, message, details)
export const unauthorized = (message = 'Please sign in to continue.') => new ApiError(401, message)
export const forbidden = (message = "You don't have access to this. If you think that's wrong, contact your community admin.") => new ApiError(403, message)
export const notFound = (message = "We couldn't find that — it may have been removed.") => new ApiError(404, message)
export const conflict = (message) => new ApiError(409, message)
