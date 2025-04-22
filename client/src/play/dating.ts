
import {
	Signal, State,
	Val, ReceiveIndex, SendIndex,
	//Shared,
	client,// Connection,
	h, s, c, defer, projector,
	Shared
} from "../modules/"
import { SubmissionData, SUBMISSION_DATA } from "../modules/submission_data"

//import Globals from "./globals"

import * as icons from "../assets/icons"

import Drawpad from "./drawpad"
import {
	Countdown,
	
	Tray,
	IconBtn,
	VoteButtons,
	IdlePage,
} from "../components"
import { NameOverlay } from "./components"

const INC = new ReceiveIndex({
	//gameStarted: Val.NONE,
	
	/* state synchronization */
	"drawingBachelor": { secsLeft: Val.NUM, naming: Val.BOOL, theme: Val.STR },
	"drawingSuitor": { secsLeft: Val.NUM, naming: Val.BOOL, bachelorId: Val.NUM, bachelorSubmission: SUBMISSION_DATA },
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
	"bachelorSubmission": { submission: SUBMISSION_DATA },
	"suitorSubmission": { submission: SUBMISSION_DATA, bachelorId: Val.NUM },
	"voteSubmission": { forName: Val.STR },
});

const page = projector(Starting);

export function view() {
	
	defer(
		client.use(INC, OUT),
		INC.subscribe("drawingBachelor", ({ secsLeft, naming, theme }) => {
			page.put(DrawingBachelor, secsLeft, naming, theme);
		}),
		INC.subscribe("drawingSuitor", ({ secsLeft, naming, bachelorId, bachelorSubmission }) => {
			page.put(DrawingSuitor, secsLeft, naming, bachelorId, bachelorSubmission)
		}),
		INC.subscribe("voting", ({ secsLeft, choices }) => {
			page.put(Voting, secsLeft, choices);
		}),
		INC.subscribe("showingVotes", () => page.put(ShowingResults)),
		INC.subscribe("showingScores", () => page.put(ShowingResults)),
		INC.subscribe("doneDrawingBachelor", () => page.put(DoneDrawing)),
		INC.subscribe("doneDrawingSuitor", () => page.put(DoneDrawing)),
		INC.subscribe("doneVoting", () => page.put(DoneVoting)),
		INC.subscribe("notVoting", () => page.put(NotVoting))
	);
	
	return h("div#dating.mode", s(page));
}
function Starting() {
	return h("div#start.tab", [
		h("h1", "Game Starting!"),
		h("h2", "Get ready to draw!")
	]);
}
function DrawingBachelor(secsLeft: number, naming: boolean, bachelorTheme: string) {
	
	const overlay = new State<null | typeof NameView>(null);
	const nameOverlay = (!naming) ? null : new NameOverlay({
		onClose: () => overlay.set(null)
	});
	
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
				overlay.set(NameView);
				return false;
			}
			return true;
		}
	});
	const countdown = Countdown.fromSecs(secsLeft, 4);
	countdown.onFinish(() => drawpad.submit());
	countdown.onThreshold(15, () => {
		if (nameOverlay && !nameOverlay.name) {
			overlay.set(NameView);
		}
	});
	
	function NameView() {
		return nameOverlay!.View(drawpad.isSubmitted());
	}
	
	return h("div#draw-bachelor.tab", [
		h("div#info", [
			h("div#bachelor-theme", `Theme: ${bachelorTheme}`),
			countdown.View()
		]),
		drawpad.View(),
		s(overlay, curr => (!curr) ? h("!") : curr()),
		c(nameOverlay && Tray(
			IconBtn(icons.name, () => overlay.toggle(NameView, null))
		))
	]);
}
function DrawingSuitor(secsLeft: number, naming: boolean, bachelorId: number, bachelorSubmission: SubmissionData) {
	
	//let name: string | undefined = undefined; // undefined = never opened name overlay
	
	const overlay = new State<null | typeof Bachelor>(Bachelor);
	const nameOverlay = (!naming) ? null : new NameOverlay({
		onClose: () => overlay.set(null)
	})
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
				overlay.set(Name);
				return false;
			}
			return true;
		}
	});
	const countdown = Countdown.fromSecs(secsLeft, 4);
	countdown.onFinish(() => drawpad.submit());
	countdown.onThreshold(15, () => {
		if (nameOverlay && !nameOverlay.name) {
			overlay.set(Name);
		}
	});
	
	defer(Signal.keydown.subscribe((ev) => {
		if (ev.key === "Escape") overlay.set(null);
	}));
	
	function Name() {
		return nameOverlay!.View(drawpad.isSubmitted());
	}
	function Bachelor() {
		return h("div#overlay", [
			h("div#bachelor-popup.popup", [
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
			countdown.View()
		]),
		drawpad.View(),
		//h("button", { on: { click: toggle } }, "See Bachelor"),
		s(overlay, curr => (!curr) ? h("!") : curr()),
		//s(overlayOpen, curr => curr ? overlay() : h("!")),
		Tray(
			IconBtn(icons.bachelor, () => overlay.toggle(Bachelor, null)),
			c(nameOverlay && IconBtn(icons.name, () => overlay.toggle(Name, null)))
		),
		//mountedBtn(showBachelorIcon, toggle)
	]);
}
function Voting(secsLeft: number, choices: string[]) {
	
	function submitVote(forName: string) {
		OUT.send("voteSubmission", { forName });
		page.put(DoneVoting);
	}
	
	return h("div#voting.tab", [
		h("h1", "Voting!"),
		h("div", "Vote for your favorite suitor!"),
		Countdown.Secs(secsLeft, 2),
		...VoteButtons(choices, submitVote)
	]);
}

function ShowingResults() {
	return IdlePage("Results", "Results are being revealed now");
}

function DoneDrawing() {
	return IdlePage("You've Submitted!", "Waiting for other players to finish drawing...");
}
function DoneVoting() {
	return IdlePage("You've Voted!", "Waiting for other players to do the same...");
}
function NotVoting() {
	return IdlePage("Waiting...", "Waiting for other players to vote...");
}




