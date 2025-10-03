export type Result<T, E = Error> = Success<T> | Failure<E>;

export class Success<T> {
  readonly success = true as const;
  constructor(public readonly data: T) {}
}

export class Failure<E> {
  readonly success = false as const;
  constructor(public readonly error: E) {}
}

export const success = <T>(data: T): Success<T> => new Success(data);
export const failure = <E>(error: E): Failure<E> => new Failure(error);

export const isSuccess = <T, E>(result: Result<T, E>): result is Success<T> => 
  result.success;

export const isFailure = <T, E>(result: Result<T, E>): result is Failure<E> => 
  !result.success;
