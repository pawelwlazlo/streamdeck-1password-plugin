import streamDeck, {
	action,
	type KeyAction,
	type KeyDownEvent,
	type KeyUpEvent,
	type SendToPluginEvent,
	SingletonAction,
	type WillDisappearEvent,
} from "@elgato/streamdeck";

import { errorMessage } from "../error-message";
import { fieldOptions, resolveGestureTarget } from "../gesture-targets";
import { GestureDetector } from "../gestures";
import { getItemInfo, listItems, listVaults, type Option } from "../onepassword/client";
import { copySecretToClipboard, copyToClipboard } from "../system/clipboard";

type FieldsSettings = {
	vaultId?: string;
	itemId?: string;
	pressTarget?: string;
	doublePressTarget?: string;
	holdTarget?: string;
};

type TargetKey = "pressTarget" | "doublePressTarget" | "holdTarget";

const TARGET_KEYS: TargetKey[] = ["pressTarget", "doublePressTarget", "holdTarget"];

type DataSourceRequest = {
	event: "getVaults" | "getItems" | "getFields";
};

@action({ UUID: "io.nerd4rent.streamdeck-1password-plugin.fields" })
export class OnePasswordFields extends SingletonAction<FieldsSettings> {
	private readonly detectors = new Map<string, GestureDetector>();

	override onKeyDown(ev: KeyDownEvent<FieldsSettings>): void {
		this.detectorFor(ev.action).down();
	}

	override onKeyUp(ev: KeyUpEvent<FieldsSettings>): void {
		this.detectorFor(ev.action).up();
	}

	override onWillDisappear(ev: WillDisappearEvent<FieldsSettings>): void {
		this.detectors.delete(ev.action.id);
	}

	override async onSendToPlugin(ev: SendToPluginEvent<DataSourceRequest, FieldsSettings>): Promise<void> {
		const request = ev.payload;
		try {
			const settings = await ev.action.getSettings();
			const items = await this.loadOptions(request.event, settings);
			const current = await ev.action.getSettings();
			const sameItem = current.vaultId === settings.vaultId && current.itemId === settings.itemId;
			const stale = sameItem ? this.staleSettings(request.event, current, items) : undefined;
			if (stale) {
				await ev.action.setSettings({ ...current, ...stale });
			}
			await streamDeck.ui.sendToPropertyInspector({ event: request.event, items });
		} catch (error) {
			streamDeck.logger.error(`Failed to load ${request.event}`, error);
			await streamDeck.ui.sendToPropertyInspector({ event: request.event, items: [], error: errorMessage(error) });
		}
	}

	private async loadOptions(event: DataSourceRequest["event"], settings: FieldsSettings): Promise<Option[]> {
		if (event === "getVaults") {
			return listVaults();
		}
		if (event === "getItems") {
			return settings.vaultId ? listItems(settings.vaultId) : [];
		}
		return settings.vaultId && settings.itemId ? fieldOptions(await getItemInfo(settings.vaultId, settings.itemId)) : [];
	}

	private staleSettings(event: DataSourceRequest["event"], settings: FieldsSettings, items: Option[]): Partial<FieldsSettings> | undefined {
		const known = (value: string) => items.some((item) => item.value === value);
		if (event === "getItems" && settings.itemId && !known(settings.itemId)) {
			return { itemId: undefined };
		}
		if (event === "getFields" && settings.itemId) {
			const staleKeys = TARGET_KEYS.filter((key) => settings[key] && !known(settings[key]));
			return staleKeys.length ? Object.fromEntries(staleKeys.map((key) => [key, undefined])) : undefined;
		}
		return undefined;
	}

	private detectorFor(key: KeyAction<FieldsSettings>): GestureDetector {
		let detector = this.detectors.get(key.id);
		if (!detector) {
			detector = new GestureDetector({
				onSingle: () => this.run(key, "pressTarget"),
				onDouble: () => this.run(key, "doublePressTarget"),
				onLong: () => this.run(key, "holdTarget"),
			});
			this.detectors.set(key.id, detector);
		}
		return detector;
	}

	private async run(key: KeyAction<FieldsSettings>, targetKey: TargetKey): Promise<void> {
		try {
			const settings = await key.getSettings();
			const target = settings[targetKey];
			if (!target) {
				return;
			}
			if (!settings.vaultId || !settings.itemId) {
				throw new Error("No 1Password item selected");
			}
			const resolved = resolveGestureTarget(target, await getItemInfo(settings.vaultId, settings.itemId));
			if (resolved.kind === "open") {
				await streamDeck.system.openUrl(resolved.url);
			} else if (resolved.kind === "copy") {
				await (resolved.secret ? copySecretToClipboard(resolved.value) : copyToClipboard(resolved.value));
			}
			await key.showOk();
		} catch (error) {
			streamDeck.logger.error(`Gesture "${targetKey}" failed`, error);
			await key.showAlert();
		}
	}
}
