import "./shared.css"
import State from './modules/state'
import { h, patchRoot, s, cleanup, defer, cleaned, VNode } from './modules/render';
import Signal from "./modules/signal"

import * as icons from "./assets/icons/index"
import * as PlayerIcon from "./modules/player_icons"

let c = false;
const state = new State(0);
const signal = new Signal();

/*patchRoot(
	signaled(t2, () => {
		return signaled(t1, () => {
			//return h("div", String(state.get()));
			if (state.get() === 1) {
				return cleaned(
					() => console.log("cleaning up!"),
					() => stateful(state, () => h("div.a", String(state.get())))
				);
			} else {
				return stateful(
					state,
					() => h("p.b", String(state.get()))
				)
				//return h("p.b", String(state.get()));
			}
		})
	})
);*/

patchRoot(
	s(state, (curr) => {
		return s(signal, () => {
			
			/*return cleaned(
				() => console.log("splendid!"),
				() => h("div", String(state.get()))
			);*/
			
			if (curr === 0) {
				defer(() => console.log("splendid!"));
				//cleanup(() => console.log("splendid!"))
			}
			
			return h("div", String(state.get()));
			
			/*if (curr == 1) {
				return cleaned(
					() => console.log("cleaning up!"),
					() => h("div.a", String(state.get()))
				);
			} else {
				return h("div.a", String(state.get()));
			}*/
		});
	})
);

/*patchRoot(
	stateful(state, (curr) => {
		if (state.get() === 1) {
			return cleaned(
				() => console.log("cleaning up!"),
				() => stateful(state, () => h("div.a", String(state.get())))
			);
		} else {
			return stateful(
				state,
				() => h("p.b", String(state.get()))
			)
			//return h("p.b", String(state.get()));
		}
	})
);*/

setInterval(() => {
	
	if (c) {
		console.log(state.get());
		state.set(1 - state.get())
	} else {
		signal.emit();
		signal.emit();
		signal.emit();
	}
	
	c = !c;
}, 2000);


/*patchRoot(
	stateful(state, (curr) => {
		if (curr === 0) {
			return cleaned(
				() => console.log("cleaning up!"),
				() => stateful(state, () => h("div#root.a", String(state.get())))
			);
		} else {
			return stateful(
				state,
				() => h("div#root.b", String(state.get()))
			)
		}
	})
);*/

/*patchRoot(
	stateful(
		state,
		
	)
);*/

/*patchRoot(
	stateful(
		state,
		() => stateful(
			state,
			() => h("div#root.b", String(state.get()))
		)
	)
);*/



//state.set(1);
//state.set(2);

/*const count = new State([1, 1]);

function submission(): VNode {
	
	const playerName = "joe";
	const drawing = icons.erase;
	
	return h(
		"div.submission",
		[
			h("img", { attrs: { src: drawing }}),
			h("div.player-name", playerName),
			//signaled(),
			h("div.vote-ctr")
		]
	);
}



patchRoot(
	h(
		"div",
		[
			PlayerIcon.view(2, "red"),
			"Ok"
		]
	)
);*/

/*window.addEventListener("DOMContentLoaded", () => {
	
	patchRoot(
		h(
			"div.tab",
			[
				h("div", `Vote for your favorite Burger!`),
				stateful(count, (curr) => {
					
					let [submissionCount, _rowCount] = curr;
					
					let aspectRatio = window.innerWidth / window.innerHeight;
					let rowWidth = submissionCount;
					let rowCount = 1;
					if (submissionCount >= aspectRatio * 2.4) {
						for (let i = 2; i < submissionCount; i++) {
							rowCount = i;
							rowWidth = Math.ceil(submissionCount/i);
							if ((rowWidth / i) <= aspectRatio * 1.2) {
								break;
							}
						}
					}
					
					let rows: VNode[][] = [];
					for (let i = 0; i < rowCount; i++) {
						rows.push([]);
					}
					
					//let submissions: (VNode | null)[] = [];
					for (let i = 0; i < submissionCount; i++) {
						let row = Math.floor(i/rowWidth);
						rows[row].push(submission());
					}
					
					let selector = rowCount <= 1 ? "div.submission-ctr.single-row" : "div.submission-ctr";
					
					return h(
						selector,
						rows.map(row => h("div.submission-row", row))
					);
				})
			]
		)
	);
	
});
window.addEventListener("mousedown", ev => {
	let curr = count.get();
	if (ev.button === 0)
		count.set([curr[0] + 1, curr[1]]);
	else
		count.set([curr[0], curr[1] + 1]);
});*/


