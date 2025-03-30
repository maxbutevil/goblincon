

import Signal from "./signal"
import State from "./state"
export { Signal, State };

import {
  init,
  classModule,
  styleModule,
  attributesModule,
  eventListenersModule,
  
  h,
  VNode,
  VNodeChildren,
  VNodeChildElement,
} from "snabbdom";
export {
  h,
};
export type {
  VNode,
  VNodeChildren,
  VNodeChildElement,
};

/* SnabbDOM config */
const patch = init([
  classModule,
  styleModule,
  attributesModule,
  eventListenersModule,
], undefined, {
  //experimental: { fragments: true }
});
export function mount(vnode: VNode, id = "root") {
  let element = document.getElementById(id);
  if (element == null) {
    console.error(`Error in mount(): element with id ${id} does not exist`);
    return null;
  }
  return patch(element, vnode);
}

type Cleanup = () => void;
type Builder<A extends any[] = []> = (...args: A) => VNode;

/* Exposed constructors */
export function projector<A extends any[]>(initialBuilder: (...args: A) => VNode, ...initialArgs: A) {
  if (initialArgs.length === 0) {
    return new Projector(initialBuilder);
  } else {
    return new Projector(() => initialBuilder(...initialArgs));
  }
}
export function persistor<A extends any[]>(initialBuilder: (...args: A) => VNode, ...initialArgs: A) {
  if (initialArgs.length === 0) {
    return new Persistor(initialBuilder);
  } else {
    return new Persistor(() => initialBuilder(...initialArgs));
  }
}



/* Lets us more-easily create clean short-circuiting conditional expressions */
// Eg: c(condition && h("!"))
export function c<T extends {} = VNode>(exp: T | null | undefined | boolean | number | string): T | undefined {
  return (exp !== null && typeof exp === "object") ? exp : undefined;
}

/* General function for all stateful nodes */
export function s<T>(s: State<T>, builder: Builder<[T]>): VNode;
export function s<T extends any[]>(s: Signal<T>, builder: Builder<T | []>): VNode;
export function s<T extends any[]>(s: Signal<T>[], builder: Builder<T | []>): VNode;
export function s(builder: Builder<[() => void]>): VNode;
export function s(p: Projector): VNode;
export function s(p: Persistor): VNode;
export function s(
  d: State<any> | Signal<any> | Signal<any>[] | Builder<[() => void]> | Projector | Persistor,
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
    } else if (d instanceof Persistor) {
      return persisted(d);
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
export function persisted(persistor: Persistor): VNode {
  return stateful(
    persistor.state,
    (builder) => builder()
  );
}
export function stateful<T>(state: State<T>, builder: (curr: T) => VNode): VNode {
  const rebuild = (_from: T, _curr: T) => {
    ref.rebuild(() => builder(state.get()));
  };
  let [ref, vnode] = Ref.build(
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
  let ref: Ref, vnode: VNode;
  const rebuild = (...args: T) => ref.rebuild(() => builder(...args));
  [ref, vnode] = Ref.build(
    builder as () => VNode,
    signal.subscribe(rebuild)
  );
  return vnode;
}
export function multiSignaled<T extends any[]>(signals: Signal<T>[], builder: Builder<T | []>): VNode {
  let ref: Ref, vnode: VNode;
  const rebuild = (...args: T) => ref.rebuild(() => builder(...args));
  [ref, vnode] = Ref.build(
    builder as Builder,
    Signal.bundle(...signals.map(signal => signal.subscribe(rebuild)))
  );
  return vnode;
}

export function contained(builder: (rerender: () => void) => VNode) {
  // "self contained" stateful vnode
  // rerenders itself rather than responding to external state
  let ref: Ref, vnode: VNode;
  const _builder = () => builder(rerender);
  const rerender = () => {
    ref.rebuild(_builder);
  };
  [ref, vnode] = Ref.build(_builder, null);
  return vnode;
}

/* In-node Utility Functions */
/* Registers a callback to be executed when the containing ref rerenders or is destroyed */
export function defer(...callbacks: Cleanup[]) {
  Ref.addDeferred(...callbacks);
}
/* Registers a callback to be executed when the containing ref is destroyed */
// Will NOT be registered after the initial build, to avoid re-registering the same callback
// For this reason, conditionally registering cleanup functions is an anti-pattern
export function cleanup(...callbacks: Cleanup[]) {
  Ref.addCleanup(...callbacks);
}

/* Internal debug functions for dumping state of VNode tree to the console */
/* Currently unused */
function dump(vnode: VNode, err = false) {
      
  function inner(vnode: VNode | string, out: string[], depth: number) {
    if (typeof vnode === "string") {
      out.push(`"${vnode}"`);
      return;
    }
    let tag = document.contains(vnode.elm!) ? " (+)" : "";
    out.push(`${"-".repeat(depth)}${vnode.sel}${tag}`);
    if (vnode.children) {
      for (const child of vnode.children)
        inner(child, out, depth + 1);
    }
  }
  
  let out: string[] = [];
  inner(vnode, out, 0);
  (err ? console.error : console.warn)(out.join("\n"))
}
function dumpErr(vnode: VNode) {
  dump(vnode, true);
}


class Ref {
  
  /* This is used to pass evil secret arguments to the stateful node functions */
  private static stack: Ref[] = [];
  private static isInitialBuild = false;
  
  node: VNode | Ref = null as unknown as VNode;
  children?: Ref[];
  deferreds?: Cleanup[];
  cleanups?: Cleanup[] | null; // null = this node has been cleaned up
  
  constructor(node: VNode | Ref = null as unknown as VNode) {
    this.node = node;
  }
  static addDeferred(...callbacks: Cleanup[]) {
    let ref = this.stack.at(-1);
    if (ref === undefined) {
      console.error("attempted to register deferred callback while ref stack empty");
      return;
    }
    
    ref.addDeferred(...callbacks);
  }
  static addCleanup(...callbacks: Cleanup[]) {
    let ref = this.stack.at(-1);
    if (ref === undefined) {
      console.error("attempted to register cleanup callback while ref stack empty");
      return;
    }
    
    if (Ref.isInitialBuild) {
      // cleanup callbacks should only be added on the initial build, NOT on rebuilds
      ref.addCleanup(...callbacks);
    }
  }
  static build(builder: () => VNode, cleanup: Cleanup | null): [Ref, VNode] {
    let ref = new Ref();
    if (cleanup) ref.addCleanup(cleanup);
    
    Ref.isInitialBuild = true;
    let vnode = ref.build(builder);
    Ref.isInitialBuild = false;
    
    // add as child of parent
    let parent = Ref.stack.at(-1);
    if (parent) (parent.children ??= []).push(ref);
    
    return [ref, vnode];
  }
  
  addDeferred(...callbacks: Cleanup[]) {
    (this.deferreds ??= []).push(...callbacks);
  }
  addCleanup(...callbacks: Cleanup[]) {
    if (this.cleanups === null) {
      console.error("added cleanup to destroyed ref");
    } else {
      (this.cleanups ??= []).push(...callbacks);
    }
  }
  
  build(builder: () => VNode): VNode {
    
    Ref.stack.push(this);
    let vnode = builder();
    Ref.stack.pop();
    
    /* Check if ref is stacked (points to another ref rather than a vnode) */
    if (this.children && this.children.length === 1) {
      if (vnode === this.children[0].vnode()) {
        this.node = this.children[0];
        this.children = undefined;
        return vnode;
      }
    }
    
    return this.node = vnode;
  }
  rebuild(builder: () => VNode) {
    
    if (this.cleanups === null) {
      console.warn("Ref attempted to rebuild after being destroyed.");
      return;
    }
    
    //if (this.cleanup == null) return;
    
    let oldVnode = Ref.consume(this.node);
    if (this.children) {
      this.destroyChildren();
      this.children = undefined;
    }
    if (this.deferreds) {
      for (const callback of this.deferreds)
        callback();
      this.deferreds = undefined;
    }
    
    let newVnode = this.build(builder);
    let tail = this.tail();
    try {
      
      patch(oldVnode, newVnode);
      
      /*
      console.log("patched:", newVnode.sel);
      dump(oldVnode);
      dump(newVnode);
      */
      
      // This appeases SnabbDOM and lets it do proper DOM updates in the future
      // It's necessary because ancestors of this Ref will hold a reference to the VNode tree
      // Their copy of the VNode tree will not be updated when this one rerenders
      // The outdated VNode tree will cause SnabbDOM to break on rerender
      // We get around this by putting our new node into the existing VNode tree
      oldVnode.elm = newVnode.elm;
      oldVnode.data = newVnode.data;
      oldVnode.children = newVnode.children;
      
      oldVnode.key = newVnode.key;
      oldVnode.sel = newVnode.sel;
      oldVnode.text = newVnode.text;
      tail.node = oldVnode; // Not sure if necessary
    } catch(e) {
      console.error("error patching:", newVnode.sel);
      console.error(e);
      dumpErr(oldVnode);
      dumpErr(newVnode);
    }
  }
  static consume(curr: Ref | VNode): VNode {
    if (curr instanceof Ref) {
      return curr.destroy();
    } else {
      return curr;
    }
  }
  destroy(): VNode {
    if (this.cleanups === null) {
      console.warn("ref destroyed after it has already cleaned up");
    } else {
      
      /*if (VERBOSE) {
        if (this.node instanceof Ref)
          console.log(`reference cleaning up (stacked)`);
        else
          console.log(`reference cleaning up (${this.node.sel})`);
      }*/
      
      if (this.deferreds) {
        for (const callback of this.deferreds)
          callback();
      }
      if (this.cleanups) {
        for (const callback of this.cleanups)
          callback();
      }
      this.cleanups = null;
    }
    
    this.destroyChildren();
    
    if (this.node instanceof Ref)
      return this.node.destroy();
    else
      return this.node;
  }
  destroyChildren() {
    if (this.children) {
      for (const child of this.children)
        child.destroy();
    }
  }
  tail(): Ref {
    if (this.node instanceof Ref)
      return this.node.tail();
    return this;
  }
  vnode(): VNode {
    if (this.node instanceof Ref)
      return this.node.vnode();
    return this.node;
  }
  
}

const EMPTY_BUILDER = () => h("!");

class Projector {
  
  readonly signal = new Signal<[Builder]>();
  readonly initial: Builder;
  
  constructor(initialBuilder: Builder) {
    this.initial = initialBuilder;
  }
  put<A extends any[]>(builder: (...args: A) => VNode, ...builderArgs: A) {
    if (builderArgs.length === 0) {
      this.signal.emit(builder);
    } else {
      this.signal.emit(() => builder(...builderArgs));
    }
  }
  clear() {
    this.signal.emit(EMPTY_BUILDER);
  }
  reset() {
    this.signal.emit(this.initial);
  }
}
class Persistor {
  
  readonly state: State<Builder>;
  
  constructor(initialBuilder: Builder) {
    this.state = new State(initialBuilder);
  }
  put<A extends any[]>(builder: (...args: A) => VNode, ...builderArgs: A) {
    if (builderArgs.length === 0) {
      this.state.set(builder);
    } else {
      this.state.set(() => builder(...builderArgs));
    }
  }
  clear() {
    this.state.set(EMPTY_BUILDER);
  }
}