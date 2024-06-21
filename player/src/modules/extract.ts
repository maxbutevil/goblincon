

import Signal from "./signal"

type ExtractorMethod<T> = ((value: any) => T);
type ExtractorMap<T> = { [key in keyof T]: Extractor<T[key]> };
export type Extractor<T> = ExtractorMethod<T> | ExtractorMap<T>;
export type Extracted<T> = T extends Extractor<infer X> ? X : never;

export default class Extract {
	
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
			if (value == undefined) {
				return undefined;
			} else {
				return Extract.unsafe(extractor, value);
			}
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
	/*static choice<T>(...extractors: Array<Extractor<T>>): Extractor<T> {
		return (value: any) => {
			for (const extractor of extractors) {
				try {
					return Extract.unsafe(extractor, value)
				} catch(e) {}
			}
			throw new Error(`Extractor choice error: ${value} matches no paths.`);
		};
	}*/
	static array<T>(extractor: ExtractorMethod<T>) {
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
	
}

/*type Index = { [key: string]: Extractor<any> };
function decode<I extends Index>(index: I) {
	
}

function encode<I extends Index>() {
	
}*/

//type IncomingMessage<I, K extends keyof I, P> = { peer: P, data: Extracted<I[K]> };
//type IncomingSignal<I, K extends keyof I, P> = Signal<IncomingMessage<, P>;
type IncomingMessage<I, K extends keyof I, _> = Extracted<I[K]>;
type ReceiveCallback<I, K extends keyof I, _> = ((value: IncomingMessage<I, K, _>) => any);

type Index = { [key: string]: Extractor<any> }
export class ReceiveIndex<I extends Index, P = never> {
	
	private extractors: I;
	private signals: { [K in keyof I]?: Signal<IncomingMessage<I, K, P>> } = {};
	constructor(extractors: I) {
		this.extractors = extractors;
	}
	
	private signal<K extends keyof I>(key: K): Signal<IncomingMessage<I, K, P>> {
		return this.signals[key] ??= new Signal();
	}
	listen<K extends keyof I>(key: K, callback: ReceiveCallback<I, K, P>) {
		this.signal(key).listen(callback);
	}
	drop<K extends keyof I>(key: K, callback: ReceiveCallback<I, K, P>) {
		this.signal(key).drop(callback);
	}
	subscribe<K extends keyof I>(key: K, callback: ReceiveCallback<I, K, P>): () => void {
		return this.signal(key).subscribe(callback);
	}
	
	handle(content: string) {
		
		let message = JSON.parse(content);
		
		if (typeof message.type != "string")
			return console.error("Invalid message received: ", message);
		
		let type = message.type as keyof I;
		let data = message.data;
		
		if (!(type in this.extractors))
			return console.error("Unrecognized message type: ", type, " | ", data);
		if (!(type in this.signals))
			return console.error("Unhandled message type: ", type, " | ", data);
		
		let extracted;
		try {
			extracted = Extract.unsafe(this.extractors[type], data);
		} catch(err) {
			return console.error("Invalid message data: ", type, " | ", data, " | ", err);
		}
		
		console.log("Message received: ", message);
		this.signals[type]!.emit(extracted);
		
	}
	
}
export class SendIndex<I extends Index> {
	
	//send = new Signal<string>();
	
	private sender: (encoded: string) => any;
	constructor(_: I, sender: (encoded: string) => any) {
		this.sender = sender;
	}
	encode<K extends keyof I>(type: K, data: Extracted<I[K]>): string {
		return data == undefined ? 
			JSON.stringify({ type }) :
			JSON.stringify({ type, data });
	}
	send<K extends keyof I>(type: K, data: Extracted<I[K]>) {
		this.sender(this.encode(type, data));
	}
	
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



