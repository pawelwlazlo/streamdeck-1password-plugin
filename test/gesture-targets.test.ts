import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { fieldOptions, isSecretField, resolveGestureTarget, type ItemInfo } from "../src/gesture-targets.ts";

const item: ItemInfo = {
	fields: [
		{ id: "username", title: "username", fieldType: "Text", value: "pawel" },
		{ id: "password", title: "password", fieldType: "Concealed", value: "s3cret" },
		{ id: "pin", title: "PIN", sectionTitle: "Bank", fieldType: "Concealed", value: "1234" },
		{ id: "pin2", title: "PIN", sectionTitle: "Card", fieldType: "Concealed", value: "5678" },
		{ id: "otp", title: "one-time password", fieldType: "Totp", value: "123456" },
		{ id: "account", title: "", fieldType: "Text", value: "PL61" },
		{ id: "empty", title: "Empty", fieldType: "Text", value: "" },
	],
	websites: ["https://example.com", "https://other.example.com"],
};

describe("isSecretField", () => {
	it("treats concealed and TOTP fields as secrets", () => {
		assert.equal(isSecretField("Concealed"), true);
		assert.equal(isSecretField("Totp"), true);
	});

	it("treats every other field type as plain", () => {
		for (const type of ["Text", "Email", "Url", "CreditCardNumber", "Phone", "Unsupported"]) {
			assert.equal(isSecretField(type), false, type);
		}
	});
});

describe("fieldOptions", () => {
	it("lists nothing, open website and every field by title", () => {
		assert.deepEqual(fieldOptions(item), [
			{ label: "Do nothing", value: "" },
			{ label: "Open website", value: "open-website" },
			{ label: "username", value: "field:username" },
			{ label: "password", value: "field:password" },
			{ label: "Bank → PIN", value: "field:pin" },
			{ label: "Card → PIN", value: "field:pin2" },
			{ label: "one-time password", value: "field:otp" },
			{ label: "account", value: "field:account" },
			{ label: "Empty", value: "field:empty" },
		]);
	});

	it("omits open website when the item has no website", () => {
		const values = fieldOptions({ fields: [], websites: [] }).map((option) => option.value);
		assert.deepEqual(values, [""]);
	});

	it("never carries field values", () => {
		const serialized = JSON.stringify(fieldOptions(item));
		for (const field of item.fields.filter((f) => f.value)) {
			assert.equal(serialized.includes(field.value), false, field.id);
		}
	});
});

describe("resolveGestureTarget", () => {
	it("does nothing for an empty or missing target", () => {
		assert.deepEqual(resolveGestureTarget("", item), { kind: "none" });
		assert.deepEqual(resolveGestureTarget(undefined, item), { kind: "none" });
	});

	it("opens the first website", () => {
		assert.deepEqual(resolveGestureTarget("open-website", item), { kind: "open", url: "https://example.com" });
	});

	it("fails to open a website the item does not have", () => {
		assert.throws(() => resolveGestureTarget("open-website", { fields: [], websites: [] }));
	});

	it("copies a plain field without clearing", () => {
		assert.deepEqual(resolveGestureTarget("field:username", item), { kind: "copy", value: "pawel", secret: false });
	});

	it("copies a concealed field as a secret", () => {
		assert.deepEqual(resolveGestureTarget("field:pin2", item), { kind: "copy", value: "5678", secret: true });
	});

	it("copies the current OTP code as a secret", () => {
		assert.deepEqual(resolveGestureTarget("field:otp", item), { kind: "copy", value: "123456", secret: true });
	});

	it("fails for a field the item no longer has", () => {
		assert.throws(() => resolveGestureTarget("field:gone", item));
	});

	it("fails for a field with an empty value", () => {
		assert.throws(() => resolveGestureTarget("field:empty", item));
	});

	it("fails for an unknown target", () => {
		assert.throws(() => resolveGestureTarget("bogus", item));
	});
});
