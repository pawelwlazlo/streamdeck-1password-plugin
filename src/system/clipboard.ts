import { spawn } from "node:child_process";

export type CommandRunner = (command: string, args: string[], input: string) => Promise<string>;

interface ClipboardBackend {
	write(text: string): Promise<string>;
	read(): Promise<string>;
	clear(): Promise<string>;
}

export interface Clipboard {
	copyToClipboard(text: string): Promise<void>;
	copySecretToClipboard(secret: string, clearAfterMs?: number): Promise<void>;
}

const POWERSHELL_ARGS = ["-NoProfile", "-NonInteractive", "-Command"];

const backends: Partial<Record<NodeJS.Platform, (run: CommandRunner) => ClipboardBackend>> = {
	darwin: (run) => ({
		write: (text) => run("pbcopy", [], text),
		read: () => run("pbpaste", [], ""),
		clear: () => run("pbcopy", [], ""),
	}),
	win32: (run) => {
		const powershell = (script: string, input = "") => run("powershell", [...POWERSHELL_ARGS, script], input);
		return {
			write: (text) => powershell("[Console]::InputEncoding = [Text.Encoding]::UTF8; Set-Clipboard -Value ([Console]::In.ReadToEnd())", text),
			read: () => powershell("[Console]::OutputEncoding = [Text.Encoding]::UTF8; [Console]::Out.Write([string](Get-Clipboard -Raw))"),
			clear: () => powershell("Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Clipboard]::Clear()"),
		};
	},
};

export function createClipboard(platform: NodeJS.Platform, run: CommandRunner = runCommand): Clipboard {
	const createBackend = backends[platform];
	if (!createBackend) {
		throw new Error(`Clipboard is not supported on ${platform}`);
	}
	const backend = createBackend(run);

	const copyToClipboard = (text: string) => backend.write(text).then(() => undefined);

	const clearIfEquals = async (secret: string) => {
		if ((await backend.read()) === secret) {
			await backend.clear();
		}
	};

	return {
		copyToClipboard,
		copySecretToClipboard: (secret, clearAfterMs = 30_000) =>
			copyToClipboard(secret).then(() => {
				setTimeout(() => void clearIfEquals(secret).catch(() => undefined), clearAfterMs).unref();
			}),
	};
}

function runCommand(command: string, args: string[], input: string): Promise<string> {
	return new Promise((resolve, reject) => {
		const child = spawn(command, args, { windowsHide: true });
		let stdout = "";
		child.stdout.setEncoding("utf8");
		child.stdout.on("data", (chunk: string) => (stdout += chunk));
		child.on("error", reject);
		child.on("close", (code) => (code === 0 ? resolve(stdout) : reject(new Error(`${command} exited with ${code}`))));
		child.stdin.end(input);
	});
}

const clipboard = createClipboard(process.platform);

export const copyToClipboard = clipboard.copyToClipboard;
export const copySecretToClipboard = clipboard.copySecretToClipboard;
