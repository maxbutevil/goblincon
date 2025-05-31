//import "./styles/.scss"
import "../play/play.scss"
//import "./host/host.scss"
//import { exit as exitIcon } from "./assets/icons/"



import "../assets/icons"




import {
	Signal, State,
	h, s, c,
	projector, defer, Node, mount,
	Micron,
} from "../modules"

import * as icons from "../assets/icons"
import * as assets from "../assets/testing"
import * as PlayerIcon from "../modules/player_icons"

import { Player } from "../host/data";

import { Countdown, Tray, IconBtn } from "../components"
import Drawpad from "../play/drawpad"
import { Submission, SubmissionGrid } from "../host/components";
import { NameOverlay } from "../play/components"

function drawingTest() {
	const drawpad = new Drawpad({
		onSubmit: (drawing) => {}
	});
	return h("div.tab", drawpad.View());
}

const testSubmission = {
	drawing: assets.testDrawing,
	name: "Test Submission"
};
const testSubmissions = [
	{ drawing: assets.sadSack, name: "Sad Blob" },
	{ drawing: assets.licensedTherapist, name: "Licensed Therapist" },
	{ drawing: assets.topHatEnthusiast, name: "Top Hat Enthusiast" },
];

//mount(drawingTest());

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

/*function counter() {
	const state = new State(0);
	setInterval(() => state.mutate(curr => curr + 1), 1000);
	defer(() => console.log("no more mee"));
	return s(state, curr => h("div", curr));
}*/

/*class Stack {
	
	protected readonly update = new Signal();
	nodes: Node[] = [];
	
	constructor() {
		
	}
	
	push(node: Node) {
		this.nodes.push(node);
		this.update.emit();
	}
	pop() {
		this.nodes.pop();
		this.update.emit();
	}
	view() {
		return s(this.update, () => h("div", this.nodes.slice()));
	}
}*/

function mappings() {
	
	const state = new State(0);
	const components = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(i => {
		
		const shard = state.map(j => j % i === 0);
		
		return s(shard, (curr, from) => {
			console.log(curr, from);
			return h("div", `Divisible by ${i}: ${curr ? "Yes!" : "No"}`);
		});
	});
	
	function increment() {
		state.mutate(curr => curr + 1);
	}
	//Micron.interval(1000, increment);
	
	
	
	return h("div", { on: { click: increment } }, [
		s(state, curr => h("div", `i=${curr}`)),
		...components
	]);
	
	//return s(state, (curr) => h("div#root", children.slice(0, curr)));
	//return h("div", { on: { click: () => stack.pop() } }, stack.view());
}
/*
function evil() {
	
	function component(i: number) {
		const counter = new State(0);
		setInterval(() => counter.mutate(curr => curr + 1), 500);
		function click() {
			components.splice(components.indexOf(vnode), 1);
			signal.emit();
		}
		
		return s(counter, curr => {
			return h("div", { on: { click } }, curr)
		});
	}
	
	const signal = new Signal();
	const components: Micron.Node[] = [];
	setInterval(() => {
		components.push(component(components.length));
		signal.emit();
		//console.log(components.length);
	}, 1000);
	
	
	return s(signal, () => h("div#ok",
		{ on: { click: () => {
			components.pop();
			signal.emit();
		} } },
		components.slice()
	));
}
*/
function DrawingTest() {
	const drawpad = new Drawpad({
		onSubmit: (drawing) => {}
	});
	
	
	return h("div#drawblins.mode", [
		h("div#draw.tab", [
			h("div#info", [
				h("div", "Draw a creature named:"),
				h("div#goblin-name", "Omnom Sr."),
				//Countdown.Secs(secsLeft, 4, () => drawpad.submit()),
			]),
			drawpad.View(),
		])
	]);
	
	
	return h("div.tab", drawpad.View());
}
function DrawingSuitorTest() {
	
	const reset = new Signal();
	
	const naming = true;
	const secsLeft = 180;
	const bachelorSubmission = testSubmissions[0];
	
	function Inner() {
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
				//const submission = { drawing, name: nameOverlay?.name };
				//OUT.send("suitorSubmission", { bachelorId, submission });
				overlay.set(null);
				//reset.emit();
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
			Tray([
				IconBtn(icons.bachelor, () => overlay.toggle(Bachelor, null)),
				c(nameOverlay && IconBtn(icons.name, () => overlay.toggle(Name, null)))
			]),
			//mountedBtn(showBachelorIcon, toggle)
		]);
	}
	
	return s(reset, Inner);
}

function DrawingBachelorTest(secsLeft: number, naming: boolean, bachelorTheme: string) {
	
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
			//OUT.send("bachelorSubmission", { submission });
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


//mount(DrawingTest());
//mount(DrawingBachelorTest(30, true, "Sad"));
/*mount(
	stateful(state, (curr) => {
		if (curr === 0) {
			return cleaned(
				() => console.log("cleaning up!"),
				() => stateful(state, () => h("div#root.a", String(state.get())))
			);
		} else {
			return stateful(
				state,
				() => h("div#root.b", String(state.get()))
			)
		}
	})
);*/

/*mount(
	stateful(
		state,
		
	)
);*/

/*mount(
	stateful(
		state,
		() => stateful(
			state,
			() => h("div#root.b", String(state.get()))
		)
	)
);*/



//state.set(1);
//state.set(2);
