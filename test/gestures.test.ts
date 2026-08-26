import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it, mock } from "node:test";

import { GestureDetector } from "../src/gestures.ts";

describe("GestureDetector", () => {
	const single = mock.fn();
	const double = mock.fn();
	const long = mock.fn();
	let detector: GestureDetector;

	beforeEach(() => {
		mock.timers.enable({ apis: ["setTimeout"] });
		single.mock.resetCalls();
		double.mock.resetCalls();
		long.mock.resetCalls();
		detector = new GestureDetector({ onSingle: single, onDouble: double, onLong: long }, { doubleClickMs: 300, longPressMs: 500 });
	});

	afterEach(() => {
		mock.timers.reset();
	});

	function calls() {
		return [single.mock.callCount(), double.mock.callCount(), long.mock.callCount()];
	}

	it("emits single after the double-click window passes", () => {
		detector.down();
		detector.up();
		mock.timers.tick(299);
		assert.deepEqual(calls(), [0, 0, 0]);
		mock.timers.tick(1);
		assert.deepEqual(calls(), [1, 0, 0]);
	});

	it("emits double on two presses within the window", () => {
		detector.down();
		detector.up();
		mock.timers.tick(100);
		detector.down();
		detector.up();
		mock.timers.tick(1000);
		assert.deepEqual(calls(), [0, 1, 0]);
	});

	it("emits long while held past the threshold, without a single on release", () => {
		detector.down();
		mock.timers.tick(499);
		assert.deepEqual(calls(), [0, 0, 0]);
		mock.timers.tick(1);
		assert.deepEqual(calls(), [0, 0, 1]);
		detector.up();
		mock.timers.tick(1000);
		assert.deepEqual(calls(), [0, 0, 1]);
	});

	it("treats presses separated by more than the window as two singles", () => {
		detector.down();
		detector.up();
		mock.timers.tick(300);
		detector.down();
		detector.up();
		mock.timers.tick(300);
		assert.deepEqual(calls(), [2, 0, 0]);
	});
});
