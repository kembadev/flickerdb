import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join, extname } from 'node:path';
import { randomUUID } from 'node:crypto';

import { TaskQueue } from '../utils/TaskQueue.js';
import {
	FlickerError,
	FLICKER_ERROR_CODES,
} from '../error-handling/flicker.js';

type Stringify<T> = (data: T) => string | never;

interface FlickerOptions<T> {
	overwrite?: boolean;
	stringify?: Stringify<T>;
}

function transformPath(filePath: fs.PathLike) {
	const path =
		filePath instanceof URL ? fileURLToPath(filePath) : filePath.toString();

	const f =
		extname(path) === '.json' ? basename(path) : basename(path) + '.json';

	return join(dirname(path), f);
}

function initDB(path: string, overwrite: boolean) {
	const dir = dirname(path);

	if (!fs.existsSync(dir)) {
		fs.mkdirSync(dir, { recursive: true });
	}

	if (!fs.existsSync(path) || overwrite) {
		fs.writeFileSync(path, '{}', 'utf-8');
	}
}

export class FlickerDB<Data> {
	readonly #filePath: string;
	readonly #tempFilePath: string;

	#stringify: Stringify<Data>;
	#queue = new TaskQueue();

	constructor(
		pathUrl: fs.PathLike,
		{ overwrite = true, stringify = JSON.stringify }: FlickerOptions<Data> = {},
	) {
		const path = transformPath(pathUrl);

		initDB(path, overwrite);

		this.#filePath = path;
		this.#tempFilePath = path + '.tmp';
		/**
		 *
		 * @throws `FlickerError(message, 'SERIALIZATION_ERROR')`.
		 *
		 */
		this.#stringify = d => {
			try {
				return stringify(d);
			} catch {
				throw new FlickerError(
					'Could not convert data to JSON.',
					FLICKER_ERROR_CODES.SERIALIZATION_ERROR,
				);
			}
		};
	}

	/**
	 * Checks whether the file defined by `#filePath` exists or not.
	 *
	 * @throws `FlickerError` with code 'MISSING_FILE' if the file does not exist.
	 *
	 */
	#throwMissingFile(): void | never {
		if (fs.existsSync(this.#filePath)) return;

		throw new FlickerError(
			'DB file not found.',
			FLICKER_ERROR_CODES.MISSING_FILE,
		);
	}

	/**
	 * Read the file content chunk by chunk.
	 *
	 * @param cb - A function that is invoked each time a chunk is received
	 * and accepts the chunk that is currently being read.
	 *
	 * @throws `FlickerError` with code 'MISSING_FILE', or 'FILE_READ_ERROR'.
	 *
	 */
	async #readStream(cb: (chunk: string) => void): Promise<null> {
		this.#throwMissingFile();

		return new Promise((resolve, reject) => {
			fs.createReadStream(this.#filePath, { encoding: 'utf-8' })
				.on('data', cb)
				.on('end', () => resolve(null))
				.on('error', () => {
					reject(
						new FlickerError(
							'Could not read the db file.',
							FLICKER_ERROR_CODES.FILE_READ_ERROR,
						),
					);
				});
		});
	}

	/**
	 * Create a temporary file, write in it using the `cb` param, and rename to `#filePath`.
	 *
	 * @throws `FlickerError` with code 'TEMP_FILE_WRITE_ERROR', or 'TEMP_FILE_RENAME_ERROR'.
	 * @throws `cb` param thrown exceptions.
	 *
	 */
	async #tempFileWriteOperation(
		cb: (tempFile: {
			write: (data: string) => void;
			end: (data: string, cb?: () => void) => void;
		}) => Promise<void>,
	) {
		const writeStream = fs
			.createWriteStream(this.#tempFilePath)
			.on('error', () => {
				throw new FlickerError(
					'Could not write in the temporary file.',
					FLICKER_ERROR_CODES.TEMP_FILE_WRITE_ERROR,
				);
			});

		let wasAlreadyFinalized = false;

		// write
		await cb({
			write: data => {
				writeStream.write(data);
			},
			end: (data, cb) => {
				wasAlreadyFinalized = true;

				writeStream.end(data, cb);
			},
		})
			.catch(async err => {
				if (fs.existsSync(this.#tempFilePath)) {
					await new Promise(resolve => {
						fs.unlink(this.#tempFilePath, () => resolve(null));
					});
				}

				throw err;
			})
			.finally(() => {
				if (!wasAlreadyFinalized) writeStream.end();
			});

		// rename
		await new Promise((resolve, reject) => {
			fs.rename(this.#tempFilePath, this.#filePath, err => {
				if (!err) return resolve(null);

				reject(
					new FlickerError(
						'Could not rename the temporary file to the original file name.',
						FLICKER_ERROR_CODES.TEMP_FILE_RENAME_ERROR,
					),
				);
			});
		});
	}

	/**
	 * Add new entries to db.
	 *
	 * @throws `FlickerError` with code 'INVALID_PARAMS', 'SERIALIZATION_ERROR',
	 * 'MISSING_FILE', 'FILE_READ_ERROR', 'TEMP_FILE_WRITE_ERROR',
	 * or 'TEMP_FILE_RENAME_ERROR'.
	 *
	 * @returns A promise that resolves with an array of `IDs` of each entry
	 * added. Each `ID` corresponds to the one of same index in the `data` param,
	 * e.i. `IDs[index]` refers to `data[index]`.
	 *
	 */
	add(data: Data[]): Promise<string[]> {
		if (data.length === 0) {
			throw new FlickerError(
				'`data` param must contain at least one element.',
				FLICKER_ERROR_CODES.INVALID_PARAMS,
			);
		}

		const jsonData = data.map(d => this.#stringify(d));

		return new Promise(resolve => {
			this.#queue.addTask(async () => {
				await this.#tempFileWriteOperation(async tempFile => {
					let totalLength = 0;
					let isInitialChunk = true;
					let prevChunk = '';

					// read the original file and write the readed data in a temp file
					await this.#readStream(chunk => {
						totalLength += chunk.length;

						if (isInitialChunk) {
							isInitialChunk = false;
						} else {
							tempFile.write(prevChunk);
						}

						prevChunk = chunk;
					});

					// add the last chunk and the new entries
					await new Promise<string[]>(resolve => {
						const entries = jsonData.map(strData => ({
							id: randomUUID(),
							strData,
						}));

						const formattedEntries = entries.map(
							({ id, strData }) => `"${id}":${strData}`,
						);

						const newChunk =
							(totalLength > 2 ? ',' : '') + formattedEntries.join(',') + '}';

						tempFile.end(
							prevChunk.slice(0, prevChunk.length - 1) + newChunk,
							() => resolve(entries.map(({ id }) => id)),
						);
					}).then(resolve);
				});
			});
		});
	}

	/**
	 * Add new entry to db.
	 *
	 * @throws `FlickerError` with code 'SERIALIZATION_ERROR', 'MISSING_FILE',
	 * 'FILE_READ_ERROR', 'TEMP_FILE_WRITE_ERROR', or 'TEMP_FILE_RENAME_ERROR'.
	 *
	 * @returns A promise that resolves with the `id` of the entry added.
	 *
	 */
	addOne(data: Data): Promise<string> {
		return new Promise(resolve => {
			this.add([data]).then(([id]) => resolve(id));
		});
	}
}

export type InferType<T> = T extends FlickerDB<infer A> ? A : never;
