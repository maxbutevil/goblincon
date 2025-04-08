//import "./styles/.scss"
import "./host/host.scss"
//import "./host/host.scss"
//import { exit as exitIcon } from "./assets/icons/"
import "./assets/icons"

import {
	Signal, State,
	h, s, c,
	projector, cleanup, defer, VNode, mount,
	Micron,
} from "./modules"

import * as icons from "./assets/icons"
import * as assets from "./assets/misc"
import * as PlayerIcon from "./modules/player_icons"

import { Player } from "./host/room";

import { Countdown, tray, iconBtn } from "./components"
import Drawpad from "./play/drawpad"
import { submission, submissionGrid } from "./host/components";
import { NameOverlay } from "./play/components"
//import { Matchup }

//const testMatchup = new Matchup();



const testPlayer = new Player(0, "test freak man", 0);
const testSubmission = {
	drawing: assets.testDrawing,
	name: "Ok Buddy"
};
//const testName = "Mr. Griddles";
const testClose = () => console.log("close");

const testPage = projector(matchupReviewTest);


function matchupSummary() {
	
	return h("div.matchup", [
		submission(testPlayer, testSubmission),
		h("img", { attrs: { src: icons.vs }}),
		submission(testPlayer, testSubmission),
		h("img", { attrs: { src: icons.vs }}),
		submission(testPlayer, testSubmission),
	]);
}
function matchupSummaryTwo() {
	return h("div.matchup", [
		h("div.spacer"),
		submission(testPlayer, testSubmission),
		h("img", { attrs: { src: icons.vs }}),
		submission(testPlayer, testSubmission),
		h("div.spacer"),
	]);
}
function matchupSummaryThree() {
	return h("div.matchup", [
		h("div.spacer"),
		h("div.spacer"),
		submission(testPlayer, testSubmission),
		h("div.spacer"),
		h("div.spacer"),
	]);
}
function matchupReview({ close }: { close: () => void }) {
	
	let scroll = 1;
	let elm: HTMLDivElement | undefined;
	let interval: NodeJS.Timeout;
	const scrollStrength = 25;
	const scrollDelayMs = 100;
	const startDelayMs = 1600;
	
	//let interval = interval();
	defer(Signal.keydown.subscribe((ev) => {
		if (ev.key === "Escape") {
			close();
		}
	}));
	
	function stopScroll() {
		scroll = 0;
		elm?.scrollBy(0, 0);
	}
	return h("div#recap",
		{
			on: {
				wheel: stopScroll,
				click: stopScroll,
			},
			hook: {
				insert: (vnode) => {
					elm = vnode.elm as HTMLDivElement;
					if (elm.clientHeight >= elm.scrollHeight) {
						return;
					}
					function startNextScroll() {
						clearInterval(interval);
						setTimeout(() => {
							interval = setInterval(() => {
								if (!elm || !document.contains(elm) || scroll === 0) {
									clearInterval(interval);
									return;
								}
								//console.log(elm.scrollTop, elm.scrollHeight, elm.clientHeight);
								if (scroll === -1 && elm.scrollTop <= 0) {
									scroll = 1;
									startNextScroll();
								} else if (scroll === 1 && elm.scrollTop >= elm.scrollHeight - elm.clientHeight - 2) {
									scroll = -1;
									startNextScroll();
								} else {
									elm?.scrollBy({
										top: scroll * scrollStrength,
										behavior: "smooth"
									});
								}
							}, scrollDelayMs);
						}, startDelayMs);
					}
					startNextScroll();
				}
			},
		},
		[
			h("div#matchups", [
				h("h2", "Round One: Abcde"),
				matchupSummary(),
				matchupSummaryTwo(),
				h("h2", "Round Two: Abcde"),
				matchupSummaryThree(),
				matchupSummary(),
			]),
			h("button",
				{ on: { click: close } },
				"Close" 
			)
		]
	);
	
	//return review;
	
	//return h("div#overlay", review);
}
function matchupReviewTest() {
	return matchupReview({
		close: testClose,
		
	});
}

function submissionGridTest() {
	
	const count = new State(1);
	const player = new Player(0, "test", 0);
	
	return h(
		"div.mode",
		{ on: { click: () => count.set(count.get() + 1) } },
		s(count, (curr) => {
			
			const submissions = [];
			for (let i = 0; i < curr; i++) {
				submissions.push(submission(player, testSubmission));
			}
			
			return submissionGrid(submissions);
		})
	);
}

function datingVoteTest() {
	
	let bachelorDrawing = submission(testPlayer, testSubmission);
	let suitorDrawings = [
		submission(testPlayer, testSubmission),
		submission(testPlayer, testSubmission)
	];
	
	if (suitorDrawings.length === 2) {
		suitorDrawings = [
			suitorDrawings[0],
			h("img#vs-icon", { attrs: { src: icons.vs } }),
			suitorDrawings[1]
		]
	}
	
	return h("div#voting.tab", [
		h("div.submission-ctr", [
			h("div.submission-row", bachelorDrawing),
			h("div.submission-row", suitorDrawings)
		])
	]);
}

function oldDrawingSuitorTest() {
	
	const secsLeft = 20;
	const bachelorDrawing = testSubmission;
	
	const overlayOpen = new State(true);
	function toggle() {
		overlayOpen.mutate(curr => !curr);
	};
	function overlay() {
		return h("div#overlay",/* { on: { click: toggle } }, */ [
			h("div#bachelor-popup.popup", [
				h("div.vflow", [
					h("div", [
						h("h2", "Your Bachelor(ette)"),
						h("div", "Use this as inspiration for your suitor drawing!"),
					]),
					h("div.bachelor-ctr", [
						h("img", { attrs: { src: bachelorDrawing.drawing }}),
					])
				]),
				h("button", { on: { click: toggle } }, "Start Drawing!")
			])
		]);
	}
	
	const drawpad = new Drawpad({
		onSubmit: (drawing) => {
			//OUT.send("suitorSubmission", { bachelorId, drawing, name: undefined });
		}
	});
	const countdown = Countdown.fromSecs(secsLeft);
	countdown.onThreshold(10, () => console.log("abcde"));
	countdown.onFinish(() => console.log("hello world"));
	
	return h("div#draw-suitor.tab", [
		h("div#info", [
			h("div", "Draw a suitor for your bachelor(ette)"),
			countdown.view(),
			//Countdown.secs(secsLeft, 4, () => drawpad.submit()),
		]),
		drawpad.view(),
		//h("button", { on: { click: toggle } }, "See Bachelor"),
		s(overlayOpen, curr => curr ? overlay() : h("!")),
		tray(iconBtn(icons.bachelor, toggle))
	]);
}
function drawingSuitorTest() {
	
	const secsLeft = 25;
	const bachelorDrawing = testSubmission.drawing;
	const naming: boolean = true;
	
	const overlay = new State<null | typeof bachelorView>(bachelorView);
	const nameOverlay = c<NameOverlay>(naming && new NameOverlay({
		onClose: () => overlay.set(null)
	}));
	//const nameOverlayView = nameOverlay?.view.bind(nameOverlay);
	const drawpad = new Drawpad({
		onSubmit: (drawing) => {
			//OUT.send("suitorSubmission", { bachelorId, drawing, name: nameOverlay?.name });
			overlay.set(null);
		},
		onStartSubmit: () => {
			if (nameOverlay && nameOverlay.name === undefined) {
				overlay.set(nameView);
				return false;
			}
			return true;
		}
	});
	const countdown = Countdown.fromSecs(secsLeft, 4);
	countdown.onFinish(() => drawpad.submit());
	countdown.onThreshold(15, () => {
		if (nameOverlay && nameOverlay.name === undefined) {
			overlay.set(nameView);
		}
	});
	
	defer(Signal.keydown.subscribe((ev) => {
		if (ev.key === "Escape") overlay.set(null);
	}));
	
	function nameView() {
		return nameOverlay!.view(drawpad.isSubmitted());
	}
	function bachelorView() {
		return h("div#overlay", [
			h("div#bachelor-popup", [
				h("div.vflow", [
					h("div.vflow", [
						h("h2", "Your Bachelor(ette)"),
						h("div",
							{ style: { fontSize: "0.86em" } },
							"Use this as inspiration for your suitor drawing!"
						),
					]),
					h("div#bachelor-ctr", [
						h("div#bachelor-name",
							{ style: { fontSize: "1.1em" } },
							"abcde"
						),
						h("img", { attrs: { src: bachelorDrawing }}),
					]),
				]),
				h("button",
					{ on: { click: () => overlay.set(null) } },
					"Start Drawing!"
				)
			])
		]);
	}
	//const countdown = new Countdown();
	return h("div#draw-suitor.tab", [
		h("div#info", [
			h("div", "Draw a suitor for your bachelor(ette)"),
			countdown.view()
		]),
		drawpad.view(),
		//h("button", { on: { click: toggle } }, "See Bachelor"),
		s(overlay, curr => (!curr) ? h("!") : curr()),
		//s(overlayOpen, curr => curr ? overlay() : h("!")),
		tray(
			iconBtn(icons.bachelor, () => overlay.toggle(bachelorView, null)),
			c(nameOverlay && iconBtn(icons.name, () => overlay.toggle(nameView, null)))
		),
		//mountedBtn(showBachelorIcon, toggle)
	]);
}

function drawingTest() {
	const drawpad = new Drawpad({
		onSubmit: (drawing) => {}
	});
	return h("div.tab", drawpad.view());
}

mount(h("div#dating.mode", s(testPage)));




/*mount(
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


/*mount(
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


/*mount(
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

/*mount(
	stateful(
		state,
		
	)
);*/

/*mount(
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



mount(
	h(
		"div",
		[
			PlayerIcon.view(2, "red"),
			"Ok"
		]
	)
);*/

/*window.addEventListener("DOMContentLoaded", () => {
	
	mount(
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


