type QueuedFn<T> = () => T | Promise<T>;

type Task<T> = {
	fn: QueuedFn<T>;
	resolve: (value: T) => void;
	reject: (reason: unknown) => void;
};

export class TaskQueue<T> {
	#queue: Task<T>[] = [];
	#isLocked = false;

	/**
	 * add task to task queue
	 *
	 * @throws task's thrown exceptions
	 *
	 * @returns a promise that resolves when task is consumed
	 *
	 */
	addTask(task: QueuedFn<T>): Promise<T> {
		return new Promise((resolve, reject) => {
			this.#queue.push({ fn: task, resolve, reject });

			if (!this.#isLocked) this.#processQueue();
		});
	}

	async #processQueue() {
		this.#isLocked = true;

		while (this.#queue.length > 0) {
			const task = this.#queue.shift();

			if (!task) break;

			const { fn, resolve, reject } = task;

			try {
				resolve(await fn());
			} catch (err) {
				reject(err);
			}
		}

		this.#isLocked = false;
	}
}
