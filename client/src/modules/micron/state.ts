
import Signal from "./signal"

function defaultEq<T>(curr: T, from: T): boolean {
	return curr === from;
}
function neverEq<T>(_curr: T, _from: T): boolean {
	return false;
}

export default class State<T> {
	
	readonly changed = new Signal<[curr: T, from: T]>();
	
	protected curr: T;
	readonly eq: (curr: T, from: T) => boolean;
	
	constructor(initial: T, eq: typeof defaultEq = defaultEq) {
		this.curr = initial;
		this.eq = eq;
	}
	static ref<T>(initial: T): State<T> {
		return new State(initial, neverEq);
	}
	
	set(to: T) {
		if (!this.eq(to, this.curr)) {
			const from = this.curr;
			this.curr = to;
			this.changed.emit(this.curr, from);
		}
	}
	get(): T {
		return this.curr;
	}
	
	is(value: T): boolean {
		return this.curr === value;
	}
	any(...values: Array<T>): boolean {
		return values.includes(this.curr);
	}
	
	mutate(mutator: (curr: T) => T) {
		this.set(mutator(this.curr));
	}
	toggle(to: T, other: T) {
		if (this.get() !== to) {
			this.set(to);
		} else {
			this.set(other);
		}
	}
	
	
	map<O>(mapper: (value: T) => O, eq = defaultEq): Shard<O> {
		return Shard.map(this, mapper, eq);
	}
	filter(filter: (curr: T, from: T) => boolean): Shard<T> {
		return Shard.filter(this, filter);
	}
	transition(to: T, from: T): Shard<T> {
		return this.filter((_curr, _from) => to === _curr && from === _from);
	}
	transitionTo(value: T): Shard<T> {
		return this.filter((curr, from) => curr === value);
	}
	transitionFrom(value: T): Shard<T> {
		return this.filter((curr, from) => from === value);
	}
	transitionToAny(values: T[]): Shard<T> {
		return this.filter((curr, from) => values.includes(curr));
	}
	transitionFromAny(values: T[]): Shard<T> {
		return this.filter((curr, from) => values.includes(from));
	}
	/*transitionAny(to: T[], from: T[]): Shard<T> {
		
	}*/
	
	/*private stateMatch(pool: StatePool<T>, state: T): boolean {
		if (pool === State.ANY) return true;
		if (Array.isArray(pool)) {
			for (const s of pool) {
				if (this.eq(s, state)) return true;
			}
		}
		return this.eq(pool as T, state); // maybe evil?
	}
	private createTransition(from: StatePool<T>, to: StatePool<T>): Signal<[T, T]> {
		let signal = new Signal<[T, T]>();
		this.signals.push({ signal, from, to });
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
	}*/
	

	
}

export class Shard<T> extends Signal<[T, T]> {
	
	readonly get: () => T;
	
	protected constructor(get: () => T) {
		super();
		this.get = get;
	}
	
	static map<I, O>(state: State<I>, mapper: (value: I) => O, eq = defaultEq): Shard<O> {
		const shard = new Shard(() => mapper(state.get()));
		state.changed.listen((curr, from) => {
			const mappedCurr = mapper(curr);
			const mappedFrom = mapper(from);
			if (!eq(mappedCurr, mappedFrom)) {
				shard.emit(mappedCurr, mappedFrom);
			}
		});
		return shard;
	}
	static filter<T>(state: State<T>, filter: (curr: T, from: T) => boolean): Shard<T> {
		const shard = new Shard(() => state.get());
		state.changed.listen((curr, from) => {
			if (filter(curr, from)) {
				shard.emit(curr, from);
			}
		});
		return shard;
	}
	
	/*get(): O {
		return this.mapping(this.state.get());
	}*/
	
	
	/*static mapped<I, O>(state: State<I>, mapping: (value: I) => O, eq: typeof defaultEq = defaultEq): Shard<I, O> {
		const shard = new Shard<I, O>(state);
		state.changed.listen();
		return shard;
	}
	static filtered<T>(state: State<T>, filter: (curr: T, from: T) => boolean) {
		const shard = new Shard<T, T>(state);
		state.changed.listen((curr, from) => {
			if (filter(curr, from)) {
				shard.emit(curr, from);
			}
		});
		return shard;
	}*/
	
	//get() { return this.state.get(); }
	
	/*get() { return this.state.get(); }
	is(value: T): boolean { return this.state.is(value); }
	any(...values: T[]): boolean { return this.state.any(...values); }*/
	
	
}
