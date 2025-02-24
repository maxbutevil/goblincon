

import Signal from "./signal"

type ValidatorMethod<T> = (value: any) => value is T; //((value: any) => T);
type ValidatorMap<T> = { [key in keyof T]: Validator<T[key]> };
export type Validator<T> = ValidatorMethod<T> | ValidatorMap<T>;
export type Validated<T> = T extends Validator<infer X> ? X : never;

export default class Val {
	
	static NONE: ValidatorMethod<undefined> = (value: any): value is undefined => value == undefined;
	static ANY: ValidatorMethod<any> = (value: any): value is any => true;
	static BOOL = Val.simple<boolean>("boolean");
	static NUM = Val.simple<number>("number");
	static STR = Val.simple<string>("string");
	
	private static simple<T>(typeString: string): ValidatorMethod<T> {
		return (value: any): value is T => typeof value === typeString;
	}
	static fixed<T>(value: T): ValidatorMethod<T> {
		return (_value: any): _value is T => _value === value;
	}
	static optional<T>(extractor: Validator<T>): ValidatorMethod<T | undefined> {
		return (value: any): value is T | undefined => {
			if (value === undefined)
				return true;
			else
				return Val.is(extractor, value);
		};
	}
	static choice<T>(...choices: Array<T>): ValidatorMethod<T> {
		return (value: any): value is T => choices.includes(value);
	}
	static branch<T>(...branches: Array<Validator<T>>): ValidatorMethod<T> {
		return (value: any): value is T => {
			for (const branch of branches)
				if (Val.is(branch, value))
					return true;
			return false;
		}
	}
	static array<T>(extractor: ValidatorMethod<T>): ValidatorMethod<Array<T>> {
		return (value: any): value is Array<T> => {
			if (Array.isArray(value)) {
				for (const element of value)
					if (!Val.is(extractor, element))
						return false;
				return true;
			}
			return false;
		}
	}
	static unchecked<T>(): ValidatorMethod<T> {
		return this.ANY;
	}
	
	
	static Val<T>(extractor: Validator<T>, validator: (value: T) => boolean): ValidatorMethod<T> {
		return (value: any): value is T => {
			return Val.is(extractor, value) && validator(value);
		}
	}
	
	static is<T>(extractor: Validator<T>, value: any): value is T {
		if (typeof extractor == "function") {
			return extractor(value);
		} else {
			for (const key in extractor)
				if (!Val.is(extractor[key], value[key]))
					return false;
			return true;
		}
	}
	static get<T>(extractor: Validator<T>, value: any): T | undefined {
		return Val.is(extractor, value) ? value : undefined;
	}
}

type IncomingMessage<I, K extends keyof I> = Validated<I[K]>;
type ReceiveCallback<I, K extends keyof I> = ((value: IncomingMessage<I, K>) => any);

type Index = { [key: string]: Validator<any> }
export class ReceiveIndex<I extends Index> {
	
	private extractors: I;
	private signals: { [K in keyof I]?: Signal<IncomingMessage<I, K>> } = {};
	constructor(extractors: I) {
		this.extractors = extractors;
	}
	
	private signal<K extends keyof I>(key: K): Signal<IncomingMessage<I, K>> {
		return this.signals[key] ??= new Signal();
	}
	listen<K extends keyof I>(key: K, callback: ReceiveCallback<I, K>) {
		this.signal(key).listen(callback);
	}
	drop<K extends keyof I>(key: K, callback: ReceiveCallback<I, K>) {
		this.signal(key).drop(callback);
	}
	subscribe<K extends keyof I>(key: K, callback: ReceiveCallback<I, K>): () => void {
		return this.signal(key).subscribe(callback);
	}
	
	has(type: string) {
		return type in this.extractors;
	}
	handle(type: keyof I, data: any): boolean {
		//let type = message.type as keyof I;
		//let data = message.data;
		
		//if (!(type in this.extractors))
		//	throw new Error(`Unrecognized message type: ${String(type)} | ${data}`);
		if (!(type in this.extractors))
			return Signal.UNHANDLED;
		if (!(type in this.signals)) {
			console.error(`Unhandled message type: ${String(type)} | `, data);
			return Signal.HANDLED;
		}
		
		if (Val.is(this.extractors[type], data)) {
			if (data) {
				console.log(`${String(type)} | ${JSON.stringify(data)}`);
			} else {
				console.log(`${String(type)}`);	
			}
			
			this.signals[type]!.emit(data);
		} else {
			console.error(`Invalid message data: ${String(type)} | `, data);
			return Signal.HANDLED;
		}
		return Signal.HANDLED;
		
		/*let extracted;
		try {
			extracted = Val.unsafe(this.extractors[type], data);
		} catch(err) {
			console.error(`Invalid message data: ${String(type)} | ${data} | ${err}`);
			return Signal.HANDLED;
		}
		
		console.log(`Message received: ${String(type)} | ${JSON.stringify(data)}`);
		this.signals[type]!.emit(extracted);
		return Signal.HANDLED;*/
	}
	
}

export class SendIndex<I extends Index> {
	
	//send = new Signal<string>();
	outgoing = new Signal<string>();
	
	//private sender: (encoded: string) => any;
	constructor(_: I/*, sender: (encoded: string) => any*/) {
		//this.sender = sender;
	}
	encode<K extends keyof I>(type: K, data: Validated<I[K]>): string {
		return data == undefined ? 
			JSON.stringify({ type }) :
			JSON.stringify({ type, data });
	}
	send<K extends keyof I>(type: K, data: Validated<I[K]>) {
		//this.sender(this.encode(type, data));
		const handled = this.outgoing.handle(this.encode(type, data));
		if (!handled)
			console.warn(`unsent outgoing message: ${String(type)} |`, data);
		else
			console.info(`sent: ${String(type)} |`, data);
		//this.outgoing.emit(data);
	}
	/*sendUnit<K extends keyof I: Validated<I[K]> extends undefined ? K : never) {
		this.outgoing.emit(this.encode(type, undefined));
	}*/
	
}

