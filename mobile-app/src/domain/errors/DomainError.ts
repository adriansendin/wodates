export abstract class DomainError extends Error {
  abstract readonly code: string;
  abstract readonly statusCode: number;

  constructor(
    message: string,
    public readonly details?: unknown
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  readonly statusCode = 400;
}

export class NotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';
  readonly statusCode = 404;
}

export class UnauthorizedError extends DomainError {
  readonly code = 'UNAUTHORIZED';
  readonly statusCode = 401;
}

export class ForbiddenError extends DomainError {
  readonly code = 'FORBIDDEN';
  readonly statusCode = 403;
}

export class ConflictError extends DomainError {
  readonly code = 'CONFLICT';
  readonly statusCode = 409;
}

export class NetworkError extends DomainError {
  readonly code = 'NETWORK_ERROR';
  readonly statusCode = 0;
}

export class ServerError extends DomainError {
  readonly code = 'SERVER_ERROR';
  readonly statusCode = 500;
}

export class UnexpectedError extends DomainError {
  readonly code = 'UNEXPECTED_ERROR';
  readonly statusCode = 520;
}

export class PermissionDeniedError extends DomainError {
  readonly code = 'PERMISSION_DENIED';
  readonly statusCode = 403;
}

export class ImagePickerError extends DomainError {
  readonly code = 'IMAGE_PICKER_ERROR';
  readonly statusCode = 400;
}

export class CameraError extends DomainError {
  readonly code = 'CAMERA_ERROR';
  readonly statusCode = 400;
}

export class UploadError extends DomainError {
  readonly code = 'UPLOAD_ERROR';
  readonly statusCode = 500;
}

export class InvalidUrlError extends DomainError {
  readonly code = 'INVALID_URL';
  readonly statusCode = 400;
}
