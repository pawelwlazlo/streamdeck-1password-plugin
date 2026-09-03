import streamDeck, {
	action,
	type KeyAction,
	type KeyDownEvent,
	type KeyUpEvent,
	type SendToPluginEvent,
	SingletonAction,
	type WillDisappearEvent,
} from "@elgato/streamdeck";

import { GestureDetector } from "../gestures";
import { getLoginFields, listItems, listVaults, type LoginFields } from "../onepassword/client";
import { copySecretToClipboard, copyToClipboard } from "../system/clipboard";

type ItemSettings = {
	vaultId?: string;
	itemId?: string;
	longPressMode?: "open" | "otp";
};

type DataSourceRequest = {
	event: "getVaults" | "getItems";
};

@action({ UUID: "io.nerd4rent.streamdeck-1password-plugin.item" })
export class OnePasswordItem extends SingletonAction<ItemSettings> {
	private readonly detectors = new Map<string, GestureDetector>();

	override onKeyDown(ev: KeyDownEvent<ItemSettings>): void {
		this.detectorFor(ev.action).down();
	}

	override onKeyUp(ev: KeyUpEvent<ItemSettings>): void {
		this.detectorFor(ev.action).up();
	}

	override onWillDisappear(ev: WillDisappearEvent<ItemSettings>): void {
		this.detectors.delete(ev.action.id);
	}

	override async onSendToPlugin(ev: SendToPluginEvent<DataSourceRequest, ItemSettings>): Promise<void> {
		const request = ev.payload;
		try {
			const settings = await ev.action.getSettings();
			const items = await this.loadOptions(request.event, settings);
			if (request.event === "getItems" && settings.itemId && !items.some((item) => item.value === settings.itemId)) {
				await ev.action.setSettings({ ...settings, itemId: undefined });
			}
			await streamDeck.ui.sendToPropertyInspector({ event: request.event, items });
		} catch (error) {
			streamDeck.logger.error(`Failed to load ${request.event}`, error);
			await streamDeck.ui.sendToPropertyInspector({ event: request.event, items: [] });
		}
	}

	private loadOptions(event: DataSourceRequest["event"], settings: ItemSettings) {
		if (event === "getVaults") {
			return listVaults();
		}
		return settings.vaultId ? listItems(settings.vaultId) : Promise.resolve([]);
	}

	private detectorFor(key: KeyAction<ItemSettings>): GestureDetector {
		let detector = this.detectors.get(key.id);
		if (!detector) {
			detector = new GestureDetector({
				onSingle: () => this.run(key, "copy username", (f) => copyRequired(f.username, "username")),
				onDouble: () => this.run(key, "copy password", (f) => copySecretRequired(f.password, "password")),
				onLong: () => this.run(key, "long press", async (f) => {
					const { longPressMode = "open" } = await key.getSettings();
					if (longPressMode === "otp") {
						return copySecretRequired(f.otp, "one-time password");
					}
					if (!f.url) {
						throw new Error("Item has no website URL");
					}
					await streamDeck.system.openUrl(f.url);
					if (f.password) {
						await copySecretToClipboard(f.password);
					}
				}),
			});
			this.detectors.set(key.id, detector);
		}
		return detector;
	}

	private async run(key: KeyAction<ItemSettings>, gesture: string, perform: (fields: LoginFields) => Promise<void>): Promise<void> {
		try {
			const { vaultId, itemId } = await key.getSettings();
			if (!vaultId || !itemId) {
				throw new Error("No 1Password item selected");
			}
			await perform(await getLoginFields(vaultId, itemId));
			await key.showOk();
		} catch (error) {
			streamDeck.logger.error(`Gesture "${gesture}" failed`, error);
			await key.showAlert();
		}
	}
}

async function copyRequired(value: string | undefined, name: string): Promise<void> {
	if (!value) {
		throw new Error(`Item has no ${name}`);
	}
	await copyToClipboard(value);
}

async function copySecretRequired(value: string | undefined, name: string): Promise<void> {
	if (!value) {
		throw new Error(`Item has no ${name}`);
	}
	await copySecretToClipboard(value);
}
