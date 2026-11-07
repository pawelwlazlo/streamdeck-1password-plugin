import type { CommandRunner } from "./clipboard";

export interface Keyboard {
	paste(): Promise<void>;
	type(text: string): Promise<void>;
}

export class AccessibilityPermissionError extends Error {
	constructor() {
		super("Stream Deck needs the Accessibility permission to paste and type: System Settings → Privacy & Security → Accessibility");
		this.name = "AccessibilityPermissionError";
	}
}

const TYPE_DELAY_MS = 10;
const ACCESSIBILITY_DENIED = "accessibility-denied";

export function toUtf16Units(text: string): number[] {
	return Array.from({ length: text.length }, (_, index) => text.charCodeAt(index));
}

const WINDOWS_SEND_INPUT = `$ErrorActionPreference = 'Stop'
Add-Type -TypeDefinition '
using System;
using System.ComponentModel;
using System.Runtime.InteropServices;
using System.Threading;
public static class StreamDeckKeyboard {
	[StructLayout(LayoutKind.Sequential)] struct MOUSEINPUT { public int dx; public int dy; public uint mouseData; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
	[StructLayout(LayoutKind.Sequential)] struct KEYBDINPUT { public ushort wVk; public ushort wScan; public uint dwFlags; public uint time; public IntPtr dwExtraInfo; }
	[StructLayout(LayoutKind.Explicit)] struct INPUTUNION { [FieldOffset(0)] public MOUSEINPUT mi; [FieldOffset(0)] public KEYBDINPUT ki; }
	[StructLayout(LayoutKind.Sequential)] struct INPUT { public uint type; public INPUTUNION u; }
	[DllImport("user32.dll", SetLastError = true)] static extern uint SendInput(uint count, INPUT[] inputs, int size);
	const uint INPUT_KEYBOARD = 1;
	const uint KEYEVENTF_KEYUP = 2;
	const uint KEYEVENTF_UNICODE = 4;
	const ushort VK_CONTROL = 0x11;
	const ushort VK_V = 0x56;
	static INPUT Key(ushort vk, ushort scan, uint flags) {
		INPUT input = new INPUT();
		input.type = INPUT_KEYBOARD;
		input.u.ki.wVk = vk;
		input.u.ki.wScan = scan;
		input.u.ki.dwFlags = flags;
		return input;
	}
	static void Send(params INPUT[] inputs) {
		if (SendInput((uint)inputs.Length, inputs, Marshal.SizeOf(typeof(INPUT))) != inputs.Length) {
			throw new Win32Exception(Marshal.GetLastWin32Error());
		}
	}
	public static void Type(ushort[] units, int delayMs) {
		foreach (ushort unit in units) {
			Send(Key(0, unit, KEYEVENTF_UNICODE), Key(0, unit, KEYEVENTF_UNICODE | KEYEVENTF_KEYUP));
			Thread.Sleep(delayMs);
		}
	}
	public static void Paste() {
		Send(Key(VK_CONTROL, 0, 0), Key(VK_V, 0, 0), Key(VK_V, 0, KEYEVENTF_KEYUP), Key(VK_CONTROL, 0, KEYEVENTF_KEYUP));
	}
}
'`;

const MAC_ACCESSIBILITY_CHECK = `ObjC.import('ApplicationServices');
ObjC.import('Foundation');
const HID_EVENT_TAP = 0;
function postKey(keyCode, flags, prepare) {
	for (const down of [true, false]) {
		const event = $.CGEventCreateKeyboardEvent($(), keyCode, down);
		if (flags) {
			$.CGEventSetFlags(event, flags);
		}
		prepare(event);
		$.CGEventPost(HID_EVENT_TAP, event);
	}
}
function run() {
	if (!$.AXIsProcessTrusted()) {
		return '${ACCESSIBILITY_DENIED}';
	}
	send();
	return '';
}`;

const MAC_TYPE = `${MAC_ACCESSIBILITY_CHECK}
function send() {
	const data = $.NSFileHandle.fileHandleWithStandardInput.readDataToEndOfFile;
	const input = $.NSString.alloc.initWithDataEncoding(data, $.NSUTF8StringEncoding).js;
	const text = String.fromCharCode(...input.split(/\\D+/).filter(Boolean).map(Number));
	for (const character of Array.from(text)) {
		const units = Array.from({ length: character.length }, (_, index) => character.charCodeAt(index));
		postKey(0, 0, (event) => $.CGEventKeyboardSetUnicodeString(event, units.length, units));
		delay(${TYPE_DELAY_MS / 1000});
	}
}`;

const MAC_PASTE = `${MAC_ACCESSIBILITY_CHECK}
const KEY_V = 9;
const COMMAND_FLAG = 0x100000;
function send() {
	postKey(KEY_V, COMMAND_FLAG, () => undefined);
}`;

const POWERSHELL_ARGS = ["-NoProfile", "-NonInteractive", "-Command"];

type KeyboardBackend = (run: CommandRunner) => { paste(): Promise<string>; type(units: string): Promise<string> };

const backends: Partial<Record<NodeJS.Platform, KeyboardBackend>> = {
	darwin: (run) => ({
		paste: () => run("osascript", ["-l", "JavaScript", "-e", MAC_PASTE], ""),
		type: (units) => run("osascript", ["-l", "JavaScript", "-e", MAC_TYPE], units),
	}),
	win32: (run) => {
		const powershell = (call: string, input: string) => run("powershell", [...POWERSHELL_ARGS, `${WINDOWS_SEND_INPUT}\n${call}`], input);
		return {
			paste: () => powershell("[StreamDeckKeyboard]::Paste()", ""),
			type: (units) =>
				powershell(`[StreamDeckKeyboard]::Type([uint16[]]([Console]::In.ReadToEnd() -split '\\D+' -ne ''), ${TYPE_DELAY_MS})`, units),
		};
	},
};

export function createKeyboard(platform: NodeJS.Platform, run: CommandRunner): Keyboard {
	const createBackend = backends[platform];
	if (!createBackend) {
		throw new Error(`Keyboard is not supported on ${platform}`);
	}
	const backend = createBackend(run);

	const checked = async (output: Promise<string>) => {
		if ((await output).trim() === ACCESSIBILITY_DENIED) {
			throw new AccessibilityPermissionError();
		}
	};

	return {
		paste: () => checked(backend.paste()),
		type: (text) => checked(backend.type(toUtf16Units(text).join(","))),
	};
}
