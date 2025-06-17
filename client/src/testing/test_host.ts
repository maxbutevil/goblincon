//import "./styles/.scss"
import "../host/host.scss"
//import "./host/host.scss"
//import { exit as exitIcon } from "./assets/icons/"
import "../assets/icons"

import {
	Micron,
	Signal, State,
	h, s, c,
	projector, defer, Node, mount,
	playerIcons
} from "../modules"

import * as icons from "../assets/icons"
import * as assets from "../assets/testing"
import * as PlayerIcon from "../modules/player_icons"

import { Player } from "../host/data";

import { Submission, SubmissionGrid, ReadyDisplay } from "../host/components";
//import { NameOverlay } from "./play/components"
//import { Matchup }

//const testMatchup = new Matchup();

import { test } from "../host/host"

//import { VoteQueue } from "../host/components"
//(new VoteQueue()).start([[0, 1, 2, 3], [4, 5, 6, 7]])


function SubmissionGridTest() {
	
	const testPlayers: Player[] = [
		Player.mock(0),
		Player.mock(1),
		Player.mock(2)
	];
	const testPlayer = testPlayers[0];
	const testSubmission = {
		drawing: assets.legsLord,
		//name: "Legs Lord"
	};

	const count = new State(1);
	const readyDisplay = new ReadyDisplay(testPlayers.slice(0, 3), 2);
	
	return s(count, curr => {
		const submissions = [];
		for (let i = 0; i < curr; i++) {
			submissions.push(Submission(testPlayer, testSubmission, {
				votes: testPlayers
			}));
		}
		return h("div.page",
			{
				on: {
					click: () => {
						//readyDisplay.ready(count.get() - 1);
						count.mutate(curr => curr + 1);

						readyDisplay.stopCountdown();
					}
				}
			},
			[
				h("div", `Vote for your favorite ${"goblinName"}!`),
				SubmissionGrid(submissions),
				readyDisplay.View()
			]
		);
	});
}

test.nest(
	Micron.test("misc")
		.add(SubmissionGridTest)
);
Micron.mount(s(test));

/*function MatchupSummary() {
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
}*/



/*function DatingVoteTest() {
	
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
	
	
	//const src = playerIcons.generateBackground();
	
	
	return h("div", [
		//{ style: { scale: "5" } },
		Logo(),
		//h("img", { attrs: { src } })
	]);
}*/
//mount(h("div#dating.mode", DatingVoteTest()));
//mount(SubmissionGridTest());



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
