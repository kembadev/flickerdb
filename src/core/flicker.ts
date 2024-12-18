import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import { basename, dirname, join, extname } from 'node:path';
import { randomUUID } from 'node:crypto';

import { TaskQueue } from '../utils/TaskQueue.js';
import {
	FlickerError,
	FLICKER_ERROR_CODES,
} from '../error-handling/flicker.js';
import StreamObject from 'stream-json/streamers/StreamObject.js';

import { getReasonFromNodeErrCode } from '../helpers/nodeErrCode.js';

type Stringify<T> = (data: T) => string | never;

interface FlickerOptions<T> {
	/** Whether overwrite the previous content when init db or not. `Default: true`. */
	overwrite?: boolean;
	/** The desired serialization method to use. `Default: JSON.stringify`. */
	stringify?: Stringify<T>;
}

type Entry<T> = { id: string; data: T };

type MatcherFn<T> = (entry: Entry<T>) => boolean;

interface FilterOptions {
	/** `Limit when the search must stop.` For example, if the limit
	is set to 10, and already 10 entries where found, then the search
	stops immediately. `Default: Infinity`. */
	limit?: number;
	/** `Offset from where to start saving the entries.` For example,
  if the offset is set to 3, the first 3 entries matched are ignore.
  Values less than 0 are interpreted as 0. `Default: 0`. */
	offset?: number;
	/** Once the limit has been reached, the search is intended to stop.
  If `holdTillMatch` is true, the search stops just after one more match
  is found (which is not added to final entries), preventing from stop
  when limit is reached. This is useful in scenarios where you wanna know
  whether there are more matches in addition to offset + limit.
  For example, if you apply pagination maybe you wanna know whether
  some entry left or not. `Default: false`. */
	holdTillMatch?: boolean;
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
		 * @throws `FlickerError` with code 'SERIALIZATION_ERROR'.
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
	 * Rename the temporary file to the original file name.
	 *
	 * @throws `FlickerError` with code 'TEMP_FILE_RENAME_ERROR'.
	 *
	 */
	#rename(): Promise<null> {
		return new Promise((resolve, reject) => {
			fs.rename(this.#tempFilePath, this.#filePath, err => {
				if (!err) return resolve(null);

				const reason = getReasonFromNodeErrCode(err.code);

				reject(
					new FlickerError(
						`Could not rename the temporary file. Reason: ${reason}`,
						FLICKER_ERROR_CODES.TEMP_FILE_RENAME_ERROR,
					),
				);
			});
		});
	}

	/**
	 * Read the file content chunk by chunk.
	 *
	 * @param cb - A function that is invoked each time a chunk is received
	 * and accepts the chunk that is currently being read.
	 *
	 * @throws `FlickerError` with code 'MISSING_FILE', or 'FILE_READ_ERROR'.
	 * @throws `cb` param thrown exception.
	 *
	 */
	async #readStream(cb: (chunk: string) => void): Promise<null> {
		this.#throwMissingFile();

		return new Promise((resolve, reject) => {
			const readStream = fs
				.createReadStream(this.#filePath, { encoding: 'utf-8' })
				.on('error', err => {
					const errorCode = 'code' in err ? err.code : null;
					const reason = getReasonFromNodeErrCode(errorCode);

					reject(
						new FlickerError(
							`Could not read the db file. Reason: ${reason}`,
							FLICKER_ERROR_CODES.FILE_READ_ERROR,
						),
					);
				})
				.on('end', () => resolve(null));

			readStream.on('data', chunk => {
				try {
					cb(chunk as string);
				} catch (err) {
					readStream.destroy();
					reject(err);
				}
			});
		});
	}

	/**
	 * Read the file content chunk by chunk parsing them.
	 *
	 * @param cb - A function that is invoked each time a parsed entry is received
	 * and accepts the entry that is currently being read.
	 *
	 * @throws `FlickerError` with code 'MISSING_FILE' or 'FILE_READ_ERROR'.
	 * @throws `cb` param thrown exception.
	 *
	 */
	async #readStreamParsing(
		cb: (entry: Entry<Data>, destroy: () => void) => void,
	): Promise<null> {
		this.#throwMissingFile();

		return new Promise((resolve, reject) => {
			const readStream = fs
				.createReadStream(this.#filePath, { encoding: 'utf-8' })
				.pipe(StreamObject.withParser())
				.on('end', () => resolve(null))
				.on('error', err => {
					const errorCode = 'code' in err ? err.code : null;
					const reason = getReasonFromNodeErrCode(errorCode);

					reject(
						new FlickerError(
							`Could not read the db file. Reason: ${reason}`,
							FLICKER_ERROR_CODES.FILE_READ_ERROR,
						),
					);
				});

			const destroy = () => {
				readStream.destroy();
			};

			readStream.on('data', ({ key: id, value: data }) => {
				try {
					cb({ id, data }, destroy);
				} catch (err) {
					destroy();
					reject(err);
				}
			});
		});
	}

	/**
	 * Create a temporary file, write in it using the `cb` param, and rename to `#filePath`.
	 *
	 * @throws `FlickerError` with code 'TEMP_FILE_WRITE_ERROR', or 'TEMP_FILE_RENAME_ERROR'.
	 * @throws `cb` param thrown exception.
	 *
	 */
	async #tempFileWriteOperation(
		cb: (tempFile: {
			write: (data: string) => void;
			end: (data: string, cb?: () => void) => void;
		}) => Promise<void>,
	): Promise<null> {
		const writeStream = fs
			.createWriteStream(this.#tempFilePath)
			.on('error', err => {
				const errorCode = 'code' in err ? err.code : null;
				const reason = getReasonFromNodeErrCode(errorCode);

				throw new FlickerError(
					`Could not write to temporary file. Reason: ${reason}`,
					FLICKER_ERROR_CODES.TEMP_FILE_WRITE_ERROR,
				);
			});

		// write
		try {
			await cb({
				write: data => {
					writeStream.write(data);
				},
				end: (data, cb) => {
					if (!writeStream.writableEnded) writeStream.end(data, cb);
				},
			});
		} catch (err) {
			// delete temporary file
			await new Promise(resolve => {
				fs.unlink(this.#tempFilePath, () => resolve(null));
			});

			throw err;
		} finally {
			if (!writeStream.writableEnded) writeStream.end();
		}

		return this.#rename();
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
	async add(data: Data[]): Promise<string[]> {
		if (data.length === 0) {
			throw new FlickerError(
				'`data` param must contain at least one element.',
				FLICKER_ERROR_CODES.INVALID_PARAMS,
			);
		}

		const jsonData = data.map(d => this.#stringify(d));

		return new Promise((resolve, reject) => {
			this.#queue
				.addTask(async () => {
					await this.#tempFileWriteOperation(async tempFile => {
						let totalLength = 0;
						let prevChunk = '';

						// read the original file and write the readed data in a temp file
						await this.#readStream(chunk => {
							totalLength += chunk.length;

							tempFile.write(prevChunk);

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
				})
				.catch(reject);
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
	async addOne(data: Data): Promise<string> {
		const [id] = await this.add([data]);

		return id;
	}

	/**
	 * Remove entries from db.
	 *
	 * @param matcher - A function that takes each entry as argument.
	 * A return value of true indicates that the entry meet the match,
	 * and must be removed.
	 *
	 * @throws `FlickerError` with code 'MISSING_FILE', FILE_READ_ERROR',
	 * 'TEMP_FILE_WRITE_ERROR', or 'TEMP_FILE_RENAME_ERROR'.
	 * @throws `matcher` param thrown exception.
	 *
	 * @returns A promise that resolves with the number of entries that were removed.
	 * If no match is found, promise resolves with undefined instead.
	 *
	 */
	remove(matcher: MatcherFn<Data>): Promise<number | undefined> {
		return new Promise((resolve, reject) => {
			this.#queue
				.addTask(async () => {
					let removedEntries = 0;

					await this.#tempFileWriteOperation(async tempFile => {
						let prevFormattedEntry = '{';

						await this.#readStreamParsing(entry => {
							if (matcher(entry)) return removedEntries++;

							const { id, data } = entry;

							const jsonData = this.#stringify(data);

							tempFile.write(prevFormattedEntry);

							prevFormattedEntry =
								prevFormattedEntry === '{'
									? `{"${id}":${jsonData}`
									: `,"${id}":${jsonData}`;
						});

						await new Promise(resolve => {
							tempFile.end(prevFormattedEntry + '}', () => resolve(null));
						});
					});

					if (removedEntries === 0) return resolve(undefined);

					resolve(removedEntries);
				})
				.catch(reject);
		});
	}

	/**
	 * Remove one entry from db.
	 *
	 * @throws `FlickerError` with code 'MISSING_FILE', 'FILE_READ_ERROR',
	 * 'TEMP_FILE_WRITE_ERROR', or 'TEMP_FILE_RENAME_ERROR'.
	 *
	 * @returns A promise that resolves with true if the entry was removed.
	 * If `id` is never found, promise resolves with undefined instead.
	 *
	 */
	async removeById(id: string): Promise<true | undefined> {
		const removedEntry = await this.remove(
			({ id: matcherId }) => matcherId === id,
		);

		if (!removedEntry) return;

		return true;
	}

	/**
	 *
	 * @throws `FlickerError` with code 'TEMP_FILE_WRITE_ERROR' or 'TEMP_FILE_RENAME_ERROR'.
	 *
	 */
	clearAll(): Promise<null> {
		return new Promise((resolve, reject) => {
			this.#queue
				.addTask(async () => {
					// populate the temp file with {}
					await new Promise((resolve, reject) => {
						fs.writeFile(this.#tempFilePath, '{}', err => {
							if (!err) return resolve(null);

							const reason = getReasonFromNodeErrCode(err.code);

							reject(
								new FlickerError(
									`Could not clear db. Write operation of the temporary file failed. Reason: ${reason}`,
									FLICKER_ERROR_CODES.TEMP_FILE_WRITE_ERROR,
								),
							);
						});
					});

					await this.#rename().then(resolve);
				})
				.catch(reject);
		});
	}

	/**
	 *
	 * @param matcher - A function that takes each entry as argument.
	 * A return value of true indicates that the entry meet the match.
	 *
	 * @throws `FlickerError` with code 'MISSING_FILE' or 'FILE_READ_ERROR'.
	 * @throws `matcher` param thrown exception.
	 *
	 * @returns A promise that resolves with an object that contains
	 * the matching entries and other properties. If no one entry matches,
	 * promise resolves with undefined instead.
	 *
	 */
	async find(
		matcher: MatcherFn<Data>,
		{ limit = Infinity, offset = 0, holdTillMatch = false }: FilterOptions = {},
	): Promise<
		| undefined
		| {
				entries: Entry<Data>[];
				/** Indicates if there are more matches than those saved in `entries`.
        When `holdTillMatch` option is false, `wereThereMatchesLeft` is false too. */
				wereThereMatchesLeft: boolean;
		  }
	> {
		if (limit <= 0) return;

		return new Promise((resolve, reject) => {
			this.#queue
				.addTask(async () => {
					const usableOffset = offset < 0 ? 0 : offset;

					let matched = 0;
					let wereThereMatchesLeft = false;
					const entries: Entry<Data>[] = [];

					await this.#readStreamParsing((entry, destroy) => {
						const doesExceedLimit = entries.length >= limit;

						if (!holdTillMatch && doesExceedLimit) return destroy();

						if (!matcher(entry)) return;

						if (doesExceedLimit) {
							wereThereMatchesLeft = true;
							return destroy();
						}

						if (++matched > usableOffset) entries.push(entry);
					});

					if (entries.length === 0) return resolve(undefined);

					resolve({ entries, wereThereMatchesLeft });
				})
				.catch(reject);
		});
	}

	/**
	 *
	 * @param {string} id - The desired entry's id.
	 *
	 * @throws `FlickerError` with code 'MISSING_FILE' or 'FILE_READ_ERROR'.
	 *
	 * @returns A promise that resolves with the `data` identified by `id`.
	 * If `id` is never found, promise resolves with undefined instead.
	 *
	 */
	async findById(id: string): Promise<Data | undefined> {
		const result = await this.find(({ id: matcherId }) => matcherId === id, {
			limit: 1,
		});

		if (!result) return;

		const [{ data }] = result.entries;

		return data;
	}

	/**
	 * Update entries from db.
	 *
	 * @param fn - A function that takes each entry as argument.
	 * A return value of undefined means that that entry must be ignored
	 * (do not update).
	 *
	 * @throws `FlickerError` with code 'MISSING_FILE', 'SERIALIZATION_ERROR',
	 * 'FILE_READ_ERROR', 'TEMP_FILE_WRITE_ERROR', or 'TEMP_FILE_RENAME_ERROR'.
	 * @throws `fn` param thrown exception.
	 *
	 * @returns A promise that resolves with the number of entries that were updated.
	 * If no entry is updated, promise resolves with undefined instead.
	 *
	 */
	update(fn: (entry: Entry<Data>) => Data | void): Promise<number | undefined> {
		return new Promise((resolve, reject) => {
			this.#queue
				.addTask(async () => {
					let updatedEntries = 0;

					await this.#tempFileWriteOperation(async tempFile => {
						let prevFormattedEntry = '{';

						await this.#readStreamParsing(({ id, data }) => {
							const modifiedData = fn({ id, data });

							let jsonData: string;

							if (modifiedData !== undefined) {
								updatedEntries++;
								jsonData = this.#stringify(modifiedData);
							} else {
								jsonData = this.#stringify(data);
							}

							tempFile.write(prevFormattedEntry);

							prevFormattedEntry =
								prevFormattedEntry === '{'
									? `{"${id}":${jsonData}`
									: `,"${id}":${jsonData}`;
						});

						await new Promise(resolve => {
							tempFile.end(prevFormattedEntry + '}', () => resolve(null));
						});
					});

					if (updatedEntries === 0) return resolve(undefined);

					resolve(updatedEntries);
				})
				.catch(reject);
		});
	}

	/**
	 * Update one entry from db.
	 *
	 * @throws `FlickerError` with code 'MISSING_FILE', 'SERIALIZATION_ERROR',
	 * 'FILE_READ_ERROR', 'TEMP_FILE_WRITE_ERROR', or 'TEMP_FILE_RENAME_ERROR'.
	 *
	 * @returns A promise that resolves with true if the entry was updated.
	 * If `id` is never found, promise resolves with undefined instead.
	 *
	 */
	async updateById(
		id: string,
		modifier: (data: Data) => Data,
	): Promise<true | undefined> {
		const updatedEntry = await this.update(({ id: matcherId, data }) =>
			matcherId === id ? modifier(data) : undefined,
		);

		if (!updatedEntry) return;

		return true;
	}
}

export type InferType<T> = T extends FlickerDB<infer A> ? A : never;
