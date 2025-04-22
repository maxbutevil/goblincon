



type Callback<A extends any[]> = ((...args: A) => any);

export default class Signal<T extends any[] = []> extends Set<Callback<T>> {
	
	static readonly UNHANDLED = false;
	static readonly HANDLED = true;
	
	static bundle(...callbacks: Array<() => void>): () => void {
		if (callbacks.length === 0) {
			return () => {};
		} else if (callbacks.length === 1) {
			return callbacks[0];
		} else {
			return () => {
				for (const callback of callbacks)
					callback();
			}
		}
	}
	/*static forwardEvent<T extends Event>(emitter: EventTarget, event: string): Signal<T> {
		let newSignal = new Signal<T>();
		//newSignal.bindEvent(emitter, event);
		emitter.addEventListener(event, event => newSignal.emit(event as T));//newSignal.emit.bind(newSignal));
		return newSignal;
	}
	static forward<T>(signal: Signal<T>) {
		let newSignal = new Signal<T>();
		newSignal.bindSignal(signal);
		return newSignal;
	}*/
	/*bindEvent(emitter: EventTarget, event: string): void {
		//emitter.on(event, this.emit.bind(this));
		emitter.addEventListener(event, this.emit.bind(this));
	}*/
	/*bindSignal(signal: Signal<T>): void {
		signal.listen(this.emit.bind(this));
	}*/
	
	listen(callback: Callback<T>): Callback<T> {
		this.add(callback);
		return callback;
	}
	drop(callback: Callback<T>): void {
		this.delete(callback);
	}
	dropAll(): void {
		this.clear();
	}
	
	subscribe(callback: Callback<T>): () => void {
		this.listen(callback);
		return () => this.drop(callback);
	}
	
	emit(...args: T): void {
		for (const callback of this)
			callback(...args);
	}
	handle(...args: T): boolean {
		for (const callback of this)
			if (callback(...args) === Signal.HANDLED)
				return Signal.HANDLED;
		return Signal.UNHANDLED;
	}
	
	/*filtered(filter: (...args: T) => boolean): Signal<T> {
		const signal = new Signal();
		
	}*/
	
	private static _keydown?: Signal<[KeyboardEvent]>;
	private static _keyup?: Signal<[KeyboardEvent]>;
	static get keydown() {
		return this._keydown ??= Signal.fromDocumentEvent("keydown");
	}
	static get keyup() {
		return this._keyup ??= Signal.fromDocumentEvent("keyup");
	}
	static fromDocumentEvent<E extends keyof DocumentEventMap>(event: E): Signal<[DocumentEventMap[E]]> {
		const signal = new Signal<[DocumentEventMap[E]]>();
		document.addEventListener(event, ev => signal.emit(ev));
		return signal;
	}
}



