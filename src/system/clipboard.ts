import { spawn } from "node:child_process";

export function copyToClipboard(text: string): Promise<void> {
	return new Promise((resolve, reject) => {
		const pbcopy = spawn("pbcopy");
		pbcopy.on("error", reject);
		pbcopy.on("close", (code) => (code === 0 ? resolve() : reject(new Error(`pbcopy exited with ${code}`))));
		pbcopy.stdin.end(text);
	});
}
