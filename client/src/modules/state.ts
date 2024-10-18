
import Signal from "./signal"


//const ALL = Symbol

const ANY = Symbol();

type StatePool<T> = T | Array<T> | typeof ANY;

export default class State<T> {
	
	static ANY: typeof ANY = ANY;
	
	public changed = new Signal<[from: T, to: T]>();
	
	private value: T;
	private cmpDepth: number;
	private signalEntries = new Array<{ signal: Signal<[T, T]>, from: StatePool<T>, to: StatePool<T> }>();
	
	constructor(value: T, cmpDepth = 0) {
		this.value = value;
		this.cmpDepth = cmpDepth;
	}
	static deep<T>(value: T): State<T> {
		return new State(value, Infinity);
	}
	
	private static cmp<T>(one: T, two: T, depth: number): boolean {
		if (typeof one !== typeof two)
			return false;
		
		if (depth > 1 && typeof one === 'object') {
			for (const key in one)
				if (!this.cmp(one[key], two[key], depth - 1))
					return false;
			
			return true;
		} else {
			return one === two;
		}
	}
	
	private handleChanged(from: T, to: T): void {
		const out: [T, T] = [from, to];
		this.changed.emit(out);
		
		for (const entry of this.signalEntries)
			if (this.stateMatch(entry.from, from) && this.stateMatch(entry.to, to))
				entry.signal.emit(out);
	}
	
	private stateMatch(pool: StatePool<T>, state: T): boolean {
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
		return this.value == value;
	}
	any(...values: Array<T>): boolean {
		return values.includes(this.value);
	}
	
	set(to: T) {
		if (to !== this.value)
			this.handleChanged(this.value, this.value = to);
	}
	get(): T {
		return this.value;
	}
	
}

