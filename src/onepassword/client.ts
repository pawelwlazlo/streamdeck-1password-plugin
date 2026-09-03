import { createClient, DesktopAuth, type Client } from "@1password/sdk";
import streamDeck from "@elgato/streamdeck";

type GlobalSettings = {
	accountName?: string;
};

export type LoginFields = {
	username?: string;
	password?: string;
	otp?: string;
	url?: string;
};

export type Option = { label: string; value: string };

let cached: { accountName: string; client: Promise<Client> } | undefined;

streamDeck.settings.onDidReceiveGlobalSettings<GlobalSettings>((ev) => {
	if (cached && cached.accountName !== ev.settings.accountName) {
		cached = undefined;
	}
});

async function getClient(): Promise<Client> {
	const { accountName } = await streamDeck.settings.getGlobalSettings<GlobalSettings>();
	if (!accountName) {
		throw new Error("1Password account name is not configured");
	}
	if (cached?.accountName !== accountName) {
		const client = createClient({
			auth: new DesktopAuth(accountName),
			integrationName: "Stream Deck 1Password plugin",
			integrationVersion: "v0.1.0",
		});
		cached = { accountName, client };
		client.catch(() => {
			cached = undefined;
		});
	}
	return cached.client;
}

export async function listVaults(): Promise<Option[]> {
	const client = await getClient();
	const vaults = await client.vaults.list();
	return vaults.map((v) => ({ label: v.title, value: v.id }));
}

export async function listItems(vaultId: string): Promise<Option[]> {
	const client = await getClient();
	const items = await client.items.list(vaultId);
	return items.map((i) => ({ label: i.title, value: i.id }));
}

export async function getLoginFields(vaultId: string, itemId: string): Promise<LoginFields> {
	const client = await getClient();
	const item = await client.items.get(vaultId, itemId);
	const otpField = item.fields.find((f) => f.details?.type === "Otp");
	return {
		username: item.fields.find((f) => f.id === "username")?.value,
		password: item.fields.find((f) => f.id === "password")?.value,
		otp: otpField?.details?.type === "Otp" ? otpField.details.content.code : undefined,
		url: item.websites[0]?.url,
	};
}
