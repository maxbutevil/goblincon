

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
	IdlePage,
	VoteButtons
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

const page = projector(Starting);

export function view() {
	
	defer(
		client.use(INC, OUT),
		INC.subscribe("drawing", ({ goblinName, secsLeft }) => {
			page.put(Drawing, secsLeft, goblinName);
		}),
		INC.subscribe("voting", ({ choices, secsLeft }) => {
			page.put(Voting, secsLeft, choices);
		}),
		INC.subscribe("starting", () => page.put(Starting)),
		INC.subscribe("doneDrawing", () => page.put(DoneDrawing)),
		INC.subscribe("doneVoting", () => page.put(DoneVoting)),
		INC.subscribe("showingVotes", () => page.put(ShowingResults)),
		INC.subscribe("showingScores", () => page.put(ShowingResults)),
	);
	
	return h("div#drawblins.mode", s(page));
}

function Starting() {
	return h("div#start.tab", [
		h("h1", "Game Starting!"),
		h("h2", "Get ready to draw!")
	]);
}
function Drawing(secsLeft: number, goblinName: string) {
	
	const drawpad = new Drawpad({
		onSubmit: (drawing: string) => {
			OUT.send("drawingSubmission", { drawing });
		}
	});
	
	return h("div#draw.tab", [
		h("div#info", [
			h("div", "Draw a creature named:"),
			h("div#goblin-name", goblinName),
			Countdown.Secs(secsLeft, 4, () => drawpad.submit()),
		]),
		drawpad.View(),
	]);
}
function Voting(secsLeft: number, choices: string[]) {
	
	const submitVote = (forName: string) => {
		OUT.send("voteSubmission", { forName });
		page.put(DoneVoting);
	};
	
	return h("div#vote.tab", [
		h("h1", "Vote!"),
		Countdown.Secs(secsLeft, 2),
		...VoteButtons(
			choices.filter((choice) => choice !== Session.playerName),
			submitVote
		),
	]);
}
function DoneDrawing() {
	return IdlePage("You've Submitted!", "Waiting for other players to finish drawing...");
}
function DoneVoting() {
	return IdlePage("You've Voted!", "Waiting for other players to vote...");
}
function ShowingResults() {
	return IdlePage("Results", "Results are being revealed now");
}

