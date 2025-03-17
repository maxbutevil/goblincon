
import Signal from "./signal"


//const ALL = Symbol

const ANY = Symbol();

type StatePool<T> = T | Array<T> | typeof ANY;

export default class State<T> {
	
	static ANY: typeof ANY = ANY;
	
	readonly changed = new Signal<[from: T, to: T]>();
	curr: T;
	
	private cmpDepth: number;
	private signalEntries = new Array<{ signal: Signal<[T, T]>, from: StatePool<T>, to: StatePool<T> }>();
	
	constructor(initial: T, cmpDepth = 0) {
		this.curr = initial;
		this.cmpDepth = cmpDepth;
	}
	static shallow<T>(initial: T): State<T> {
		return new State(initial, 0);
	}
	static deep<T>(initial: T): State<T> {
		return new State(initial, Infinity);
	}
	
	static cmp<T>(one: T, two: T, depth: number): boolean {
		if (typeof one !== typeof two)
			return false;
		
		if (depth > 0 && typeof one === 'object') {
			for (const key in one)
				if (!this.cmp(one[key], two[key], depth - 1))
					return false;
			
			return true;
		} else {
			return one === two;
		}
	}
	
	private handleChanged(from: T, to: T): void {
		this.changed.emit(from, to);
		
		for (const entry of this.signalEntries)
			if (this.stateMatch(entry.from, from) && this.stateMatch(entry.to, to))
				entry.signal.emit(from, to);
	}
	
	private cmp(one: T, two: T): boolean {
		return State.cmp(one, two, this.cmpDepth);
	}
	private stateMatch(pool: StatePool<T>, state: T): boolean {
		/*if (pool === State.ANY) return true;
		if (!Array.isArray(pool)) return this.cmp(state, pool);
		
		for (const item of pool)
			if (this.cmp(state, item))
				return true;
		
		return false;*/
		return pool === State.ANY || pool === state || (Array.isArray(pool) && pool.includes(state));
	}
	private createTransition(from: StatePool<T>, to: StatePool<T>): Signal<[T, T]> {
		
		let signal = new Signal<[T, T]>();
		this.signalEntries.push({ signal, from, to });
		
		/*this.changed.connect((values: [T, T]) => {
			
			if (this.stateMatch(from, values[0]) && this.stateMatch(to, values[1]))
				signal.emit(values);
			
		});*/
		
		return signal;
		
	}
	
	transition(from: T | Array<T>, to: T | Array<T>): Signal<[T, T]> {
		return this.createTransition(from, to);
	}
	transitionFrom(from: T | Array<T>): Signal<[T, T]> {
		return this.createTransition(from, State.ANY);
	}
	transitionTo(to: T | Array<T>): Signal<[T, T]> {
		return this.createTransition(State.ANY, to);
	}
	
	is(value: T): boolean {
		return this.curr == value;
	}
	any(...values: Array<T>): boolean {
		return values.includes(this.curr);
	}
	
	set(to: T) {
		if (!this.cmp(to, this.curr))
			this.handleChanged(this.curr, this.curr = to);
	}
	get(): T {
		return this.curr;
	}
	
	mutate(mutator: (curr: T) => T) {
		this.set(mutator(this.curr));
	}
	
}

/*console.log(State.cmp(
	{ hello: "world" },
	{ hello: "world" }, 2
));*/

