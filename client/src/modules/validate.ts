

import Signal from "./micron/signal"

type ValidatorMethod<T> = (value: any) => value is T; //((value: any) => T);
type ValidatorMap<T> = { [key in keyof T]: Validator<T[key]> };
export type Validator<T> = ValidatorMethod<T> | ValidatorMap<T>;
export type Validated<T> = T extends Validator<infer X> ? X : never;

export default class Val {
	
	static NONE: ValidatorMethod<void> = (value: any): value is undefined => value === undefined;
	//static NULL: ValidatorMethod<
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
	
	static orNull<T>(validator: Validator<T>): ValidatorMethod<T | null> {
		return (value: any): value is T | null => {
			return value === null || Val.is(validator, value);
		};
	}
	static orUndefined<T>(validator: Validator<T>): ValidatorMethod<T | undefined> {
		return (value: any): value is T | undefined => {
			return value === undefined || Val.is(validator, value);
		};
	}
	static orNullish<T>(validator: Validator<T>): ValidatorMethod<T | null | undefined> {
		return (value: any): value is T | null | undefined => {
			return value === null || value === undefined || Val.is(validator, value);
		};
	}
	static choice<const T>(...choices: Array<T>): ValidatorMethod<T> {
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
	static array<T>(validator: ValidatorMethod<T>): ValidatorMethod<Array<T>> {
		return (value: any): value is Array<T> => {
			if (Array.isArray(value)) {
				for (const element of value)
					if (!Val.is(validator, element))
						return false;
				return true;
			}
			return false;
		}
	}
	static unchecked<T>(): ValidatorMethod<T> {
		return this.ANY;
	}
	
	
	static check<T>(validator: Validator<T>, condition: (value: T) => boolean): ValidatorMethod<T> {
		return (value: any): value is T => {
			return Val.is(validator, value) && condition(value);
		}
	}
	
	static is<T>(validator: Validator<T>, value: any): value is T {
		if (typeof validator == "function") {
			return validator(value);
		} else {
			for (const key in validator)
				if (!Val.is(validator[key], value[key]))
					return false;
			return true;
		}
	}
	/*static get<T>(validator: Validator<T>, value: any): T | undefined {
		return Val.is(validator, value) ? value : undefined;
	}*/
}

type IncomingMessage<I, K extends keyof I> = Validated<I[K]>;
type ReceiveCallback<I, K extends keyof I> = ((value: IncomingMessage<I, K>) => any);

type Index = { [key: string]: Validator<any> }
export class ReceiveIndex<I extends Index> {
	
	private validators: I;
	private signals: { [K in keyof I]?: Signal<[IncomingMessage<I, K>]> } = {};
	constructor(validators: I) {
		this.validators = validators;
	}
	
	private signal<K extends keyof I>(key: K): Signal<[IncomingMessage<I, K>]> {
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
		return type in this.validators;
	}
	handle(type: keyof I, data: any): boolean {
		if (!(type in this.validators))
			return Signal.UNHANDLED;
		if (!(type in this.signals)) {
			console.error(`unhandled message type: ${String(type)} | `, data);
			return Signal.HANDLED;
		}
		
		if (Val.is(this.validators[type], data)) {
			if (data) {
				console.info(`recv: ${String(type)} | ${JSON.stringify(data)}`);
			} else {
				console.info(`recv: ${String(type)}`);	
			}
			
			this.signals[type]!.emit(data);
		} else {
			console.error(`invalid message data: ${String(type)} | `, data);
			return Signal.HANDLED;
		}
		return Signal.HANDLED;
	}
	
}

export class SendIndex<I extends Index> {
	
	outgoing = new Signal<[string]>();
	
	constructor(_: I) { /* Argument is just for type inference */}
	encode<K extends keyof I>(type: K, data: Validated<I[K]>): string {
		return data == undefined ? 
			JSON.stringify({ type }) :
			JSON.stringify({ type, data });
	}
	send<K extends keyof I>(type: Validated<I[K]> extends void ? K : never): void;
	send<K extends keyof I>(type: K, data: Validated<I[K]>): void;
	send<K extends keyof I>(type: K, data: Validated<I[K]> | undefined = undefined): void {
		const encoded = this.encode(type, data as Validated<I[K]>)
		const handled = this.outgoing.handle(encoded);
		if (!handled)
			console.warn(`unsent outgoing message: ${String(type)} |`, data);
		else
			console.info(`sent: ${String(type)} |`, data);
	}
}

