
import {
	State,
	h, s, defer,
	Shared, PlayerIcons,
	VNode, VNodeChildren, VNodeChildElement
} from "./modules/"

export function logo() {
	return h("div#logo", [
		h("h1", "GoblinCon"),
		h(
			"div#icon-row",
			([0, 1, 2, 3, 4, 5, 6]).map(i =>
				PlayerIcons.view(i, Shared.PLAYER_COLORS[i]))
		)
	]);
}

/*export function countdown(endTime: number, onFinish?: () => void) {
	
	let secondsLeft = new State<number>(NaN);
	let interval: NodeJS.Timeout | undefined;
	
	const tick = () => {
		let delta = endTime - Date.now() - 50;
		let newSeconds = Math.ceil(delta/1000);
		
		if (newSeconds <= 0) {
			secondsLeft.set(0);
			clearInterval(interval);
			
			if (onFinish)
				onFinish();
		}
		else {
			secondsLeft.set(newSeconds);
		}
	};
	
	interval = setInterval(tick, 200);
	tick();
	
	defer(() => clearInterval(interval));
	return s(secondsLeft, (curr) => {
		const style = curr <= 3 ? { color: "red" } : { color: "black" };
		return h("div.countdown", { style }, curr.toString());
	});
}*/

export function idlePage(header: string, ...subheaders: string[]) {
	return h("div#idle.tab", [
		h("h1", header),
		...subheaders.map((s) => h("h2", s)),
	]);
}
/*export function img(src: string): VNode {
	return h("img", { attrs: { src }});
}*/

export function voteButtons(choices: string[], submit: (choice: string) => void): VNode[] {
	return choices.map(choice => {
		return h("button", { on: { click: () => submit(choice) } }, choice);
	});
}

export function iconBtn(iconSrc: string, onClick: () => any, disabled = false): VNode {
	return h("button.icon-btn",
		{
			on: { click: onClick },
			attrs: { disabled }
		},
		h("img", { attrs: { src: iconSrc }})
	);
}

export function tray(...children: VNodeChildElement[]) {
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
	}
	static simple(endTime: number, onFinish?: () => void): VNode {
		const cd = new Countdown(endTime);
		if (onFinish) cd.onFinish(onFinish);
		return cd.view();
	}
	static secs(secsLeft: number, secsBuffer = 0, onFinish?: () => void): VNode {
		const cd = this.fromSecs(secsLeft, secsBuffer);
		if (onFinish) cd.onFinish(onFinish);
		return cd.view();
	}
	static fromSecs(secsLeft: number, secsBuffer = 0): Countdown {
		return new Countdown(Date.now() + 1000 * (secsLeft - secsBuffer));
	}
	
	view(): VNode {
		defer(() => clearInterval(this.interval));
		return s(this.secondsLeft, (curr) => {
			const style = curr <= 3 ? { color: "red" } : { color: "black" };
			return h("div.countdown", { style }, curr.toString());
		});
	}
	onThreshold(time: number, callback: () => any): Countdown {
		this.callbacks.push({ time, callback });
		return this;
	}
	onFinish(callback: () => any): Countdown {
		return this.onThreshold(0, callback);
	}
}


