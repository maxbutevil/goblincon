

import Signal from "./signal"

type ExtractorMethod<T> = (value: any) => value is T; //((value: any) => T);
type ExtractorMap<T> = { [key in keyof T]: Extractor<T[key]> };
export type Extractor<T> = ExtractorMethod<T> | ExtractorMap<T>;
export type Extracted<T> = T extends Extractor<infer X> ? X : never;

/*export default class Extract {
	
	static NONE: ExtractorMethod<void> = () => {};
	static ANY: ExtractorMethod<any> = (value: any) => value;
	static BOOL = Extract.simple<boolean>("boolean");
	static NUMBER = Extract.simple<number>("number");
	static STRING = Extract.simple<string>("string");
	
	private static simple<T>(typeString: string): ExtractorMethod<T> {
		return (value: any): T => {
			if (typeof value === typeString) {
				return value as T;
			} else {
				throw new Error(`Extractor type mismatch: ${value} is not a ${typeString}`);
			}
		};
	}
	static optional<T>(extractor: Extractor<T>): ExtractorMethod<T | undefined> {
		return (value: any) => {
			if (value == undefined)
				return undefined;
			else
				return Extract.unsafe(extractor, value);
		};
	}
	static fallback<T>(extractor: Extractor<T>, fallback: T): ExtractorMethod<T> {
		return (value: any) => {
			if (value == undefined)
				return fallback;
			else
				return Extract.unsafe(extractor, value);
		}
	}
	static required<T>(value: T): ExtractorMethod<T> {
		return (_value: any) => {
			if (_value == value)
				return _value;
			else
				throw new Error(`Extractor required error: Invalid value ${_value} for required ${value}`);
		};
	}
	static choice<T>(...choices: Array<T>): ExtractorMethod<T> {
		return (value: any) => {
			let i = choices.indexOf(value);
			if (i === -1)
				throw new Error(`Extractor choice error: ${value} not found in ${choices}`);
			else
				return choices[i];
		};
	}
	static branch<T>(...branches: Array<Extractor<T>>): ExtractorMethod<T> {
		return (value: any) => {
			for (const branch of branches) {
				try {
					return Extract.unsafe(branch, value);
				} catch(e) {}
			}
			throw new Error(`Extractor branch error: ${value} did not match any branches.`);
		}
	}
	
	/*static choice<T>(...extractors: Array<Extractor<T>>): Extractor<T> {
		return (value: any) => {
			for (const extractor of extractors) {
				try {
					return Extract.unsafe(extractor, value)
				} catch(e) {}
			}
			throw new Error(`Extractor choice error: ${value} matches no paths.`);
		};
	}
	static array<T>(extractor: ExtractorMethod<T>): ExtractorMethod<Array<T>> {
		return (value: any) => {
			if (Array.isArray(value)) {
				return value.map((value) => Extract.unsafe(extractor, value));
			} else {
				throw new Error(`Extractor type mismatch: ${value} is not an array.`);
			}
		}
	}
	static validate<T>(extractor: Extractor<T>, validator: (value: T) => boolean, message: string = "[unspecified]"): ExtractorMethod<T> {
		return (value: any) => {
			let extracted = Extract.unsafe(extractor, value);
			if (validator(extracted))
				return extracted;
			else
				throw new Error(`Extractor validation error: ${message}`);
		}
	}
	
	static safe<T>(extractor: Extractor<T>, value: any): T | undefined {
		try {
			Extract.unsafe(extractor, value);
		} catch(e) {
			console.error(e);
			console.warn("Extraction failed on: ", value)
			return undefined;
		}
	}
	static unsafe<T>(extractor: Extractor<T>, value: any): T {
		
		if (typeof extractor == "function") {
			return extractor(value);
		} else if (Array.isArray(extractor)) {
			let extracted = [];
			for (let i = 0; i < extractor.length; i++)
				extracted.push(Extract.unsafe(extractor[i], value[i]));
			return extracted as T;
		} else {
			let extracted = {} as T;
			for (const key in extractor)
				extracted[key] = Extract.unsafe(extractor[key], value[key]);
			return extracted;
		}
		
	}
	
}*/

export default class Extract {
	
	static NONE: ExtractorMethod<undefined> = (value: any): value is undefined => value == undefined;
	static ANY: ExtractorMethod<any> = (value: any): value is any => true;
	static BOOL = Extract.simple<boolean>("boolean");
	static NUMBER = Extract.simple<number>("number");
	static STRING = Extract.simple<string>("string");
	
	
	private static simple<T>(typeString: string): ExtractorMethod<T> {
		return (value: any): value is T => typeof value === typeString;
	}
	static fixed<T>(value: T): ExtractorMethod<T> {
		return (_value: any): _value is T => _value === value;
	}
	static optional<T>(extractor: Extractor<T>): ExtractorMethod<T | undefined> {
		return (value: any): value is T | undefined => {
			if (value == undefined)
				return true;
			else
				return Extract.is(extractor, value);
		};
	}
	/*static fallback<T>(extractor: Extractor<T>, fallback: T): ExtractorMethod<T> {
		return (value: any) => {
			if (value == undefined)
				return fallback;
			else
				return Extract.is(extractor, value);
		}
	}
	static required<T>(value: T): ExtractorMethod<T> {
		return (_value: any) => {
			if (_value == value)
				return _value;
			else
				throw new Error(`Extractor required error: Invalid value ${_value} for required ${value}`);
		};
	}*/
	static choice<T>(...choices: Array<T>): ExtractorMethod<T> {
		return (value: any): value is T => choices.includes(value);
		/*let i = choices.indexOf(value);
			return choices.includes(value);
			/*if (i === -1)
				throw new Error(`Extractor choice error: ${value} not found in ${choices}`);
			else
				return choices[i];
		};*/
	}
	static branch<T>(...branches: Array<Extractor<T>>): ExtractorMethod<T> {
		return (value: any): value is T => {
			for (const branch of branches)
				if (Extract.is(branch, value))
					return true;
			return false;
			//throw new Error(`Extractor branch error: ${value} did not match any branches.`);
		}
	}
	static array<T>(extractor: ExtractorMethod<T>): ExtractorMethod<Array<T>> {
		return (value: any): value is Array<T> => {
			if (Array.isArray(value)) {
				for (const element of value)
					if (!Extract.is(extractor, element))
						return false;
				return true;
			}
			return false;
		}
	}
	static validate<T>(extractor: Extractor<T>, validator: (value: T) => boolean): ExtractorMethod<T> {
		return (value: any): value is T => {
			return Extract.is(extractor, value) && validator(value);
		}
	}
	
	static is<T>(extractor: Extractor<T>, value: any): value is T {
		if (typeof extractor == "function") {
			return extractor(value);
		} else {
			for (const key in extractor)
				if (!Extract.is(extractor[key], value[key]))
					return false;
			return true;
		}
	}
	static get<T>(extractor: Extractor<T>, value: any): T | undefined {
		return Extract.is(extractor, value) ? value : undefined;
	}
	
	/*static safe<T>(extractor: Extractor<T>, value: any): T | undefined {
		try {
			Extract.unsafe(extractor, value);
		} catch(e) {
			console.error(e);
			console.warn("Extraction failed on: ", value)
			return undefined;
		}
	}
	static unsafe<T>(extractor: Extractor<T>, value: any): value is T {
		
		if (typeof extractor == "function") {
			return extractor(value);
		} else if (Array.isArray(extractor)) {
			let extracted = [];
			for (let i = 0; i < extractor.length; i++)
				Extract.unsafe(extractor[i], value[i]);
		} else {
			let extracted = {} as T;
			for (const key in extractor)
				extracted[key] = Extract.unsafe(extractor[key], value[key]);
			return extracted;
		}
		
	}*/
	
}


/*type Index = { [key: string]: Extractor<any> };
function decode<I extends Index>(index: I) {
	
}

function encode<I extends Index>() {
	
}*/

//type IncomingMessage<I, K extends keyof I> = { peer: P, data: Extracted<I[K]> };
//type IncomingSignal<I, K extends keyof I> = Signal<IncomingMessage<>;
type IncomingMessage<I, K extends keyof I> = Extracted<I[K]>;
type ReceiveCallback<I, K extends keyof I> = ((value: IncomingMessage<I, K>) => any);

type Index = { [key: string]: Extractor<any> }
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
	
	/*handle(content: string) {
		try {
			this.handleRaw(content);
		} catch(e) {
			console.error(e);
		}
	}
	handleQuiet(content: string) {
		try {
			this.handleRaw(content);
		} catch(e) {
			
		}
	}*/
	
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
			console.error(`Unhandled message type: ${String(type)} | ${data}`);
			return Signal.HANDLED;
		}
		
		if (Extract.is(this.extractors[type], data)) {
			console.log(`Message received: ${String(type)} | ${JSON.stringify(data)}`);
			this.signals[type]!.emit(data);
		} else {
			console.error(`Invalid message data: ${String(type)} | ${String(data)}`);
			return Signal.HANDLED;
		}
		return Signal.HANDLED;
		
		/*let extracted;
		try {
			extracted = Extract.unsafe(this.extractors[type], data);
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
	encode<K extends keyof I>(type: K, data: Extracted<I[K]>): string {
		return data == undefined ? 
			JSON.stringify({ type }) :
			JSON.stringify({ type, data });
	}
	send<K extends keyof I>(type: K, data: Extracted<I[K]>) {
		//this.sender(this.encode(type, data));
		this.outgoing.emit(this.encode(type, data));
		//this.outgoing.emit(data);
	}
	/*sendUnit<K extends keyof I: Extracted<I[K]> extends undefined ? K : never) {
		this.outgoing.emit(this.encode(type, undefined));
	}*/
	
}

/*const incoming = new ReceiveIndex({
	test: { num: Extract.NUM, str: Extract.STR }
});
incoming.listen("test", ({ data }) => {
	
});*/

/*const incoming = new DecodeIndex({
	test: { num: Extract.NUM, str: Extract.STR }
});
incoming.decode("test", {})

const outgoing = new EncodeIndex({
	test: { num: Extract.NUM, str: Extract.STR }
});
outgoing.encode("test", { num: 10, str: "Hello world!" });*/

//console.log("Extractor Test: ", Extract.is(Extract.array(Extract.STRING), ["hello", "world"]))

