type MaybeError = Error | null;

type ResultSuccess<E extends MaybeError> = E extends Error ? false : true;
type ResultError<E extends MaybeError> = E extends Error ? E : null;
type ResultValue<T, E extends MaybeError> = E extends Error ? null : T;

interface ResultProps<T, E extends MaybeError> {
	success: ResultSuccess<E>;
	error: ResultError<E>;
	value: ResultValue<T, E>;
}

export class Result<T, E extends MaybeError> {
	static success<Q>(value: Q) {
		return new Result({ success: true, error: null, value });
	}

	static failure<E extends Error>(error: E) {
		return new Result({
			success: false,
			error,
			value: null,
		} as ResultProps<null, E>);
	}

	success: ResultSuccess<E>;
	error: ResultError<E>;
	value: ResultValue<T, E>;

	constructor({ success, error, value }: ResultProps<T, E>) {
		this.success = success;
		this.error = error;
		this.value = value;
	}
}
