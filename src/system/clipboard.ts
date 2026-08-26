import { execFile, spawn } from "node:child_process";

export function copyToClipboard(text: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const pbcopy = spawn("pbcopy");
		pbcopy.on("error", reject);
		pbcopy.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`pbcopy exited with ${code}`))));
		pbcopy.stdin.end(text);
	});
}

export function copySecretToClipboard(secret: string, clearAfterMs = 30_000): Promise<void> {
	return copyToClipboard(secret).then(() => {
		setTimeout(() => clearClipboardIfEquals(secret), clearAfterMs).unref();
	});
}

function clearClipboardIfEquals(secret: string): void {
	execFile("pbpaste", (error, stdout) => {
		if (!error && stdout === secret) {
			void copyToClipboard("");
		}
	});
}
