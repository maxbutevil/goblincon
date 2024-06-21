/* This is a single, rather simple utility type for creating algebraic data types (ADTs) */
export type Variant<K extends string, V = {}> = { key: K } & V;