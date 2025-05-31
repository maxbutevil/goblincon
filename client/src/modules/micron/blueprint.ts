
import { Builder } from "./builder";
import * as builder from "./builder";


export type Blueprint<A extends any[] = any> = [Builder<A>, A];
export const EMPTY: Blueprint<[]> = [builder.EMPTY, []];

export function create<A extends any[]>(builder: Builder<A>, ...args: A) {
  return [builder, args];
}
export function build([builder, args]: Blueprint<any>) {
  return builder(...args);
}
export function is<A extends any[]>([builder, _]: Blueprint<A>, other: Builder<A>): boolean {
  return builder === other;
}
export function bundle<A extends any[]>([fn, args]: Blueprint<A>): Builder<A> {
  return builder.bundle(fn, args);
}

