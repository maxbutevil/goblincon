
import {
	State,
	h, s, ctx,
	Shared, PlayerIcons,
	VNode, VNodeChildren, VNodeChildElement,
} from "./modules/"

export function Logo() {
	const icons = [];
	for (let i = 0; i < PlayerIcons.count(); i++) {
		icons.push(PlayerIcons.View(i, Shared.playerColor(i)));
	}
	
	return h("div#logo", [
		h("h1", "GoblinCon"),
		h("div#icon-row", icons)
	]);
}

export function IdlePage(header: string, ...subheaders: string[]) {
	return h("div#idle.tab", [
		h("h1", header),
		...subheaders.map((s) => h("h2", s)),
	]);
}

export function VoteButtons(choices: string[], submit: (choice: string) => void): VNode[] {
	return choices.map(choice => {
		return h("button", { on: { click: () => submit(choice) } }, choice);
	});
}

export function IconBtn(iconSrc: string, onClick: () => any, disabled = false): VNode {
	return h("button.icon-btn",
		{
			on: { click: onClick },
			attrs: { disabled }
		},
		h("img", { attrs: { src: iconSrc }})
	);
}

export function Tray(...children: VNodeChildElement[]) {
	return h("div#tray", children);
}

/*export function mountedBtn(iconSrc: string, onClick: () => any): VNode {
	return h("div#mounted-btns", iconBtn(iconSrc, onClick));
}
export function mountedBtns(btnArgs: Array<[string, () => any]>): VNode {
	const btns = btnArgs.map(data => iconBtn(...data));
	return h("div#mounted-btns", btns);
}*/
/*export function endTime(secsLeft: number, secsBuffer: number): number {
	return Date.now() + 1000 * (secsLeft - secsBuffer);
}*/

export class Countdown {
	
	private secondsLeft = new State(NaN);
	private callbacks: Array<{ time: number, callback: () => any }> = [];
	private interval: NodeJS.Timeout;
	
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
		
		ctx()?.defer(() => clearInterval(this.interval));
	}
	static Simple(endTime: number, onFinish?: () => void): VNode {
		const cd = new Countdown(endTime);
		if (onFinish) cd.onFinish(onFinish);
		return cd.View();
	}
	static Secs(secsLeft: number, secsBuffer = 0, onFinish?: () => void): VNode {
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
	View(): VNode {
		return s(this.secondsLeft, (curr) => {
			if (curr < 0) {
				return h("div.countdown", "0");
			} else {
				const style = curr <= 3 ? { color: "red" } : { color: "black" };
				return h("div.countdown", { style }, curr.toString());
			}
		});
	}
	
}



type AutoscrollOptions = {
	strength: number,
	tickMs: number,
	startMs: number,
	restartMs?: number
};
export class Autoscroll {
	
	interval?: NodeJS.Timeout;
	direction = 1;
	elm?: HTMLElement;
	
	strength: number;
	tickMs: number;
	startMs: number;
	restartMs?: number;
	
	constructor(options: Partial<AutoscrollOptions> = {}) {
		this.strength = options.strength ?? 25;
		this.tickMs = options.tickMs ?? 100;
		this.startMs = options.startMs ?? 600;
		this.restartMs = options.restartMs;
		
		ctx()?.defer(() => clearInterval(this.interval));
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
		clearInterval(this.interval);
		setTimeout(() => {
			this.interval = setInterval(
				this.tick.bind(this),
				this.tickMs
			);
		}, delayMs);
	}
	private restart() {
		if (this.restartMs !== undefined) {
			this.next(this.restartMs);
		}
	}
	start(elm: HTMLElement) {
		this.direction = 1;
		this.elm = elm;
		this.next(this.startMs);
	}
	stop() {
		clearInterval(this.interval);
		this.elm?.scrollBy(0, 0);
	}
}


