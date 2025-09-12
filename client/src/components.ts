
import {
	State,
	h, s, Micron,
	Shared, playerIcons,
} from "./modules/"

export function LogoIcons() {
	const icons = [];
	for (let i = 0; i < playerIcons.count; i++) {
		icons.push(playerIcons.View(i, Shared.playerColor(i)));
	}
	return h("div#logo-icons", icons);
}
export function Logo() {
	return h("div#logo", [
		h("h1", "GoblinCon"),
		LogoIcons(),
	]);
}


type BarOptions = {
	middle?: Micron.Children,
	left?: Micron.Children,
	right?: Micron.Children
};

export function TrayLeft(children: Micron.Children) {
	return h("div#tray-left", children);
}
export function TrayRight(children: Micron.Children) {
	return h("div#tray-right", children);
}
export function TopBar({ middle, left, right }: BarOptions) {
	return h("div#top-bar", [
		h("div.left", left),
		h("div.middle", middle),
		h("div.right", right),
	]);
}
export function BottomBar({ middle, left, right }: BarOptions) {
	return h("div#bottom-bar", [
		h("div.left", left),
		h("div.middle", middle),
		//h("div.middle", countdown?.View()),
		h("div.right", right)
	]);
}
export function IdlePage(title: string, subtitle?: string) {
	return h("div.scaffold", [
		subtitle && h("div.primary-page", [
			h("h2", title),
			h("div.idle-subtitle",
				{ style: { fontSize: "1.2em" } },
				subtitle
			)
		])
	]);
}
export class Nav extends Micron.Anchor {

	static create<A extends any[] = []>(initial?: Micron.Builder<A>, ...initialArgs: A): Nav {
		return new Nav(!initial ? undefined : [initial, initialArgs]);
	}
	static Btn(children: Micron.Children, onClick: () => void, { selected, disabled }: { selected?: boolean, disabled?: boolean }) {
		return h("button.nav-btn",
			{
				class: { selected: !!selected },
				attrs: { disabled: !!disabled },
				on: { click: onClick }
			},
			children
		);
	}
	//static IconBtn(src: string, onClick: () => void)
	Btn(children: Micron.Children, builder: Micron.Builder, { disabled }: { disabled?: boolean } = {}) {
		return s(this.changed, curr => {
			const click = () => this.toggle(builder);
			const selected = this.is(builder);
			return Nav.Btn(children, click, { selected, disabled });
		});
	}
	IconBtn(src: string, builder: Micron.Builder, { disabled }: { disabled?: boolean } = {}) {
		const icon = h("img", { attrs: { src } });
		return this.Btn(icon, builder, { disabled });
	}
}

/*export function IdlePage(header: string, ...subheaders: string[]) {
	return h("div#idle.page", [
		h("h1", header),
		...subheaders.map((s) => h("h2", s)),
	]);
}*/

export function VoteButtons(choices: string[], submit: (choice: string) => void): Micron.Node[] {
	return choices.map(choice => {
		return h("button", { on: { click: () => submit(choice) } }, choice);
	});
}

export function IconBtn(iconSrc: string, onClick: () => any, disabled = false): Micron.Node {
	return h("button.icon-btn",
		{
			on: { click: onClick },
			attrs: { disabled }
		},
		h("img", { attrs: { src: iconSrc }})
	);
}

/*export function Tray(children: Micron.Children) {
	return h("div#tray", children);
}*/

/*export function mountedBtn(iconSrc: string, onClick: () => any): Node {
	return h("div#mounted-btns", iconBtn(iconSrc, onClick));
}
export function mountedBtns(btnArgs: Array<[string, () => any]>): Node {
	const btns = btnArgs.map(data => iconBtn(...data));
	return h("div#mounted-btns", btns);
}*/
/*export function endTime(secsLeft: number, secsBuffer: number): number {
	return Date.now() + 1000 * (secsLeft - secsBuffer);
}*/

export class Countdown {
	
	private remainingSecs = new Micron.State(NaN);
	//private popupSecs = new Micron.State(NaN);
	private callbacks: Array<{ time: number, callback: () => any }> = [];
	private interval: number;
	private popupThresholds?: number[];

	constructor(endMillis: number) {
		const tick = () => {
			let delta = endMillis - Date.now();
			let newSeconds = Math.ceil(delta / 1000);
			
			if (newSeconds <= 0) {
				newSeconds = 0;
				clearInterval(this.interval);
			}

			for (let i = this.callbacks.length - 1; i >= 0; i--) {
				const { time, callback } = this.callbacks[i];
				if (newSeconds <= time) {
					callback();
					this.callbacks.splice(i, 1);
				}
			}

			this.remainingSecs.set(newSeconds);
		};

		//this.popupThresholds = Countdown.calculatePopupThresholds(endTime);
		this.interval = setInterval(tick, 50);
		Micron.tryDefer(() => clearInterval(this.interval));
		tick();
	}
	private static calculatePopupThresholds(secsLeft: number) {
		secsLeft += 0.5;
		if (secsLeft >= 180) return [10, 30, 60, 120];
		if (secsLeft >= 90) return [10, 30, 60];
		if (secsLeft >= 45) return [10, 30];
		if (secsLeft >= 12) return [10];
		return [];
	}
	static fromEnd(endMillis: number, bufferSecs = 0): Countdown {
		return new Countdown(endMillis - bufferSecs * 1000);
	}
	static fromSecs(remainingSecs: number, bufferSecs = 0): Countdown {
		const endTime = Date.now() + 1000 * (remainingSecs - bufferSecs);
		return new Countdown(endTime);
	}
	/*static fromSecs(secsLeft: number, secsBuffer = 0): Countdown {
		return new Countdown(Countdown.calculateEnd(secsLeft, secsBuffer));
	}*/
	/*static Simple(endTime: number, onFinish?: () => void): Micron.Node {
		const cd = new Countdown(endTime);
		if (onFinish) cd.onFinish(onFinish);
		return cd.View();
	}
	
	static Secs(secsLeft: number, secsBuffer = 0, onFinish?: () => void): Micron.Node {
		const cd = this.fromSecs(secsLeft, secsBuffer);
		if (onFinish) cd.onFinish(onFinish);
		return cd.View();
	}*/
	
	stop() {
		this.remainingSecs.set(-1);
		clearInterval(this.interval);
	}
	withPopups(): Countdown {
		this.popupThresholds = Countdown.calculatePopupThresholds(this.remainingSecs.get());
		return this;
	}
	onThreshold(time: number, callback: () => any): Countdown {
		this.callbacks.push({ time, callback });
		return this;
	}
	onFinish(callback: () => any): Countdown {
		return this.onThreshold(0, callback);
	}

	private getPopupValue(curr: number): number {

		if (this.popupThresholds === undefined || curr <= 0) {
			return NaN;
		}
		if (curr >= 1 && curr <= 3)
			return curr;

		for (const threshold of this.popupThresholds)
			if (curr <= threshold)
				return threshold;

		return NaN;
	}
	private Popup(curr: number) {
		const value = this.getPopupValue(curr);
		const final = value <= 3;
		const key = final ? "final" : value;

		if (isNaN(value)) {
			return h("!");
		} else {
			return h("div.countdown-popup",
				{ key, class: { final } },
				value //`${value}${final ? "!" : ""}`
			);
		}
	}
	View(): Micron.Node {

		/*const popup = s(this.popupSecs, (curr) => {
			if (isNaN(curr)) {
				return h("!");
			} else {
				return h("div.countdown-popup", { key: curr }, curr);
			}
		});*/

		return s(this.remainingSecs, (curr) => {

			if (curr < 0) {
				return h("div.countdown", "");
			} else {
				const color = "black";
				//const color = (curr >= 1 && curr <= 3) ? "red" : "black";
				return h("div.countdown", { style: { color } }, [
					curr.toString(),
					this.Popup(curr)
				]);
			}
		});
	}
}

/*export class Countdown {
	
	private secondsLeft = new State(NaN);
	private callbacks: Array<{ time: number, callback: () => any }> = [];
	private interval: number;
	
	constructor(endTime: number) {
		
		const tick = () => {
			let delta = endTime - Date.now() - 50;
			let newSeconds = Math.ceil(delta/1000);
			
			if (newSeconds <= 0) {
				newSeconds = 0;
				clearInterval(this.interval);
			}
			
			for (let i = this.callbacks.length - 1; i >= 0; i--) {
				const { time, callback } = this.callbacks[i];
				if (newSeconds <= time) {
					callback();
					this.callbacks.splice(i, 1);
				}
			}
			
			this.secondsLeft.set(newSeconds);
		};
		
		this.interval = setInterval(tick, 200);
		tick();
		
		
		Micron.tryDefer(() => clearInterval(this.interval));
	}
	static Simple(endTime: number, onFinish?: () => void): Micron.Node {
		const cd = new Countdown(endTime);
		if (onFinish) cd.onFinish(onFinish);
		return cd.View();
	}
	static Secs(secsLeft: number, secsBuffer = 0, onFinish?: () => void): Micron.Node {
		const cd = this.fromSecs(secsLeft, secsBuffer);
		if (onFinish) cd.onFinish(onFinish);
		return cd.View();
	}
	static fromSecs(secsLeft: number, secsBuffer = 0): Countdown {
		return new Countdown(Countdown.endTime(secsLeft, secsBuffer));
	}
	static endTime(secsLeft: number, secsBuffer = 0): number {
		return Date.now() + 1000 * (secsLeft - secsBuffer);
	}
	
	stop() {
		this.secondsLeft.set(-1);
		clearInterval(this.interval);
	}
	onThreshold(time: number, callback: () => any): Countdown {
		this.callbacks.push({ time, callback });
		return this;
	}
	onFinish(callback: () => any): Countdown {
		return this.onThreshold(0, callback);
	}
	View(): Micron.Node {
		return s(this.secondsLeft, (curr) => {
			if (curr < 0) {
				return h("div.countdown", "0");
			} else {
				const style = curr <= 3 ? { color: "red" } : { color: "black" };
				return h("div.countdown", { style }, curr.toString());
			}
		});
	}
}*/



type AutoscrollOptions = {
	strength: number,
	tickMs: number,
	startMs: number,
	restartMs?: number
};
export class Autoscroll {
	
	interval?: number;
	timeout?: number;
	direction = 1;
	elm?: HTMLElement;
	
	strength: number;
	tickMs: number;
	startMs: number;
	restartMs?: number;
	
	constructor(options: Partial<AutoscrollOptions> = {}) {
		this.strength = options.strength ?? 22.5;
		this.tickMs = options.tickMs ?? 100;
		this.startMs = options.startMs ?? 800;
		this.restartMs = options.restartMs;
		
		Micron.tryDefer(this.clear.bind(this));
	}
	private clear() {
		clearTimeout(this.timeout);
		clearInterval(this.interval);
		this.timeout = this.interval = undefined;
	}
	private running() {
		return this.interval !== undefined;
	}
	private tick() {
		if (!this.elm || !document.contains(this.elm) || this.elm.clientHeight >= this.elm.scrollHeight) {
			this.stop();
			return;
		}
		
		if (this.direction === -1 && this.elm.scrollTop <= 0) {
			this.direction = 1;
			this.restart();
		} else if (this.direction === 1 && this.elm.scrollTop >= this.elm.scrollHeight - this.elm.clientHeight - 2) {
			this.direction = -1;
			this.restart();
		} else {
			this.elm.scrollBy({
				top: this.strength * this.direction,
				behavior: "smooth"
			});
		}
	}
	private next(delayMs = 0) {
		this.clear();
		this.timeout = setTimeout(() => {
			this.interval = setInterval(
				this.tick.bind(this),
				this.tickMs
			);
		}, delayMs);
	}
	private restart() {
		if (this.restartMs !== undefined) {
			this.next(this.restartMs);
		} else {
			this.stop();
		}
	}
	start(elm = this.elm, delayMs = this.startMs) {
		if ((this.elm = elm) === undefined) {
			console.warn("attempted to start Autoscroll without an element");
			return;
		}
		
		//this.direction = 1;
		this.next(delayMs);
	}
	stop() {
		this.clear();
		this.elm?.scrollBy(0, 0);
	}
	toggle(elm = this.elm) {
		if (this.running()) {
			this.stop();
		} else {
			this.start(elm, 0);
		}
	}
	Wrap(sel: string, children: Micron.Children) {
		return h(sel,
			{
				on: {
					wheel: () => this.stop(),
					click: () => this.stop(),
				},
				hook: {
					insert: (vnode) => {
						if (!vnode.elm) return;
						this.start(vnode.elm as any);
					}
				},
			},
			children
		);
	}
}


