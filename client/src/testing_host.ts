//import "./styles/.scss"
import "./host/host.scss"
//import "./host/host.scss"
//import { exit as exitIcon } from "./assets/icons/"
import "./assets/icons"

import {
	Micron,
	Signal, State,
	h, s, c,
	projector, cleanup, defer, VNode, mount
} from "./modules"

import * as icons from "./assets/icons"
import * as assets from "./assets/misc"
import * as PlayerIcon from "./modules/player_icons"

import { Player } from "./host/room";

import { Countdown, tray, iconBtn, Autoscroll } from "./components"
import Drawpad from "./play/drawpad"
import { submission, submissionGrid, ReadyDisplay } from "./host/components";
//import { NameOverlay } from "./play/components"
//import { Matchup }

//const testMatchup = new Matchup();



const testPlayer = new Player(0, "freak #1", 0);
const testPlayer2 = new Player(1, "freak #2", 1);
//const testPlayers = [testPlayer, testPlayer2];

const testPlayers: Player[] = [];
for (let i = 0; i < 16; i++) {
	testPlayers.push(new Player(i, `freak #${i}`, i % 7));
}

const testSubmission = {
	drawing: assets.testDrawing,
	name: "Test Submission"
};
//const testName = "Mr. Griddles";
const testClose = () => console.log("close");

//const testPage = projector(matchupReviewTest);
const testPage = projector(submissionGridTest);

function matchupSummary() {
	return h("div.matchup", [
		submission(testPlayer, testSubmission),
		h("img", { attrs: { src: icons.heart }}),
		submission(testPlayer, testSubmission),
		h("img", { attrs: { src: icons.heartbreak }}),
		submission(testPlayer, testSubmission),
	]);
}
function matchupSummaryTwo() {
	return h("div.matchup", [
		h("div.spacer"),
		submission(testPlayer, testSubmission),
		h("img", { attrs: { src: icons.heart }}),
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


function matchupReview() {
	
	const autoscroll = new Autoscroll({
		strength: 25,
		startMs: 600,
		restartMs: 1200
	});
	
	return h("div#recap",
		{
			on: {
				wheel: () => autoscroll.stop(),
				click: () => autoscroll.stop(),
			},
			hook: {
				insert: () => {
					const elm = document.getElementById("dating-recap-popup");
					if (elm) autoscroll.start(elm);
				}
			},
		},
		[
			h("h1", "Recap"),
			h("div.round", [
				h("h2", "Round One: Abcde"),
				matchupSummary(),
				matchupSummaryTwo(),
			]),
			h("div.round", [
				h("h2", "Round Two: Abcde"),
				matchupSummaryThree(),
				matchupSummary(),
			])
			//readyDisplay.view()
		]
	);
}
function matchupReviewTest() {
	
	return h("div#overlay", [
		h("div#dating-recap-popup.popup", [
			matchupReview(),
			h("button", "Close")
		])
	]);
	
	return matchupReview();
}

function submissionGridTest() {
	
	const count = new State(1);
	const readyDisplay = new ReadyDisplay(testPlayers, 205, 2);
	for (let i = 0; i < 16; i++) {
		//readyDisplay.ready(i);
	}
	//readyDisplay.ready(0);
	
	return s(count, curr => {
		const submissions = [];
		for (let i = 0; i < curr; i++) {
			submissions.push(submission(testPlayer, testSubmission, {
				votes: testPlayers
			}));
		}
		return h(
			"div.tab",
			{ on: { click: () => {
				readyDisplay.ready(count.get() - 1);
				count.mutate(curr => curr + 1);
				
				readyDisplay.stopCountdown();
			} } },
			[
				h("div", `Vote for your favorite ${"goblinName"}!`),
				submissionGrid(submissions),
				readyDisplay.view()
			]
		);
	});
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


