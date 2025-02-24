

import {
	Shared,
	Signal, State, Variant, variant,
	Val, ReceiveIndex, SendIndex,
	client,
	h, s, defer, projector,
} from "../modules/index"

import Globals from "./globals"

import {
	Drawpad,
	countdown,
	idlePage,
	voteButtons
} from "../components/index"

//import * as icons from "../assets/icons/index"

const INC = new ReceiveIndex({
	//waiting: Val.choice<"start" | "draw" | "vote" | "results" | "score">("start", "draw", "vote", "results", "score"),
	drawing: { goblinName: Val.STR, secsLeft: Val.NUM },
	voting: { choices: Val.array(Val.STR), secsLeft: Val.NUM },
	
	// idle states
	starting: Val.NONE,
	doneDrawing: Val.NONE,
	doneVoting: Val.NONE,
	showingVotes: Val.NONE,
	showingScores: Val.NONE,
});
const OUT = new SendIndex({
	drawingSubmission: { drawing: Val.STR },
	voteSubmission: { forName: Val.STR },
});

const page = projector(starting);

export function view() {
	
	page.put(starting);
	
	defer(Signal.bundle(
		client.use(INC, OUT),
		INC.subscribe("drawing", ({ goblinName, secsLeft }: { goblinName: string, secsLeft: number }) => {
			page.put(drawing, Shared.endTime(secsLeft, 4), goblinName);
		}),
		INC.subscribe("voting", ({ choices, secsLeft }) => {
			page.put(voting, Shared.endTime(secsLeft, 2), choices);
		}),
		INC.subscribe("starting", () => page.put(starting)),
		INC.subscribe("doneDrawing", () => page.put(doneDrawing)),
		INC.subscribe("doneVoting", () => page.put(doneVoting)),
		INC.subscribe("showingVotes", () => page.put(showingResults)),
		INC.subscribe("showingScores", () => page.put(showingResults)),
	));
	
	return s(page);
}

function starting() {
	return h("div#start.tab", [
		h("h1", "Game Starting!"),
		h("h2", "Get ready to draw!")
	]);
}
function drawing(endTime: number, goblinName: string) {
	
	const drawpad = new Drawpad();
	const onSubmit = (drawing: string) => {
		OUT.send("drawingSubmission", { drawing });
	}
	
	return h("div#draw.tab", [
		h("div", [
			h("div#goblin-name", goblinName),
			countdown(endTime, () => drawpad.submit()),
		]),
		drawpad.view(onSubmit)
	]);
}
function voting(endTime: number, choices: string[]) {
	
	const submitVote = (forName: string) => {
		OUT.send("voteSubmission", { forName });
		page.put(doneVoting);
	};
	
	return h("div#vote.tab", [
		h("h1", "Vote!"),
		countdown(endTime),
		...voteButtons(
			choices.filter((choice) => choice !== Globals.playerName),
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

