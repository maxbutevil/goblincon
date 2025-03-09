
import {
	State,
	Val, ReceiveIndex, SendIndex,
	//Shared,
	client,// Connection,
	h, s, defer, projector,
	Shared
} from "../modules/index"

//import Globals from "./globals"

import {
	showBachelor as showBachelorIcon
} from "../assets/icons"

import Drawpad from "./drawpad"
import {
	idlePage,
	mountedBtn,
	
	countdown,
	
	voteButtons
} from "../components"


const INC = new ReceiveIndex({
	//gameStarted: Val.NONE,
	
	/* state synchronization */
	drawingBachelor: { secsLeft: Val.NUM, theme: Val.STR },
	drawingSuitor: { secsLeft: Val.NUM, bachelorId: Val.NUM, bachelorDrawing: Val.STR },
	voting: { secsLeft: Val.NUM, choices: Val.array(Val.STR) },
	
	/* idle states */
	showingVotes: Val.NONE,
	showingScores: Val.NONE,
	doneDrawingBachelor: Val.NONE,
	doneDrawingSuitor: Val.NONE,
	doneVoting: Val.NONE,
});
const OUT = new SendIndex({
	bachelorSubmission: { drawing: Val.STR },
	suitorSubmission: { drawing: Val.STR, bachelorId: Val.NUM },
	voteSubmission: { forName: Val.STR },
});

const page = projector(starting);

export function view() {
	
	defer(
		client.use(INC, OUT),
		INC.subscribe("drawingBachelor", ({ secsLeft, theme }) => {
			page.put(drawingBachelor, Shared.endTime(secsLeft, 4), theme);
		}),
		INC.subscribe("drawingSuitor", ({ secsLeft, bachelorId, bachelorDrawing }) => {
			page.put(drawingSuitor, Shared.endTime(secsLeft, 4), bachelorId, bachelorDrawing)
		}),
		INC.subscribe("voting", ({ secsLeft, choices }) => {
			page.put(voting, Shared.endTime(secsLeft, 2), choices);
		}),
		INC.subscribe("showingVotes", () => page.put(showingResults)),
		INC.subscribe("showingScores", () => page.put(showingResults)),
		INC.subscribe("doneDrawingBachelor", () => page.put(doneDrawing)),
		INC.subscribe("doneDrawingSuitor", () => page.put(doneDrawing)),
		INC.subscribe("doneVoting", () => page.put(doneVoting)),
	);
	
	return h("div#dating.mode", s(page));
}
function starting() {
	return h("div#start.tab", [
		h("h1", "Game Starting!"),
		h("h2", "Get ready to draw!")
	]);
}
function drawingBachelor(endTime: number, bachelorTheme: string) {
	
	const drawpad = new Drawpad();
	
	return h("div#draw-bachelor.tab", [
		h("div#info", [
			h("div#bachelor-theme", `Theme: ${bachelorTheme}`),
			countdown(endTime, () => drawpad.submit()),
		]),
		drawpad.view((drawing) => {
			OUT.send("bachelorSubmission", { drawing });
		}),
	]);
}
function drawingSuitor(endTime: number, bachelorId: number, bachelorDrawing: string) {
	
	const overlayOpen = new State(true);
	function toggle() {
		overlayOpen.set(!overlayOpen.get());
	};
	function overlay() {
		return h("div#overlay-shadow",/* { on: { click: toggle } }, */ [
			h("div#bachelor-popup.popup.vflow", [
				h("div.vflow", [
					h("div", [
						h("h2", "Your Bachelor(ette)"),
						h("div", "Use this as inspiration for your suitor drawing!"),
					]),
					h("div.bachelor-ctr", [
						h("img", { attrs: { src: bachelorDrawing }}),
					])
				]),
				h("button", { on: { click: toggle } }, "Start Drawing!")
			])
		]);
	}
	
	const drawpad = new Drawpad();
	//const countdown = new Countdown();
	
	return h("div#draw-suitor.tab", [
		h("div#info", [
			h("div", "Draw a suitor for your bachelor(ette)"),
			countdown(endTime, () => drawpad.submit()),
		]),
		drawpad.view((drawing) => {
			OUT.send("suitorSubmission", { bachelorId, drawing });
		}),
		//h("button", { on: { click: toggle } }, "See Bachelor"),
		s(overlayOpen, curr => curr ? overlay() : h("!")),
		mountedBtn(showBachelorIcon, toggle)
	]);
}
function voting(endTime: number, choices: string[]) {
	
	function submitVote(forName: string) {
		OUT.send("voteSubmission", { forName });
		page.put(doneVoting);
	}
	
	return h("div#voting.tab", [
		h("h1", "Voting!"),
		h("div", "Vote for your favorite suitor!"),
		countdown(endTime),
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
	return idlePage("You've Voted!", "Waiting for other players to vote...");
}




