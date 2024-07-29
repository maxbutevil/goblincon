/* This is a single, rather simple utility type for creating algebraic data types (ADTs) */


type EnumMap = { [key: string]: any };
export type Variant<K extends string, V extends {} = {}> = { key: K } & V;



export class Enum {
	static unit<K extends string>(key: K): Variant<K, {}> {
		return { key };
	}
	static variant<K extends string, V extends {} = {}>(key: K, value: V): Variant<K, V> {
		return Object.assign({ key }, value);
	}
	static is<K extends string>(variant: Variant<any>, key: string): variant is Variant<K> {
		return variant.key === key;
	}
}
