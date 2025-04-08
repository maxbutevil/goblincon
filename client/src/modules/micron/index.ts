

import Signal from "./signal"
import State from "./state"
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
export function s<T>(s: State<T>, builder: Builder<[T]>): VNode;
export function s<T extends any[]>(s: Signal<T>, builder: Builder<T | []>): VNode;
export function s<T extends any[]>(s: Signal<T>[], builder: Builder<T | []>): VNode;
export function s(builder: Builder<[() => void]>): VNode;
export function s(p: Projector): VNode;
export function s(p: Nav): VNode;
export function s(
  d: State<any> | Signal<any> | Signal<any>[] | Builder<[() => void]> | Projector | Nav,
  builder?: Builder<any> | undefined
) {
  if (Array.isArray(d)) {
    if (d.length === 0 || d[0] === undefined) {
      console.error("Building stateful component with empty array of dependencies");
      return (builder as Builder<any>)(); // no reason to change
    } else {
      return multiSignaled(d, builder as Builder<any>);
    }
  } else {
    if (d instanceof State) {
      return stateful(d, builder as Builder<any>);
    } else if (d instanceof Signal) {
      return monoSignaled(d, builder as Builder<any>);
    } else if (d instanceof Projector) {
      return projected(d);
    } else if (d instanceof Nav) {
      return navigated(d);
    } else if (typeof d === "function") {
      return contained(d);
    }
  }
}

/* Specific kinds of stateful nodes */
/* Not recommended to use these, but they're slightly more efficient */
export function projected(projector: Projector): VNode {
  return monoSignaled<[Builder]>(
    projector.signal,
    (builder) => (builder ?? projector.initial)()
  );
}
export function navigated(navigator: Nav): VNode {
  return stateful(
    navigator.state,
    (builder) => builder()
  );
}
export function stateful<T>(state: State<T>, builder: (curr: T) => VNode): VNode {
  const rebuild = (_from: T, _curr: T) => {
    ctx.rebuild(() => builder(state.get()));
  };
  let [ctx, vnode] = Ctx.build(
    () => builder(state.get()),
    state.changed.subscribe(rebuild)
  );
  return vnode;
}

export function signaled<T extends any[]>(signals: Signal<T> | Signal<T>[], builder: Builder<T | []>): VNode {
  if (Array.isArray(signals)) {
    return multiSignaled(signals, builder);
  } else {
    return monoSignaled(signals, builder);
  }
}
export function monoSignaled<T extends any[]>(signal: Signal<T>, builder: Builder<T>) {
  let ctx: Ctx, vnode: VNode;
  const rebuild = (...args: T) => ctx.rebuild(() => builder(...args));
  [ctx, vnode] = Ctx.build(
    builder as () => VNode,
    signal.subscribe(rebuild)
  );
  return vnode;
}
export function multiSignaled<T extends any[]>(signals: Signal<T>[], builder: Builder<T | []>): VNode {
  let ctx: Ctx, vnode: VNode;
  const rebuild = (...args: T) => ctx.rebuild(() => builder(...args));
  [ctx, vnode] = Ctx.build(
    builder as Builder,
    Signal.bundle(...signals.map(signal => signal.subscribe(rebuild)))
  );
  return vnode;
}

export function contained(builder: (rerender: () => void) => VNode) {
  // "self contained" stateful vnode
  // rerenders itself rather than responding to external state
  let ctx: Ctx, vnode: VNode;
  const _builder = () => builder(rerender);
  const rerender = () => {
    ctx.rebuild(_builder);
  };
  [ctx, vnode] = Ctx.build(_builder, null);
  return vnode;
}

/* In-node Utility Functions */
/* Are we currently building a ctx? */
/*export function hasContext(): boolean {
  return Ctx.hasContext();
}*/
/* Registers a callback to be executed when the containing ctx rerenders or is destroyed */
export function defer(...callbacks: Cleanup[]) {
  Ctx.defer(...callbacks);
}
/* Registers a callback to be executed when the containing ctx is destroyed */
// Prefer using defer when possible
// Will NOT be registered after the initial build, to avoid re-registering the same callback
// For this reason, conditionally registering cleanup functions is an anti-pattern
export function cleanup(...callbacks: Cleanup[]) {
  Ctx.cleanup(...callbacks);
}
export function maybeDefer(...callbacks: Cleanup[]) {
  if (Ctx.exists()) Ctx.defer(...callbacks);
}
export function maybeCleanup(...callbacks: Cleanup[]) {
  if (Ctx.exists()) Ctx.cleanup(...callbacks);
}

/* These are likely to change */
export function timeout(ms: number, callback: () => void): NodeJS.Timeout {
  const timeout = setTimeout(callback, ms);
  Ctx.defer(() => clearTimeout(timeout));
  return timeout;
}
export function interval(ms: number, callback: () => void): NodeJS.Timer {
  const interval = setInterval(callback, ms);
  Ctx.defer(() => clearInterval(interval));
  return interval;
}
