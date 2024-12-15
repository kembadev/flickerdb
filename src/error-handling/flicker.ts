export enum FLICKER_ERROR_CODES {
	MISSING_FILE = 'MISSING_FILE',
	SERIALIZATION_ERROR = 'SERIALIZATION_ERROR',
	INVALID_PARAMS = 'INVALID_PARAMS',
	FILE_READ_ERROR = 'FILE_READ_ERROR',
	TEMP_FILE_WRITE_ERROR = 'TEMP_FILE_WRITE_ERROR',
	TEMP_FILE_RENAME_ERROR = 'TEMP_FILE_RENAME_ERROR',
}

export class FlickerError extends Error {
	name = 'FlickerError';
	code: FLICKER_ERROR_CODES;

	constructor(message: string, code: FLICKER_ERROR_CODES) {
		super(message);
		this.code = code;
	}
}
