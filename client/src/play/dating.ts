
import {
	Signal, State, Variant, variant,
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
import {
	idlePage,
	mountedBtn,
	
	img,
	countdown,
	
	voteButtons,
	
	Drawpad
} from "../components/index"

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
	
	defer(Signal.bundle(
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
	));
	
	return s(page);
}
function starting() {
	return h("div#start.tab", [
		h("h1", "Game Starting!"),
		h("h2", "Get ready to draw!")
	]);
}
function drawingBachelor(endTime: number, bachelorTheme: string) {
	
	const drawpad = new Drawpad();
	function onSubmit(drawing: string) {
		OUT.send("bachelorSubmission", { drawing });
	};
	
	return h("div#draw-bachelor.tab", [
		h("div#bachelor-theme", bachelorTheme),
		drawpad.view(onSubmit),
	]);
}
function drawingSuitor(endTime: number, bachelorId: number, bachelorDrawing: string) {
	
	const drawpad = new Drawpad();
	function onSubmit(drawing: string) {
		OUT.send("suitorSubmission", { bachelorId, drawing });
	};
	
	const overlayOpen = new State(true);
	function toggle() {
		overlayOpen.set(!overlayOpen.get());
	};
	
	return h("div#draw-suitor.tab", [
		h("h2", "Draw a suitor for your bachelor(ette)"),
		countdown(endTime, () => drawpad.submit()),
		drawpad.view(onSubmit),
		//h("button", { on: { click: toggle } }, "See Bachelor"),
		s(overlayOpen, curr => {
			if (!curr) {
				return h("!");
			} else {
				return h("div.overlay", [
					h("div#help-popup.popup.vflow.vsplit", [
						img(bachelorDrawing)
					])
				]);
			}
		}),
		mountedBtn(showBachelorIcon, toggle)
	]);
}
function voting(endTime: number, choices: string[]) {
	
	function submitVote(forName: string) {
		OUT.send("voteSubmission", { forName });
		page.put(doneVoting);
	}
	
	return h("div.tab", [
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




