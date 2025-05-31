
import * as builder from "./builder"
import { Builder } from "./builder"
import * as blueprint from "./blueprint"
import { Blueprint } from "./blueprint"

import Signal from "./signal"
import State, { Shard } from "./state"
import Ctx, { Cleanup } from "./ctx"
export { builder, blueprint, Signal, State, Ctx };
export type { Builder, Blueprint };

import {
  Projector,
  Anchor,
  Stack
} from "./projector"
export {
  Projector, projector,
  Anchor, anchor,
  Stack, stack
} from "./projector";

import { Test } from "./test"
export { Test, test } from "./test"

import {
  //patch,
  mount,
  
  h,
  VNode,
  VNodeChildren,
  VNodeChildElement,
  VNodeData
} from "./snabbdom";
export {
  h,
  mount
};
export type {
  VNode as Node,
  VNodeData as NodeData,
  VNodeChildElement as Child,
  VNodeChildren as Children,
  //Attrs as Attrs,
};



/* Lets us more-easily create clean short-circuiting conditional expressions */
// Eg: c(condition && h("!"))
export function c(exp: VNode | null | undefined | boolean | number | string): VNode | undefined {
  return (exp !== null && typeof exp === "object") ? exp : undefined;
}

/* General function for all stateful nodes */
export function s<T>(s: State<T>, builder: Builder<[T, T | undefined]>): VNode;
export function s<T>(s: Shard<T>, builder: Builder<[T, T | undefined]>): VNode;
export function s<T extends any[]>(s: Signal<T>, builder: Builder<T | { [key in keyof T]: undefined }>): VNode;
export function s<T extends any[]>(s: Signal<T>[], builder: Builder<T | { [key in keyof T]: undefined }>): VNode;
export function s(p: Projector): VNode;
export function s(p: Anchor): VNode;
export function s(p: Stack): VNode;
export function s(p: Test): VNode;
export function s<T>(p: Promise<T>, builder: PromiseBuilder<T>): VNode;
export function s(builder: Builder<[() => void]>): VNode;
export function s(
  d: State<any> | Shard<any> | Signal<any> | Signal<any>[] | Builder<[() => void]> | Projector | Anchor | Stack | Test | Promise<any>,
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
    } else if (d instanceof Anchor) {
      return anchorView(d);
    } else if (d instanceof Stack) {
      return stackView(d);
    } else if (d instanceof Test) {
      return testView(d);
    } else if (d instanceof Promise) {
      return promiseView(d, builder);
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

export function stateView<T>(state: State<T>, builder: Builder<[curr: T, from: T | undefined]>): VNode {
  return baseView(state.changed, builder, state.get(), undefined); // no "from" value yet
}
export function shardView<T>(shard: Shard<T>, builder: Builder<[curr: T, from: T | undefined]>): VNode {
  return baseView(shard, builder, shard.get(), undefined); // no "from" value yet
}
export function signalView<T extends any[]>(signal: Signal<T>, builder: Builder<T | []>) {
  return baseView(signal, builder);
}
export function multiSignalView<T extends any[]>(signals: Signal<T>[], builder: Builder<T | []>): VNode {
  return baseMultiView(signals, builder);
}
export function projectorView(projector: Projector): VNode {
  return baseView(
    projector.changed,
    (builder) => builder(),
    projector.initial
  );
}
export function anchorView(anchor: Anchor): VNode {
  return baseView(
    anchor.changed,
    (bp) => blueprint.build(bp),
    anchor.curr
  );
}
export function stackView(stack: Stack): VNode {
  return baseView(
    stack.changed,
    (bp) => blueprint.build(bp),
    stack.curr
  );
}
export function testView(test: Test) {
  
  function log() {
    console.info(test.getNavString());
  }
  
  tryDefer(
    test.handleDestroy.bind(test),
    test.changed.subscribe(log),
    Signal.keydown.subscribe(ev => {
      if (ev.key === "ArrowLeft") {
        test.prev();
      } else if (ev.key === "ArrowRight") {
        test.next();
      }
    })
  );
  
  test.handleCreate();
  log();
  
  return baseView(
    test.changed,
    () => blueprint.build(test.getBlueprint())
  );
}



// experimental
type PromiseBuilder<T> = Builder<["ok", T] | ["err", any] | ["pending", undefined]>;
export function promiseView<T>(promise: Promise<T>, builder: PromiseBuilder<T>): VNode {
  let [ctx, vnode] = Ctx.create(() => builder("pending", undefined), null);
  
  promise.then(
    val => ctx.rebuild(() => builder("ok", val)),
    err => ctx.rebuild(() => builder("err", err)) // I kind of hate promises, wow
  );
  return vnode;
}

/* In-node Utility Functions */
/*export function ctx(): Ctx | undefined {
  return Ctx.get();
}*/
/* Registers a callback to be executed when the containing ctx rerenders or is destroyed */
export function defer(...callbacks: Cleanup[]): boolean {
  if (!tryDefer(...callbacks)) {
    console.error("called defer() without a valid containing context (consider using tryDefer() instead)");
    return false;
  }
  return true;
}
export function tryDefer(...callbacks: Cleanup[]): boolean {
  const ctx = Ctx.get();
  ctx?.defer(...callbacks);
  return ctx != undefined;
}
/*export function merge(vnode: VNode, data: VNodeData) {
  Object.assign(vnode.data ??= {}, data);
}*/
/* Defer, but if we don't have a valid containing context, do nothing instead of erroring */
/*export function maybeDefer(...callbacks: Cleanup[]) {
  Ctx.get()?.defer(...callbacks);
}*/

/* These are likely to change */
/*export function timeout(ms: number, callback: () => void): number {
  const timeout = setTimeout(callback, ms);
  Ctx.get()?.defer(() => clearTimeout(timeout));
  return timeout;
}
export function interval(ms: number, callback: () => void): number {
  const interval = setInterval(callback, ms);
  Ctx.get()?.defer(() => clearInterval(interval));
  return interval;
}*/
