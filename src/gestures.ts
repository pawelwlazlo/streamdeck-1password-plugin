export type GestureHandlers = {
	onSingle: () => void;
	onDouble: () => void;
	onLong: () => void;
};

export type GestureTimings = {
	doubleClickMs: number;
	longPressMs: number;
};

export class GestureDetector {
	private longPressTimer: NodeJS.Timeout | undefined;
	private singleClickTimer: NodeJS.Timeout | undefined;
	private longPressFired = false;
	private secondPress = false;
	private readonly handlers: GestureHandlers;
	private readonly timings: GestureTimings;

	constructor(handlers: GestureHandlers, timings: GestureTimings = { doubleClickMs: 300, longPressMs: 500 }) {
		this.handlers = handlers;
		this.timings = timings;
	}

	down(): void {
		this.longPressFired = false;
		this.secondPress = this.singleClickTimer !== undefined;
		this.clearSingleClick();
		this.longPressTimer = setTimeout(() => {
			this.longPressFired = true;
			this.clearSingleClick();
			this.handlers.onLong();
		}, this.timings.longPressMs);
	}

	up(): void {
		clearTimeout(this.longPressTimer);
		if (this.longPressFired) {
			return;
		}
		if (this.secondPress) {
			this.secondPress = false;
			this.handlers.onDouble();
			return;
		}
		this.singleClickTimer = setTimeout(() => {
			this.singleClickTimer = undefined;
			this.handlers.onSingle();
		}, this.timings.doubleClickMs);
	}

	private clearSingleClick(): void {
		clearTimeout(this.singleClickTimer);
		this.singleClickTimer = undefined;
	}
}
