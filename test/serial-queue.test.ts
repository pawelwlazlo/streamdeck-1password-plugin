import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { createSerialQueue } from "../src/onepassword/serial-queue.ts";

function deferred<T>() {
	let resolve!: (value: T) => void;
	let reject!: (error: unknown) => void;
	const promise = new Promise<T>((res, rej) => {
		resolve = res;
		reject = rej;
	});
	return { promise, resolve, reject };
}

const tick = () => new Promise((resolve) => setImmediate(resolve));

describe("createSerialQueue", () => {
	it("starts a task only after the previous one settled", async () => {
		const enqueue = createSerialQueue();
		const first = deferred<string>();
		const started: string[] = [];

		const a = enqueue(() => {
			started.push("a");
			return first.promise;
		});
		const b = enqueue(async () => {
			started.push("b");
			return "b";
		});

		await tick();
		assert.deepEqual(started, ["a"]);

		first.resolve("a");
		assert.equal(await a, "a");
		assert.equal(await b, "b");
		assert.deepEqual(started, ["a", "b"]);
	});

	it("keeps running later tasks after a task fails", async () => {
		const enqueue = createSerialQueue();

		const failing = enqueue(() => Promise.reject(new Error("IPC operation failed: -2")));
		const next = enqueue(async () => "ok");

		await assert.rejects(failing, /IPC operation failed/);
		assert.equal(await next, "ok");
	});
});
