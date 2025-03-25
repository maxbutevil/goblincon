

import {
	Shared,
	Val, ReceiveIndex, SendIndex,
	client,
	h, s, defer, projector,
} from "../modules/"

import Session from "./session"

import Drawpad from "./drawpad"
import {
	Countdown,
	idlePage,
	voteButtons
} from "../components"

//import * as icons from "../assets/icons/"

const INC = new ReceiveIndex({
	//waiting: Val.choice<"start" | "draw" | "vote" | "results" | "score">("start", "draw", "vote", "results", "score"),
	"drawing": { goblinName: Val.STR, secsLeft: Val.NUM },
	"voting": { choices: Val.array(Val.STR), secsLeft: Val.NUM },
	
	// idle states
	"starting": Val.NONE,
	"doneDrawing": Val.NONE,
	"doneVoting": Val.NONE,
	"showingVotes": Val.NONE,
	"showingScores": Val.NONE,
});
const OUT = new SendIndex({
	"drawingSubmission": { drawing: Val.STR },
	"voteSubmission": { forName: Val.STR },
});

const page = projector(starting);

export function view() {
	
	defer(
		client.use(INC, OUT),
		INC.subscribe("drawing", ({ goblinName, secsLeft }) => {
			page.put(drawing, secsLeft, goblinName);
		}),
		INC.subscribe("voting", ({ choices, secsLeft }) => {
			page.put(voting, secsLeft, choices);
		}),
		INC.subscribe("starting", () => page.put(starting)),
		INC.subscribe("doneDrawing", () => page.put(doneDrawing)),
		INC.subscribe("doneVoting", () => page.put(doneVoting)),
		INC.subscribe("showingVotes", () => page.put(showingResults)),
		INC.subscribe("showingScores", () => page.put(showingResults)),
	);
	
	return h("div#drawblins.mode", s(page));
}

function starting() {
	return h("div#start.tab", [
		h("h1", "Game Starting!"),
		h("h2", "Get ready to draw!")
	]);
}
function drawing(secsLeft: number, goblinName: string) {
	
	const drawpad = new Drawpad({
		onSubmit: (drawing: string) => {
			OUT.send("drawingSubmission", { drawing });
		}
	});
	
	return h("div#draw.tab", [
		h("div#info", [
			h("div", "Draw a creature named:"),
			h("div#goblin-name", goblinName),
			Countdown.secs(secsLeft, 4, () => drawpad.submit()),
		]),
		drawpad.view(),
		
	]);
}
function voting(secsLeft: number, choices: string[]) {
	
	const submitVote = (forName: string) => {
		OUT.send("voteSubmission", { forName });
		page.put(doneVoting);
	};
	
	return h("div#vote.tab", [
		h("h1", "Vote!"),
		Countdown.secs(secsLeft, 2),
		...voteButtons(
			choices.filter((choice) => choice !== Session.playerName),
			submitVote
		),
	]);
}
function doneDrawing() {
	return idlePage("You've Submitted!", "Waiting for other players to finish drawing...");
}
function doneVoting() {
	return idlePage("You've Voted!", "Waiting for other players to vote...");
}
function showingResults() {
	return idlePage("Results", "Results are being revealed now");
}

