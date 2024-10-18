/* This is a single, rather simple utility type for creating algebraic data types (ADTs) */


//type EnumMap = { [key: string]: any };

export type Variant<K extends string, V extends {} = {}> = { key: K } & V;

export function unit<K extends string>(key: K): Variant<K, {}> {
	return { key };
}

export function variant<K extends string, V extends {} = {}>(key: K, value: V): Variant<K, V> {
	return Object.assign({ key }, value);
}
export function factory<K extends string, V extends {} = {}>(key: K): (value: V) => Variant<K, V> {
	return value => variant(key, value);
}
