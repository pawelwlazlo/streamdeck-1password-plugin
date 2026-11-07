import assert from "node:assert/strict";
import { describe, it } from "node:test";

import type { CommandRunner } from "../src/system/clipboard.ts";
import { AccessibilityPermissionError, createKeyboard, toUtf16Units } from "../src/system/keyboard.ts";

type Call = { command: string; args: string[]; input: string };

const SECRET = "Zażółć+^%~{}()gęślą😀";

function fakeRunner(output = "") {
	const calls: Call[] = [];
	const run: CommandRunner = (command, args, input) => {
		calls.push({ command, args, input });
		return Promise.resolve(output);
	};
	return { calls, run };
}

describe("toUtf16Units", () => {
	it("encodes SendKeys metacharacters as their plain code units", () => {
		assert.deepEqual(toUtf16Units("+^%~{}()"), [43, 94, 37, 126, 123, 125, 40, 41]);
	});

	it("encodes Polish diacritics as single code units", () => {
		assert.deepEqual(toUtf16Units("ąćęłńóśźżŻ"), [261, 263, 281, 322, 324, 243, 347, 378, 380, 379]);
	});

	it("keeps both halves of a surrogate pair", () => {
		assert.deepEqual(toUtf16Units("😀"), [0xd83d, 0xde00]);
	});

	it("returns nothing for empty text", () => {
		assert.deepEqual(toUtf16Units(""), []);
	});
});

describe("keyboard on win32", () => {
	it("types through PowerShell SendInput with the code units on stdin", async () => {
		const { calls, run } = fakeRunner();
		await createKeyboard("win32", run).type(SECRET);
		assert.equal(calls.length, 1);
		assert.equal(calls[0].command, "powershell");
		assert.deepEqual(calls[0].args.slice(0, 3), ["-NoProfile", "-NonInteractive", "-Command"]);
		assert.match(calls[0].args[3], /SendInput/);
		assert.match(calls[0].args[3], /::Type\(/);
		assert.equal(calls[0].input, toUtf16Units(SECRET).join(","));
	});

	it("never puts the typed text into argv", async () => {
		const { calls, run } = fakeRunner();
		await createKeyboard("win32", run).type(SECRET);
		for (const arg of calls[0].args) {
			assert.ok(!arg.includes(SECRET) && !arg.includes(toUtf16Units(SECRET).join(",")), arg);
		}
	});

	it("pastes with Ctrl+V through SendInput and an empty stdin", async () => {
		const { calls, run } = fakeRunner();
		await createKeyboard("win32", run).paste();
		assert.equal(calls.length, 1);
		assert.match(calls[0].args[3], /::Paste\(\)/);
		assert.equal(calls[0].input, "");
	});
});

describe("keyboard on darwin", () => {
	it("types through JXA osascript with the code units on stdin", async () => {
		const { calls, run } = fakeRunner();
		await createKeyboard("darwin", run).type(SECRET);
		assert.equal(calls.length, 1);
		assert.equal(calls[0].command, "osascript");
		assert.deepEqual(calls[0].args.slice(0, 3), ["-l", "JavaScript", "-e"]);
		assert.match(calls[0].args[3], /AXIsProcessTrusted/);
		assert.match(calls[0].args[3], /CGEventKeyboardSetUnicodeString/);
		assert.equal(calls[0].input, toUtf16Units(SECRET).join(","));
		assert.ok(!calls[0].args.some((arg) => arg.includes(SECRET)));
	});

	it("pastes with Cmd+V and an empty stdin", async () => {
		const { calls, run } = fakeRunner();
		await createKeyboard("darwin", run).paste();
		assert.match(calls[0].args[3], /AXIsProcessTrusted/);
		assert.match(calls[0].args[3], /CGEventSetFlags/);
		assert.equal(calls[0].input, "");
	});

	it("uses different scripts for typing and pasting", async () => {
		const { calls, run } = fakeRunner();
		const keyboard = createKeyboard("darwin", run);
		await keyboard.type("a");
		await keyboard.paste();
		assert.notEqual(calls[0].args[3], calls[1].args[3]);
	});

	it("rejects with AccessibilityPermissionError when the script reports a missing permission", async () => {
		const { run } = fakeRunner("accessibility-denied\n");
		const keyboard = createKeyboard("darwin", run);
		await assert.rejects(keyboard.type(SECRET), AccessibilityPermissionError);
		await assert.rejects(keyboard.paste(), AccessibilityPermissionError);
	});

	it("names the Accessibility setting in the error without the secret", async () => {
		const { run } = fakeRunner("accessibility-denied\n");
		await assert.rejects(createKeyboard("darwin", run).type(SECRET), (error: Error) => {
			assert.match(error.message, /Accessibility/);
			assert.ok(!error.message.includes(SECRET));
			return true;
		});
	});
});

describe("keyboard on an unsupported platform", () => {
	it("throws a descriptive error", () => {
		assert.throws(() => createKeyboard("linux", fakeRunner().run), /linux/);
	});
});
