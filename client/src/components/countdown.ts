

import State from "../modules/state"
import { h, stateful, cleaned } from "../modules/render"


export default function countdown(endTime: number, onFinish?: () => void) {
	
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
	
	return cleaned(
		() => clearInterval(interval),
		() => stateful(secondsLeft, (curr) => {
			const style = curr <= 3 ? { color: "red" } : { color: "black" };
			return h("div.countdown", { style }, curr.toString());
		})
	);
}