
import {
	Signal, State,
	Val, ReceiveIndex, SendIndex,
	//Shared,
	client,// Connection,
	h, s, c, Micron,
	Shared
} from "../modules/"
import { SubmissionData, SUBMISSION_DATA } from "../modules/data"

//import Globals from "./globals"

import * as icons from "../assets/icons"

import Drawpad from "./drawpad"
import Session from "./session"
import {
	Countdown,
	VoteButtons,
	Nav,
	TopBar,
	BottomBar,
	IdlePage,
} from "../components"
import {
	NameOverlay,
} from "./components"
import { legsLord } from "../assets/testing"

const INC = new ReceiveIndex({
	//gameStarted: Val.NONE,
	
	/* state synchronization */
	"drawingBachelor": { endMillis: Val.NUM, naming: Val.BOOL, theme: Val.STR },
	"drawingSuitor": { endMillis: Val.NUM, naming: Val.BOOL, bachelorId: Val.NUM, bachelorSubmission: SUBMISSION_DATA },
	"voting": { endMillis: Val.NUM, choices: Val.array(Val.STR) },
	
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

const page = Micron.projector(Starting);
//const overlay = projector();

export function view() {
	
	Micron.defer(
		client.use(INC, OUT),
		INC.subscribe("drawingBachelor", ({ endMillis, naming, theme }) => {
			page.put(DrawingBachelor, endMillis, naming, theme);
		}),
		INC.subscribe("drawingSuitor", ({ endMillis, naming, bachelorId, bachelorSubmission }) => {
			page.put(DrawingSuitor, endMillis, naming, bachelorId, bachelorSubmission)
		}),
		INC.subscribe("voting", ({ endMillis, choices }) => {
			page.put(Voting, endMillis, choices);
		}),
		INC.subscribe("showingVotes", () => page.put(ShowingResults)),
		INC.subscribe("showingScores", () => page.put(ShowingResults)),
		INC.subscribe("doneDrawingBachelor", () => page.put(DoneDrawing)),
		INC.subscribe("doneDrawingSuitor", () => page.put(DoneDrawing)),
		INC.subscribe("doneVoting", () => page.put(DoneVoting)),
		INC.subscribe("notVoting", () => page.put(NotVoting))
	);
	
	return h("div#dating.scaffold", s(page));
}
export const test = Micron.test("dating")
	.add(Starting)
	.add(() => DrawingBachelor(Date.now() + 30 * 1000, true, "Test Theme"))
	.add(() => DrawingSuitor(Date.now() + 30 * 1000, true, 1, { name: "LegsLegsLegsLegsLegsLegsLegsLegsLegsLegsLegsLegsLegsLegsLegsLegsLegsLegsLegsLegs", drawing: legsLord }))
	.add(DoneDrawing)
	.add(Voting, 20, ["player0", "player1"])
	.add(NotVoting)
	.add(ShowingResults)


function Starting() {
	return IdlePage("Game Starting", "Get ready to draw!");
}
function DrawingBachelor(endMillis: number, naming: boolean, bachelorTheme: string) {
	
	//const overlay = Micron.anchor();
	const nav = new Nav();
	const nameOverlay = (!naming) ? null : new NameOverlay({
		onClose: () => nav.clear()
	});
	
	Micron.defer(Signal.documentEvent("keydown").subscribe((ev) => {
		if (ev.key === "Escape") nav.clear()
	}));
	
	const drawpad = new Drawpad({
		key: `bachelor-${Session.joinCode}`,
		onSubmit: (drawing) => {
			const submission = { drawing, name: nameOverlay?.name };
			OUT.send("bachelorSubmission", { submission });
		},
		onStartSubmit: () => {
			if (nameOverlay && nameOverlay.name === undefined) {
				nav.put(Name)
				return false;
			}
			return true;
		}
	});
	
	function Name() {
		return nameOverlay!.View(drawpad.isSubmitted());
	}
	function Help() {
		return h("div#overlay",
			h("div#help-popup", [
				h("h2", "Help: Bachelor Drawing"),
				h("div", "Use this time to draw your bachelor!"),
				h("div", "The theme is here for inspiration! Don't worry too much about following it."),
				(
					!nameOverlay ?
						h("div", "Keep an eye on the timer at the bottom!") :
						h("div", "Don't forget to name your creature, and keep an eye on the timer at the bottom!")
				),
				h("button",
					{ on: { click: () => nav.clear() } },
					"Done"
				)
			])
		)
	}
	
	return h("div#draw-bachelor.scaffold", [
		/*TopBar({
			middle: h("div.title", "Draw a Bachelor!"),
		}),*/
		h("div.primary-flow", [
			h("div#drawpad-ctr.flow", [
				h("div#info", [
					h("div#bachelor-theme", [
						h("b", "Draw a bachelor! Theme: "),
						bachelorTheme
					]),
				]),
				drawpad.View(),
				
			]),
			s(nav)
		]),
		BottomBar({
			middle: (
				Countdown.fromEnd(endMillis, Shared.DRAWING_BUFFER_SECS)
					.withPopups()
					.onFinish(() => drawpad.submit())
					.onThreshold(20, () => {
						if (nameOverlay && !nameOverlay.name && !drawpad.isSubmitted()) {
							nav.put(Name);
						}
					})
					.View()
			),
			left: c(nameOverlay && nav.IconBtn(icons.name, Name)),
			right: nav.IconBtn(icons.help, Help)
		}),
	]);
	
	/*return h("div#draw-bachelor.flow", [
		h("div#drawpad-ctr.flow.mount", [
			h("div#info", [
				h("div#bachelor-theme", `Theme: ${bachelorTheme}`),
				countdown.View()
			]),
			drawpad.View(),
		]),
		s(overlay),
		c(nameOverlay && Tray(
			IconBtn(icons.name, () => overlay.toggle(NameView))
		))
	]);*/
}
function DrawingSuitor(endMillis: number, naming: boolean, bachelorId: number, bachelorSubmission: SubmissionData) {
	
	//let name: string | undefined = undefined; // undefined = never opened name overlay
	
	
	const nav = Nav.create(Bachelor);
	//const overlay = new State<null | typeof Bachelor>(Bachelor);
	const nameOverlay = (!naming) ? null : new NameOverlay({
		onClose: () => nav.clear()
	});
	
	
	Micron.defer(
		Signal.documentEvent("keydown").subscribe((ev) => {
			if (ev.key === "Escape") nav.clear()
		})
	);
	
	//const nameOverlayView = nameOverlay?.view.bind(nameOverlay);
	const drawpad = new Drawpad({
		key: `suitor-${Session.joinCode}-${bachelorId}`,
		onSubmit: (drawing) => {
			const submission = { drawing, name: nameOverlay?.name };
			OUT.send("suitorSubmission", { bachelorId, submission });
			nav.clear();
		},
		onStartSubmit: () => {
			if (nameOverlay && nameOverlay.name === undefined) {
				nav.put(Name);
				return false;
			}
			return true;
		}
	});
	
	Micron.defer(
		Signal.documentEvent("keydown").subscribe((ev) => {
			if (ev.key === "Escape")
				nav.clear();
		})
	);
	
	function Name() {
		return nameOverlay!.View(drawpad.isSubmitted());
	}
	function Bachelor() {
		return h("div#overlay", [
			h("div#bachelor-popup", [
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
					h("img#bachelor-img", {
						attrs: {
							src: bachelorSubmission.drawing,
							width: Shared.SUBMISSION_SIZE,
							height: Shared.SUBMISSION_SIZE
						}
					}),
				]),
				h("button",
					{ on: { click: () => nav.clear() } },
					"Start Drawing!"
				)
			]),
			
		]);
	}
	function Help() {
		return h("div#overlay",
			h("div#help-popup", [
				h("h2", "Help: Suitor Drawing"),
				h("div", "Use this time to draw your suitor!"),
				h("div", [
					"You have been given another player's bachelor drawing as inspiration. ",
					"Draw something that pairs well with it!",
				]),
				//h("div.example", []),
				h("div", [
					h("b", "Note: "),
					"You do ",
					h("em", "not "),
					"need to follow the bachelor theme. Draw whatever you like!"
				]),
				h("button",
					{ on: { click: () => nav.clear() } },
					"Done"
				)
				//h("div", "Use it to ")
			])
		)
	}
	//const countdown = new Countdown();
	
	return h("div#draw-suitor.scaffold", [
		/*TopBar({
			middle: h("div.title", "Draw a Suitor!")
		}),*/
		/*h("div.primary-flow", [
			h("div#drawpad-ctr.flow", [
				drawpad.View()
			]),
			s(nav)
		]),*/
		
		h("div.primary-flow", [
			h("div#drawpad-ctr.flow", [
				h("div#info", [
					h("b", [
						"Draw a suitor for your ",
						h("a#bachelor-shortcut",
							{ on: { click: (ev) => nav.put(Bachelor) } },
							"bachelor"
						),
						"."
					]),
					//h("div#goblin-name", goblinName),
				]),
				drawpad.View(),
			]),
			s(nav)
		]),
		
		
		BottomBar({
			middle: (
				Countdown.fromEnd(endMillis, Shared.DRAWING_BUFFER_SECS)
					.withPopups()
					.onFinish(() => drawpad.submit())
					.onThreshold(20, () => {
						if (nameOverlay && !nameOverlay.name && !drawpad.isSubmitted()) {
							nav.put(Name);
						}
					})
					.View()
			),
			left: [
				//nav.IconBtn(icons.name, Micron.builder.EMPTY),
				c(nameOverlay && nav.IconBtn(icons.name, Name)),
				nav.IconBtn(icons.bachelor, Bachelor)
			],
			right: [
				nav.IconBtn(icons.help, Help)
			]
		}),
	])
	/*return h("div#draw-suitor.page", [
		h("div#info", [
			h("div", "Draw a suitor for your bachelor(ette)"),
			countdown.View()
		]),
		drawpad.View(),
		//h("button", { on: { click: toggle } }, "See Bachelor"),
		s(overlay, curr => (!curr) ? h("!") : curr()),
		//s(overlayOpen, curr => curr ? overlay() : h("!")),
		Tray([
			IconBtn(icons.bachelor, () => overlay.toggle(Bachelor, null)),
			nameOverlay && IconBtn(icons.name, () => overlay.toggle(Name, null))
		]),
		//mountedBtn(showBachelorIcon, toggle)
	]);*/
}
function Voting(endMillis: number, choices: string[]) {
	
	function submitVote(forName: string) {
		OUT.send("voteSubmission", { forName });
		page.put(DoneVoting);
	}
	
	return h("div#voting.scaffold", [
		/*TopBar({
			middle: h("div.title", "Voting")
		}),*/
		h("div.primary-page", [
			h("div.flow.gapped", [
				h("h2", "Voting"),
				h("div", "Vote for your favorite suitor for the bachelor (at the top)!"),
				...VoteButtons(choices, submitVote)
			]),
		]),
		BottomBar({
			middle: (
				Countdown.fromEnd(endMillis, Shared.VOTING_BUFFER_SECS)
					.withPopups()
					.View()
			),
		}),
	]);
}


function ShowingResults() {
	return IdlePage("Results", "Results are being revealed now");
}
function DoneDrawing() {
	return IdlePage("You've Submitted", "Waiting for other players to finish drawing...");
}
function DoneVoting() {
	return IdlePage("You've Voted", "Waiting for other players to do the same...");
}
function NotVoting() {
	return IdlePage("Waiting", "Other players are voting on your suitor!");
}




