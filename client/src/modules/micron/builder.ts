

import { h, VNode } from "./snabbdom"

export type Builder<A extends any[] = []> = (...args: A) => VNode;
export const EMPTY: Builder<[]> = () => h("!");

export function bundle<A extends any[]>(builder: Builder<A>, args: A): Builder {
  if (args.length === 0) {
    return builder;
  } else {
    return () => builder(...args);
  }
}
