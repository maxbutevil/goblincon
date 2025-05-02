//import "./styles/.scss"
import "../host/host.scss"
//import "./host/host.scss"
//import { exit as exitIcon } from "./assets/icons/"
import "../assets/icons"

import {
	Micron,
	Signal, State,
	h, s, c,
	projector, defer, VNode, mount,
	PlayerIcons
} from "../modules"

import * as icons from "../assets/icons"
import * as assets from "../assets/testing"
import * as PlayerIcon from "../modules/player_icons"

import { Player } from "../host/room";

import { Countdown, Tray, IconBtn, Autoscroll, Logo } from "../components"
import Drawpad from "../play/drawpad"
import { Submission, SubmissionGrid, ReadyDisplay } from "../host/components";
//import { NameOverlay } from "./play/components"
//import { Matchup }

//const testMatchup = new Matchup();



const testPlayer = new Player(0, "freak #1", 0);
const testPlayer2 = new Player(1, "freak #2", 1);
//const testPlayers = [testPlayer, testPlayer2];

const testPlayers: Player[] = [];
for (let i = 0; i < 4; i++) {
	testPlayers.push(new Player(i, `player #${i+1}`, i % 7));
}

const testSubmission = {
	drawing: assets.testDrawing,
	name: "Test Submission"
};
//const testName = "Mr. Griddles";
const testClose = () => console.log("close");

function MatchupSummary() {
	return h("div.matchup", [
		Submission(testPlayer, testSubmission),
		h("img", { attrs: { src: icons.heart }}),
		Submission(testPlayer, testSubmission),
		h("img", { attrs: { src: icons.heartbreak }}),
		Submission(testPlayer, testSubmission),
	]);
}
function MatchupSummaryTwo() {
	return h("div.matchup", [
		h("div.spacer"),
		Submission(testPlayer, testSubmission),
		h("img", { attrs: { src: icons.heart }}),
		Submission(testPlayer, testSubmission),
		h("div.spacer"),
	]);
}
function MatchupSummaryThree() {
	return h("div.matchup", [
		h("div.spacer"),
		h("div.spacer"),
		Submission(testPlayer, testSubmission),
		h("div.spacer"),
		h("div.spacer"),
	]);
}


function MatchupReview() {
	
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
				MatchupSummary(),
				MatchupSummaryTwo(),
			]),
			h("div.round", [
				h("h2", "Round Two: Abcde"),
				MatchupSummaryThree(),
				MatchupSummary(),
			])
			//readyDisplay.view()
		]
	);
}
function MatchupReviewTest() {
	
	return h("div#overlay", [
		h("div#dating-recap-popup.popup", [
			MatchupReview(),
			h("button", "Close")
		])
	]);
	
	return MatchupReview();
}

function SubmissionGridTest() {
	
	
	
	const count = new State(1);
	const readyDisplay = new ReadyDisplay(testPlayers.slice(0, 3), 2);
	readyDisplay.stopCountdown();
	for (let i = 0; i < 3; i++) {
		readyDisplay.ready(i);
	}
	
	const submissions = [
		
	];
	//readyDisplay.ready(0);
	
	return s(count, curr => {
		const submissions = [
			Submission(testPlayers[0], { drawing: assets.legsLord }),
			Submission(testPlayers[1], { drawing: assets.bd }, {
				
				votes: [testPlayers[0], testPlayers[2]]
			}),
			Submission(testPlayers[2], { drawing: assets.bd2 }, {
				votes: [testPlayers[1]]
			}),
		];
		for (let i = 0; i < curr; i++) {
			/*submissions.push(Submission(testPlayer, testSubmission, {
				votes: testPlayers
			}));*/
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
				SubmissionGrid(submissions),
				readyDisplay.View()
			]
		);
	});
}

function DatingVoteTest() {
	
	const readyDisplay = new ReadyDisplay(testPlayers.slice(0, 3));
	readyDisplay.ready(0);
	readyDisplay.ready(2);
	
	const testSubmissions = [
		{ drawing: assets.sadSack, name: "Sad Blob" },
		{ drawing: assets.licensedTherapist, name: "Licensed Therapist" },
		{ drawing: assets.topHatEnthusiast, name: "Top Hat Enthusiast" },
	];
	
	let bachelorDrawing = Submission(testPlayers[0], testSubmissions[0]);
	let suitorDrawings = [
		Submission(testPlayers[1], testSubmissions[1]),
		Submission(testPlayers[2], testSubmissions[2], {
			//votes: [testPlayers[0]]
		})
	];
	
	if (suitorDrawings.length === 2) {
		suitorDrawings = [
			suitorDrawings[0],
			h("img#vs-icon", { attrs: { src: icons.vs } }),
			suitorDrawings[1]
		]
	}
	
	return h("div#voting.mode", [
		h("div.submission-ctr", [
			h("div.submission-row", bachelorDrawing),
			h("div.submission-row", suitorDrawings)
		]),
		//readyDisplay.View()
	]);
}


function PlayerIconTest() {
	
	
	//const src = PlayerIcons.generateBackground();
	
	
	return h("div", [
		//{ style: { scale: "5" } },
		Logo(),
		//h("img", { attrs: { src } })
	]);
}
//mount(h("div#dating.mode", DatingVoteTest()));
mount(SubmissionGridTest());



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

function Submission(): VNode {
	
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
						rows[row].push(Submission());
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


