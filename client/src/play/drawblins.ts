

import {
	Shared,
	Val, ReceiveIndex, SendIndex,
	client,
	h, s, Micron
} from "../modules/"

import Session from "./session"

import Drawpad from "./drawpad"
import {
	Countdown,
	VoteButtons,
	Nav,
	BottomBar,
	IdlePage,
} from "../components"

import * as icons from "../assets/icons/"

const INC = new ReceiveIndex({
	//waiting: Val.choice<"start" | "draw" | "vote" | "results" | "score">("start", "draw", "vote", "results", "score"),
	"drawing": { goblinName: Val.STR, endMillis: Val.NUM },
	"voting": { choices: Val.array(Val.STR), endMillis: Val.NUM },
	
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

const page = Micron.projector(Starting);

export function view() {
	
	Micron.defer(
		client.use(INC, OUT),
		INC.subscribe("drawing", ({ goblinName, endMillis }) => {
			page.put(Drawing, endMillis, goblinName);
		}),
		INC.subscribe("voting", ({ choices, endMillis }) => {
			page.put(Voting, endMillis, choices);
		}),
		INC.subscribe("starting", () => page.put(Starting)),
		INC.subscribe("doneDrawing", () => page.put(DoneDrawing)),
		INC.subscribe("doneVoting", () => page.put(DoneVoting)),
		INC.subscribe("showingVotes", () => page.put(ShowingResults)),
		INC.subscribe("showingScores", () => page.put(ShowingResults)),
	);
	
	return h("div#drawblins.scaffold", s(page));
}
export const test = Micron.test("drawblins")
	.add(Starting)
	.add(() => Drawing(Date.now() + 30 * 1000, "Test Goblin Name"))
	.add(DoneDrawing)
	.add(Voting, 15, ["player0", "player1", "player2"])
	.add(DoneVoting)
	.add(ShowingResults);

function Starting() {
	return IdlePage("Game Starting", "Get ready to draw!");
}
function Drawing(endMillis: number, goblinName: string) {
	
	const nav = new Nav();
	const drawpad = new Drawpad({
		key: `drawblins-${Session.joinCode}-${goblinName}`,
		onSubmit: (drawing: string) => {
			OUT.send("drawingSubmission", { drawing });
		}
	});
	
	function Help() {
		return h("div#overlay",
			h("div#help-popup", [
				h("h2", "Help: Drawing"),
				h("div", "Use this time to draw a creature!"),
				h("div", "Draw a creature inspired by the generated name"),
				h("div", "Keep an eye on the timer at the bottom!"),
				h("button",
					{ on: { click: () => nav.clear() } },
					"Done"
				)
			])
		)
	}
	
	return h("div#draw.scaffold", [
		/*TopBar({
			middle: h("div.title", "Draw!"),
		}),*/
		h("div.primary-flow", [
			h("div#drawpad-ctr.flow", [
				h("div#info", [
					h("b", "Draw a creature named:"),
					h("div#goblin-name", goblinName),
				]),
				drawpad.View(),
			]),
			s(nav)
		]),
		BottomBar({
			middle: (
				Countdown.fromEnd(endMillis, Shared.DRAWING_BUFFER_SECS)
					.onFinish(() => drawpad.submit())
					.withPopups()
					.View()
			),
			right: nav.IconBtn(icons.help, Help)
		}),
	]);
}
function Voting(endMillis: number, choices: string[]) {
	
	const filtered = choices.filter((choice) => choice !== Session.playerName);
	const submitVote = (forName: string) => {
		OUT.send("voteSubmission", { forName });
		page.put(DoneVoting);
	};
	
	return h("div#vote.scaffold", [
		h("div.primary-page.gapped", [
			h("h2", "Voting!"),
			h("div", "Vote for your favorite submission!"),
			...VoteButtons(filtered, submitVote),
		]),
		BottomBar({
			middle: (
				Countdown.fromEnd(endMillis, Shared.VOTING_BUFFER_SECS)
					.withPopups()
					.View()
			)
		}),
	]);
}
function DoneDrawing() {
	return IdlePage("You've Submitted", "Waiting for other players to finish drawing...");
}
function DoneVoting() {
	return IdlePage("You've Voted", "Waiting for other players to vote...");
}
function ShowingResults() {
	return IdlePage("Results", "Results are being revealed now");
}

