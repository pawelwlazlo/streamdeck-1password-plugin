import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { mock } from "node:test";

import { createClipboard, type CommandRunner } from "../src/system/clipboard.ts";

type Call = { command: string; args: string[]; input: string };

function fakeRunner(readOutput: () => string) {
	const calls: Call[] = [];
	const run: CommandRunner = (command, args, input) => {
		calls.push({ command, args, input });
		return Promise.resolve(readOutput());
	};
	return { calls, run };
}

async function flushPromises() {
	for (let i = 0; i < 5; i++) await Promise.resolve();
}

describe("clipboard on darwin", () => {
	it("copies text through pbcopy stdin", async () => {
		const { calls, run } = fakeRunner(() => "");
		await createClipboard("darwin", run).copyToClipboard("user@example.com");
		assert.deepEqual(calls, [{ command: "pbcopy", args: [], input: "user@example.com" }]);
	});

	describe("secret clearing", () => {
		beforeEach(() => mock.timers.enable({ apis: ["setTimeout"] }));
		afterEach(() => mock.timers.reset());

		it("clears the clipboard after the delay when it still holds the secret", async () => {
			const { calls, run } = fakeRunner(() => "s3cret");
			await createClipboard("darwin", run).copySecretToClipboard("s3cret", 30_000);
			assert.equal(calls.length, 1);
			mock.timers.tick(30_000);
			await flushPromises();
			assert.deepEqual(calls.slice(1), [
				{ command: "pbpaste", args: [], input: "" },
				{ command: "pbcopy", args: [], input: "" },
			]);
		});

		it("leaves the clipboard alone when the user copied something else", async () => {
			const { calls, run } = fakeRunner(() => "other");
			await createClipboard("darwin", run).copySecretToClipboard("s3cret", 30_000);
			mock.timers.tick(30_000);
			await flushPromises();
			assert.deepEqual(calls.map((c) => c.command), ["pbcopy", "pbpaste"]);
		});
	});
});

describe("clipboard on win32", () => {
	it("copies text through PowerShell Set-Clipboard reading stdin as UTF-8", async () => {
		const { calls, run } = fakeRunner(() => "");
		await createClipboard("win32", run).copyToClipboard("zażółć");
		assert.equal(calls.length, 1);
		assert.equal(calls[0].command, "powershell");
		assert.deepEqual(calls[0].args.slice(0, 3), ["-NoProfile", "-NonInteractive", "-Command"]);
		assert.match(calls[0].args[3], /InputEncoding.*UTF8/);
		assert.match(calls[0].args[3], /Set-Clipboard/);
		assert.equal(calls[0].input, "zażółć");
	});

	describe("secret clearing", () => {
		beforeEach(() => mock.timers.enable({ apis: ["setTimeout"] }));
		afterEach(() => mock.timers.reset());

		it("reads with Get-Clipboard and clears when it still holds the secret", async () => {
			const { calls, run } = fakeRunner(() => "s3cret");
			await createClipboard("win32", run).copySecretToClipboard("s3cret", 30_000);
			mock.timers.tick(30_000);
			await flushPromises();
			assert.equal(calls.length, 3);
			assert.match(calls[1].args[3], /Get-Clipboard -Raw/);
			assert.match(calls[1].args[3], /OutputEncoding.*UTF8/);
			assert.match(calls[2].args[3], /Clipboard\]::Clear\(\)/);
		});

		it("leaves the clipboard alone when the user copied something else", async () => {
			const { calls, run } = fakeRunner(() => "other");
			await createClipboard("win32", run).copySecretToClipboard("s3cret", 30_000);
			mock.timers.tick(30_000);
			await flushPromises();
			assert.equal(calls.length, 2);
		});
	});
});

describe("clipboard on an unsupported platform", () => {
	it("throws a descriptive error", () => {
		assert.throws(() => createClipboard("linux", fakeRunner(() => "").run), /linux/);
	});
});
