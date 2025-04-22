//import "./styles/.scss"
import "../play/play.scss"
//import "./host/host.scss"
//import { exit as exitIcon } from "./assets/icons/"
import "../assets/icons"

import {
	Signal, State,
	h, s, c,
	projector, defer, VNode, mount,
	Micron,
} from "../modules"

import * as icons from "../assets/icons"
import * as assets from "../assets/misc"
import * as PlayerIcon from "../modules/player_icons"

import { Player } from "../host/room";

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
	nodes: VNode[] = [];
	
	constructor() {
		
	}
	
	push(node: VNode) {
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
		
		const shard = state.mapping(j => j % i === 0);
		
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

function evil() {
	
	function component(i: number) {
		const counter = new State(0);
		setInterval(() => counter.mutate(curr => curr + 1), 500);
		function click() {
			components.splice(components.indexOf(vnode), 1);
			signal.emit();
		}
		
		const vnode = s(counter, curr => {
			return h("div", { on: { click } }, curr)
		});
		
		return vnode;
	}
	
	const signal = new Signal();
	const components: VNode[] = [];
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

mount(evil());


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
