export type ItemFieldInfo = {
	id: string;
	title: string;
	sectionTitle?: string;
	fieldType: string;
	value: string;
};

export type ItemInfo = {
	fields: ItemFieldInfo[];
	websites: string[];
};

export type GestureTarget =
	| { kind: "none" }
	| { kind: "open"; url: string }
	| { kind: "copy"; value: string; secret: boolean };

export type GestureOutput = "copy" | "paste" | "type";

const GESTURE_OUTPUTS: readonly string[] = ["copy", "paste", "type"] satisfies GestureOutput[];

export function resolveGestureOutput(setting: string | undefined): GestureOutput {
	return setting && GESTURE_OUTPUTS.includes(setting) ? (setting as GestureOutput) : "copy";
}

export const NO_ACTION = "";
export const OPEN_WEBSITE = "open-website";
const FIELD_PREFIX = "field:";

const SECRET_FIELD_TYPES = new Set(["Concealed", "Totp"]);

export type SshKeyAttributes = {
	publicKey: string;
	fingerprint: string;
	keyType: string;
};

const SSH_KEY_ATTRIBUTES: { key: keyof SshKeyAttributes; title: string }[] = [
	{ key: "publicKey", title: "public key" },
	{ key: "fingerprint", title: "fingerprint" },
	{ key: "keyType", title: "key type" },
];

export function sshKeyFields(field: { id: string; sectionTitle?: string }, attributes: SshKeyAttributes): ItemFieldInfo[] {
	return SSH_KEY_ATTRIBUTES.map(({ key, title }) => ({
		id: `${field.id}.${key}`,
		title,
		sectionTitle: field.sectionTitle,
		fieldType: "Text",
		value: attributes[key],
	}));
}

export function isSecretField(fieldType: string): boolean {
	return SECRET_FIELD_TYPES.has(fieldType);
}

export function fieldOptions(item: ItemInfo): { label: string; value: string }[] {
	const options = [{ label: "Do nothing", value: NO_ACTION }];
	if (item.websites[0]) {
		options.push({ label: "Open website", value: OPEN_WEBSITE });
	}
	for (const field of item.fields) {
		options.push({ label: fieldLabel(field, item.fields), value: FIELD_PREFIX + field.id });
	}
	return options;
}

function fieldLabel(field: ItemFieldInfo, fields: ItemFieldInfo[]): string {
	const title = field.title || field.id;
	const duplicated = fields.some((other) => other !== field && (other.title || other.id) === title);
	return duplicated && field.sectionTitle ? `${field.sectionTitle} → ${title}` : title;
}

export function resolveGestureTarget(target: string | undefined, item: ItemInfo): GestureTarget {
	if (!target) {
		return { kind: "none" };
	}
	if (target === OPEN_WEBSITE) {
		const url = item.websites[0];
		if (!url) {
			throw new Error("Item has no website URL");
		}
		return { kind: "open", url };
	}
	if (!target.startsWith(FIELD_PREFIX)) {
		throw new Error(`Unknown gesture target "${target}"`);
	}
	const fieldId = target.slice(FIELD_PREFIX.length);
	const field = item.fields.find((f) => f.id === fieldId);
	if (!field) {
		throw new Error(`Item has no field "${fieldId}"`);
	}
	if (!field.value) {
		throw new Error(`Field "${fieldId}" is empty`);
	}
	return { kind: "copy", value: field.value, secret: isSecretField(field.fieldType) };
}
