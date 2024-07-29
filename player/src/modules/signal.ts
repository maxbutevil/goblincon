



//import { EventEmitter } from "events"


type Callback<T> = (() => any) | ((arg: T) => any);
//type Cleanup = () =>
//type Drop = () => void;

export default class Signal<T = void> extends Set<Callback<T>> {
	
	static readonly UNHANDLED = false;
	static readonly HANDLED = true;
	
	public static group(...callbacks: Array<() => void>): () => void {
		return () => {
			for (const callback of callbacks)
				callback();
		}
	}
	
	public static forwardEvent<T extends Event>(emitter: EventTarget, event: string): Signal<T> {
		let newSignal = new Signal<T>();
		//newSignal.bindEvent(emitter, event);
		emitter.addEventListener(event, event => newSignal.emit(event as T));//newSignal.emit.bind(newSignal));
		return newSignal;
	}
	public static forward<T>(signal: Signal<T>) {
		let newSignal = new Signal<T>();
		newSignal.bindSignal(signal);
		return newSignal;
	}
	/*bindEvent(emitter: EventTarget, event: string): void {
		//emitter.on(event, this.emit.bind(this));
		emitter.addEventListener(event, this.emit.bind(this));
	}*/
	bindSignal(signal: Signal<T>): void {
		signal.listen(this.emit.bind(this));
	}
	
	public listen(callback: Callback<T>): Callback<T> {
		this.add(callback);
		return callback;
	}
	public drop(callback: Callback<T>): void {
		this.delete(callback);
	}
	public dropAll(): void {
		this.clear();
	}
	
	public subscribe(callback: Callback<T>): () => void {
		this.listen(callback);
		return () => this.drop(callback);
	}
	
	/*public subscribe(callback: Callback<T>, chain?: () => void): () => void {
		
		this.listen(callback);
		
		return () => {
			chain?.();
			this.drop(callback);
		}
		
	}*/
	
	public emit(arg: T): void {
		for (const callback of this)
			callback(arg);
	}
	public handle(arg: T): boolean {
		for (const callback of this)
			if (callback(arg) == Signal.HANDLED)
				return Signal.HANDLED;
		return Signal.UNHANDLED;
	}
	
}



