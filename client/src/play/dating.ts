
import {
	Signal, State,
	Val, ReceiveIndex, SendIndex,
	//Shared,
	client,// Connection,
	h, s, c, defer, projector,
	Shared
} from "../modules/"
import { Submission, SUBMISSION } from "../modules/submission"

//import Globals from "./globals"

import * as icons from "../assets/icons"

import Drawpad from "./drawpad"
import {
	Countdown,
	
	tray,
	iconBtn,
	voteButtons,
	idlePage,
} from "../components"
import { NameOverlay } from "./components"

const INC = new ReceiveIndex({
	//gameStarted: Val.NONE,
	
	/* state synchronization */
	"drawingBachelor": { secsLeft: Val.NUM, naming: Val.BOOL, theme: Val.STR },
	"drawingSuitor": { secsLeft: Val.NUM, naming: Val.BOOL, bachelorId: Val.NUM, bachelorSubmission: SUBMISSION },
	"voting": { secsLeft: Val.NUM, choices: Val.array(Val.STR) },
	
	/* idle states */
	"showingVotes": Val.NONE,
	"showingScores": Val.NONE,
	"doneDrawingBachelor": Val.NONE,
	"doneDrawingSuitor": Val.NONE,
	"doneVoting": Val.NONE,
	"notVoting": Val.NONE,
});
const OUT = new SendIndex({
	"bachelorSubmission": { submission: SUBMISSION },
	"suitorSubmission": { submission: SUBMISSION, bachelorId: Val.NUM },
	"voteSubmission": { forName: Val.STR },
});

const page = projector(starting);

export function view() {
	
	defer(
		client.use(INC, OUT),
		INC.subscribe("drawingBachelor", ({ secsLeft, naming, theme }) => {
			page.put(drawingBachelor, secsLeft, naming, theme);
		}),
		INC.subscribe("drawingSuitor", ({ secsLeft, naming, bachelorId, bachelorSubmission }) => {
			page.put(drawingSuitor, secsLeft, naming, bachelorId, bachelorSubmission)
		}),
		INC.subscribe("voting", ({ secsLeft, choices }) => {
			page.put(voting, secsLeft, choices);
		}),
		INC.subscribe("showingVotes", () => page.put(showingResults)),
		INC.subscribe("showingScores", () => page.put(showingResults)),
		INC.subscribe("doneDrawingBachelor", () => page.put(doneDrawing)),
		INC.subscribe("doneDrawingSuitor", () => page.put(doneDrawing)),
		INC.subscribe("doneVoting", () => page.put(doneVoting)),
		INC.subscribe("notVoting", () => page.put(notVoting))
	);
	
	return h("div#dating.mode", s(page));
}
function starting() {
	return h("div#start.tab", [
		h("h1", "Game Starting!"),
		h("h2", "Get ready to draw!")
	]);
}
function drawingBachelor(secsLeft: number, naming: boolean, bachelorTheme: string) {
	
	const overlay = new State<null | typeof nameView>(null);
	const nameOverlay = c(naming && new NameOverlay({
		onClose: () => overlay.set(null)
	}));
	
	defer(Signal.keydown.subscribe((ev) => {
		if (ev.key === "Escape") overlay.set(null);
	}));
	
	
	const drawpad = new Drawpad({
		onSubmit: (drawing) => {
			const submission = { drawing, name: nameOverlay?.name };
			OUT.send("bachelorSubmission", { submission });
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
	
	function nameView() {
		return nameOverlay!.view(drawpad.isSubmitted());
	}
	
	return h("div#draw-bachelor.tab", [
		h("div#info", [
			h("div#bachelor-theme", `Theme: ${bachelorTheme}`),
			countdown.view()
		]),
		drawpad.view(),
		s(overlay, curr => (!curr) ? h("!") : curr()),
		c(nameOverlay && tray(
			iconBtn(icons.name, () => overlay.toggle(nameView, null))
		))
	]);
}
function drawingSuitor(secsLeft: number, naming: boolean, bachelorId: number, bachelorSubmission: Submission) {
	
	//let name: string | undefined = undefined; // undefined = never opened name overlay
	
	const overlay = new State<null | typeof bachelorView>(bachelorView);
	const nameOverlay = c(naming && new NameOverlay({
		onClose: () => overlay.set(null)
	}));
	defer(Signal.keydown.subscribe((ev) => {
		if (ev.key === "Escape") overlay.set(null);
	}));
	
	
	//const nameOverlayView = nameOverlay?.view.bind(nameOverlay);
	const drawpad = new Drawpad({
		onSubmit: (drawing) => {
			const submission = { drawing, name: nameOverlay?.name };
			OUT.send("suitorSubmission", { bachelorId, submission });
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
		return h("div#overlay-shadow", [
			h("div#bachelor-popup", [
				h("div", [
					h("div", [
						h("h2", "Your Bachelor(ette)"),
						h("div",
							{ style: { fontSize: "0.86em" } },
							"Use this as inspiration for your suitor drawing!"
						),
					]),
					h("div#bachelor-ctr", [
						c(bachelorSubmission.name && h("div#bachelor-name",
							{ style: { fontSize: "1.1em" } },
							bachelorSubmission.name
						)),
						h("img", { attrs: { src: bachelorSubmission.drawing }}),
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
function voting(secsLeft: number, choices: string[]) {
	
	function submitVote(forName: string) {
		OUT.send("voteSubmission", { forName });
		page.put(doneVoting);
	}
	
	return h("div#voting.tab", [
		h("h1", "Voting!"),
		h("div", "Vote for your favorite suitor!"),
		Countdown.secs(secsLeft, 2),
		...voteButtons(choices, submitVote)
	]);
}

function showingResults() {
	return idlePage("Results", "Results are being revealed now");
}

function doneDrawing() {
	return idlePage("You've Submitted!", "Waiting for other players to finish drawing...");
}
function doneVoting() {
	return idlePage("You've Voted!", "Waiting for other players to do the same...");
}
function notVoting() {
	return idlePage("Waiting...", "Waiting for other players to vote...");
}




