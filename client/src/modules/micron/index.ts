

import Signal from "./signal"
import State from "./state"
import { Shard } from "./state"
import Ctx, { Cleanup, Builder } from "./ctx"
export { Signal, State, Ctx };
export type { Cleanup, Builder }; // Probably unnecessary

import { Projector, Nav, projector, navigator } from "./projector"
export { Projector, Nav, projector, navigator };

import {
  //patch,
  mount,
  
  h,
  VNode,
  VNodeChildren,
  VNodeChildElement,
} from "./snabbdom";
export {
  h,
  mount
};
export type {
  VNode,
  VNodeChildren,
  VNodeChildElement,
};



/* Lets us more-easily create clean short-circuiting conditional expressions */
// Eg: c(condition && h("!"))
export function c(exp: VNode | null | undefined | boolean | number | string): VNode | undefined {
  return (exp !== null && typeof exp === "object") ? exp : undefined;
}

/* General function for all stateful nodes */
export function s<T>(s: State<T>, builder: Builder<[T, T | undefined]>): VNode;
export function s<T>(s: Shard<T>, builder: Builder<[T, T | undefined]>): VNode;
export function s<T extends any[]>(s: Signal<T>, builder: Builder<T | []>): VNode;
export function s<T extends any[]>(s: Signal<T>[], builder: Builder<T | []>): VNode;
export function s(builder: Builder<[() => void]>): VNode;
export function s(p: Projector): VNode;
export function s(p: Nav): VNode;
export function s(
  d: State<any> | Shard<any> | Signal<any> | Signal<any>[] | Builder<[() => void]> | Projector | Nav,
  builder?: any
) {
  if (Array.isArray(d)) {
    if (d.length === 0) {
      console.error("stateful node has an empty dependency array");
    }
    return multiSignalView(d, builder as Builder<any>);
  } else {
    if (d instanceof State) {
      return stateView(d, builder as Builder<any>);
    } else if (d instanceof Shard) { // must come before Signal, since Shard inherits from it
      return shardView(d, builder);
    } else if (d instanceof Signal) {
      return signalView(d, builder as Builder<any>);
    } else if (d instanceof Projector) {
      return projectorView(d);
    } else if (d instanceof Nav) {
      return navView(d);
    } else if (typeof d === "function") {
      return containedView(d);
    } else {
      console.error("stateful node has an invalid dependency: ", d);
      return h("!");
    }
  }
}

/* Specific kinds of stateful nodes */
/* Not recommended to use these, but they're slightly more efficient */
export function projectorView(projector: Projector): VNode {
  return baseView(
    projector.signal,
    (builder) => builder(),
    projector.initial
  );
}
export function navView(navigator: Nav): VNode {
  return stateView(
    navigator.state,
    (builder) => builder()
  );
}

function baseView<T extends any[], I extends any[]>(signal: Signal<T>, builder: Builder<T | I>, ...initial: I): VNode {
  const rebuild = (...args: T) => {
    ctx.rebuild(() => builder(...args));
  };
  const [ctx, vnode] = Ctx.create(
    () => builder(...initial),
    signal.subscribe(rebuild)
  );
  return vnode;
};
function baseMultiView<T extends any[], I extends any[]>(signal: Signal<T>[], builder: Builder<T | I>, ...initial: I): VNode {
  const rebuild = (...args: T) => {
    ctx.rebuild(() => builder(...args));
  };
  const [ctx, vnode] = Ctx.create(
    () => builder(...initial),
    Signal.bundle(...signal.map(s => s.subscribe(rebuild)))
  );
  return vnode;
};
export function containedView(builder: (rerender: () => void) => VNode) {
  // "self contained" stateful vnode
  // rerenders itself rather than responding to external state
  let ctx: Ctx, vnode: VNode;
  const cachedBuilder = () => builder(rerender);
  const rerender = () => ctx.rebuild(cachedBuilder);
  [ctx, vnode] = Ctx.create(cachedBuilder, null);
  return vnode;
}

export function stateView<T>(state: State<T>, builder: (curr: T, from: T | undefined) => VNode): VNode {
  return baseView(
    state.changed, 
    builder,
    state.get(),
    undefined // no "from" value yet
  );
}
export function shardView<T>(shard: Shard<T>, builder: (curr: T, from: T | undefined) => VNode): VNode {
  return baseView(shard, builder, shard.get(), undefined);
}
export function signalView<T extends any[]>(signal: Signal<T>, builder: Builder<T | []>) {
  return baseView(signal, builder);
}
export function multiSignalView<T extends any[]>(signals: Signal<T>[], builder: Builder<T | []>): VNode {
  return baseMultiView(signals, builder);
}

/* In-node Utility Functions */
export function ctx(): Ctx | undefined {
  return Ctx.get();
}
/* Registers a callback to be executed when the containing ctx rerenders or is destroyed */
export function defer(...callbacks: Cleanup[]) {
  const ctx = Ctx.get();
  if (ctx) {
    ctx.defer(...callbacks);
  } else {
    console.error("called defer() without a valid containing context (consider using ctx()?.defer() instead)");
  }
}
/* Defer, but if we don't have a valid containing context, do nothing instead of erroring */
/*export function maybeDefer(...callbacks: Cleanup[]) {
  Ctx.get()?.defer(...callbacks);
}*/

/* These are likely to change */
export function timeout(ms: number, callback: () => void): NodeJS.Timeout {
  const timeout = setTimeout(callback, ms);
  Ctx.get()?.defer(() => clearTimeout(timeout));
  return timeout;
}
export function interval(ms: number, callback: () => void): NodeJS.Timer {
  const interval = setInterval(callback, ms);
  Ctx.get()?.defer(() => clearInterval(interval));
  return interval;
}
