import './styles.css'
import State from './modules/state'
import { h, patch, patchRoot, stateful, cleaned, VNode } from './modules/render';

let outerState = new State(true);
let innerState = new State(0);

/*function app() {
	return stateful(outerState, (curr) => {
		if (curr) {
			return stateful(innerState, (curr) => {
				return h("div", { key: curr }, `Yep! ${curr}`);
			});
		} else {
			return h("div", `Nope!`);
		}
	});
}*/

let state = new State(0);

function tabs(n: number) {
	let t = "";
	for (let i = 0; i < n; i++)
		t += "_";
	return t;
}
/*function recursiveHell(n = 1): VNode {
	
	if (n >= 5) {
		return h("Bottom");
	}
	
	let state = new State(0);
	let interval = setInterval(() => state.set(state.get() + 1), 1000);
	
	return cleaned(
		() => clearInterval(interval),
		() => stateful(state, (curr) => {
			if (curr % n === 0) {
				return h("div", [
					`${tabs(n)}Yep!`,
					recursiveHell(n + 1),
					recursiveHell(n + 1)
				]);
			} else {
				return h("div", [
					`${tabs(n)}Nope!`
				]);
			}
		})
	);
}*/
function recursiveHell(n = 1): VNode {
	if (n >= 5) {
		return h("div", "____Bottom");
	}
	
	return stateful(state, (curr) => {
		if (curr % n === 0) {
			return h(`div.${curr}`, [
				`${tabs(n-1)}Yep!`,
				recursiveHell(n + 1),
				recursiveHell(n + 1)
			]);
		} else {
			/*return h("div", [
				`${tabs(n-1)}Nope!`
			]);*/
			return recursiveHell(n + 1);
		}
	});
	
}

function hell() {
	return stateful(state, (curr) => {
		let children = [];
		for (let i = 0; i < (2+curr%3); i++) {
			children.push(hell2());
		}
		
		return h("div", children);
	});
}
function hell2() {
	return stateful(state, (curr) => {
		return h(`div.${curr}`, "yeah");
	});
}

function app() {
	return stateful(outerState, (curr) => {
		if (curr) {
			return h("div", stateful(innerState, (curr) => {
				return h("div", { key: curr }, `Yep! ${curr}`);
			}));
		} else {
			return h("div", `Nope!`);
		}
	});
}

let classState = new State("ayy");

function minimal() {
	return stateful(
		classState,
		(curr) => h("div", [
			h("div"),
			stateful(state,
				(state) => h(`div.${curr}`, state)
			),
			h("div"),
		])
	);
}

window.addEventListener("DOMContentLoaded", () => {
	
	/*state.changed.listen(([from, to]) => {
		if (to % 2 == 1)
			state.set(to + 1);
	});*/
	
	/*setTimeout(() => {
		state.set(2);
		setTimeout(() => {
			state.set(4);
		}, 1000);
	}, 1000);*/
	
	/*patchRoot(recursiveHell());
	setInterval(() => {
		state.set(state.get() + 1);
		//state.set(state.get() + 1);
	}, 2000);*/
	
	/*state.changed.listen(() => {
		classState.set(classState.get() + "1");
	});*/
	state.changed.listen(() => {
		classState.set(classState.get() + "1");
	});
	
	/*classState.changed.listen(() => {
		state.set(state.get() + 1);
	});*/
	
	patchRoot(minimal());
	setInterval(() => { 
		state.set(state.get() + 1);
		//classState.set(classState.get() + "1");
	}, 2000);
	
	
	/*setInterval(() => {
		
		outerState.set(!outerState.get());
		innerState.set(innerState.get() + 1);
	}, 2000);*/
});




/*let a = h(
	"div.hello",
	{
		hook: {
			
		}
	},
	"Hello!"
);
let b = h(
	"div.world",
	{},
	"World!"
);
let mount = h(
	"div.hello",
	{},
	"Hello!"
);
function child(count: number) {
	return h(
		"div.child",
		{},
		`Here's a number: ${count}`
	);
}*/

/*a = h(
	"div.hello",
	{},
	"Hellow!"
);*/
/*setTimeout(() => {
	//patch(document.body, a);
	patch(a, b);
}, 1000);*/


