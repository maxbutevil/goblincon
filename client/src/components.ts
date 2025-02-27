
import {
	State,
	h, s, defer,
	Shared, PlayerIcons,
	VNodeChildren
} from "./modules/index"

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

export function countdown(endTime: number, onFinish?: () => void) {
	
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
}

export function idlePage(header: string, ...subheaders: string[]) {
	return h("div#idle.tab", [
		h("h1", header),
		...subheaders.map((s) => h("h2", s)),
	]);
}
export function img(src: string) {
	return h("img", { attrs: { src }});
}

export function voteButtons(choices: string[], submit: (choice: string) => void) {
	return choices.map(choice => {
		return h("button", { on: { click: () => submit(choice) } }, choice);
	});
}

function iconBtn(iconSrc: string, onClick: () => any) {
	return h("button",
		{ on: { click: onClick } },
		h("img", { attrs: { src: iconSrc }})
	);
}
export function mountedBtn(iconSrc: string, onClick: () => any) {
	return h("div.mounted-btn-vflow", iconBtn(iconSrc, onClick));
}
export function mountedBtnFlow(btnArgs: Array<[string, () => any]>) {
	const btns = btnArgs.map(data => iconBtn(...data));
	return h("div.mounted-btn-vflow", btns);
}



