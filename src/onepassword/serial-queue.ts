export type SerialQueue = <T>(task: () => Promise<T>) => Promise<T>;

export function createSerialQueue(): SerialQueue {
	let tail: Promise<unknown> = Promise.resolve();
	return <T>(task: () => Promise<T>) => {
		const run = tail.then(task, task);
		tail = run.catch(() => undefined);
		return run;
	};
}
