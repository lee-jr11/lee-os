export class ApiError extends Error {
 constructor(public readonly status: number, public readonly code: string, message: string) { super(message); this.name = 'ApiError'; }
}
export function validationError(): never { throw new ApiError(400,'INVALID_REQUEST','The request does not match this command.'); }
