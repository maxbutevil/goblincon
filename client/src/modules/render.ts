
import Signal from "./signal"
import State from "./state"
import {
  init,
  classModule,
  styleModule,
  attributesModule,
  eventListenersModule,
  
  h,
  //fragment,
  VNode,
  VNodeChildren,
  VNodeChildElement,
} from "snabbdom";
export {
  h,
  //fragment,
};
export type {
  VNode,
  VNodeChildren,
  VNodeChildElement,
};


const VERBOSE = false;
const modules = [
  classModule,
  styleModule,
  attributesModule,
  eventListenersModule,
  
];
//const options = { experimental: { fragments: true } };
export const patch = init(modules);
export function patchId(id: string, vnode: VNode): VNode | null {
  let element = document.getElementById(id);
  if (element == null) {
    console.error(`Error in patchId(): element with id ${id} does not exist`);
    return null;
  }
  return patch(element, vnode);
}
export function patchRoot(vnode: VNode): VNode {
  return patchId("root", vnode)!; /* Maybe shouldn't assume root exists */
}

type Cleanup = () => void;
//const EMPTY_CLEANUP: Cleanup = () => {};

export function conditional(condition: any, vnode: VNode): VNode | null {
  return !!condition ? vnode : null;
}

type Builder<A extends any[] = []> = (...args: A) => VNode;
type ContainedBuilder = Builder<[() => void]>;
//type Projector = Signal<() => VNode>;

export function s<T>(s: State<T>, builder: Builder<[T]>): VNode;
//export function s<T>(s: State<T>[], builder: (curr: T) => VNode): VNode;
export function s<T>(s: Signal<T>, builder: Builder<[T | undefined]>): VNode;
export function s<T>(s: Signal<T>[], builder: Builder<[T | undefined]>): VNode;
export function s(builder: Builder<[() => void]>): VNode;
export function s(p: Projector): VNode;
export function s<T>(
  d: State<T> | Signal<T> | Signal<T>[] | Builder<[() => void]> | Projector,
  builder?: Builder<[T]> | Builder<[T | undefined]> | undefined
) {
  if (d instanceof State) {
    return stateful(d, builder as any);
  } else if (d instanceof Projector) {
    return projected(d);
  } else if (typeof d == "function") {
    return contained(d);
  } else if (Array.isArray(d)) {
    return multiSignaled(d, builder as Builder<[T | undefined]>);
  } else {
    return monoSignaled(d, builder as Builder<[T | undefined]>);
  }
}


/*export function projector(initialBuilder: Builder<void> = () => h("!")): Projector {
  return new Projector(initialBuilder);
}*/

//put<A extends any[]>(builder: (...args: A) => VNode, ...args: A): void;
export function projector<A extends any[]>(initialBuilder: (...args: A) => VNode, ...initialArgs: A) {
  if (initialArgs.length === 0) {
    return new Projector(initialBuilder);
  } else {
    return new Projector(() => initialBuilder(...initialArgs))
  }
}
//export function 



export function projected(projector: Projector): VNode {
  return monoSignaled(
    projector,
    (builder) => (builder ?? projector.initialBuilder)()
  );
}
export function stateful<T>(state: State<T>, builder: (curr: T) => VNode): VNode {
  //console.log("Building with:", state.get());
  const rebuild = ([_from, _curr]: [T, T]) => {
    //console.log("Rebuilding with:", state.get());
    ref.rebuild(() => builder(state.get()));
  };
  let [ref, vnode] = Ref.build(
    () => builder(state.get()),
    state.changed.subscribe(rebuild)
  );
  //return ref.vnode(); // lame traversal here
  return vnode;
}

function monoSignaled<T>(signal: Signal<T>, builder: Builder<[T | undefined]>) {
  let ref: Ref, vnode: VNode;
  const rebuild = (arg: T) => ref.rebuild(() => builder(arg));
  [ref, vnode] = Ref.build(
    builder as () => VNode,
    signal.subscribe(rebuild)
  );
  return vnode;
}
function multiSignaled<T>(signals: Signal<T>[], builder: Builder<[T | undefined]>): VNode {
  let ref: Ref, vnode: VNode;
  const rebuild = (arg: T) => ref.rebuild(() => builder(arg));
  [ref, vnode] = Ref.build(
    builder as () => VNode,
    Signal.bundle(...signals.map(signal => signal.subscribe(rebuild)))
  );
  return vnode;
}
export function signaled<T>(signals: Signal<T> | Signal<T>[], builder: Builder<[T | undefined]>): VNode {
  if (Array.isArray(signals)) {
    return multiSignaled(signals, builder);
  } else {
    return monoSignaled(signals, builder);
  }
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
export function cleaned(cleanup: Cleanup, builder: () => VNode): VNode {
  let [_ref, vnode] = Ref.build(builder, cleanup);
  return vnode;
}


export function defer(callback: Cleanup) {
  /* Registers a callback to be executed when the containing ref is destroyed OR RERENDERS!! */
  Ref.addDeferred(callback);
}
export function cleanup(callback: Cleanup) {
  /* Registers a callback to be executed when the containing ref is destroyed */
  // Will NOT be registered after the initial build, to avoid re-registering the same cleanup callback
  // For this reason, conditionally registering cleanup functions is an anti-pattern
  Ref.addCleanup(callback);
}

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
    /*this.cleanup = [];
    this.children = children;*/
  }
  /*private static empty(cleanup: Cleanup): Ref {
    return new Ref(null as unknown as VNode, [], cleanup);
  }*/
  static addDeferred(callback: Cleanup) {
    let ref = this.stack.at(-1);
    if (ref === undefined) {
      console.error("attempted to register deferred callback while ref stack empty");
      return;
    }
    
    ref.addDeferred(callback);
  }
  static addCleanup(callback: Cleanup) {
    let ref = this.stack.at(-1);
    if (ref === undefined) {
      console.error("attempted to register cleanup callback while ref stack empty");
      return;
    }
    
    if (Ref.isInitialBuild) {
      // cleanup callbacks should only be added on the initial build, NOT on rebuilds
      ref.addCleanup(callback);
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
  
  addDeferred(callback: Cleanup) {
    (this.deferreds ??= []).push(callback);
  }
  addCleanup(callback: Cleanup) {
    if (this.cleanups === null) {
      console.error("added cleanup to destroyed ref");
    } else {
      (this.cleanups ??= []).push(callback);
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
      
      if (VERBOSE) {
        if (this.node instanceof Ref)
          console.log(`reference cleaning up (stacked)`);
        else
          console.log(`reference cleaning up (${this.node.sel})`);
      }
      
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

/*class Stapler extends State<() => VNode> {
  constructor(initial: () => VNode) {
    super(initial);
  }
  set<A extends any[]>(builder: (...args: A) => VNode, ...args: A) {
    if (args.length === 0) {
      super.set(builder);
    } else {
      super.set(() => builder(...args));
    }
  }
}*/
class Projector extends Signal<() => VNode> {
  
  initialBuilder: () => VNode;
  constructor(initialBuilder: () => VNode) {
    super();
    this.initialBuilder = initialBuilder;
  }
  put<A extends any[]>(builder: (...args: A) => VNode, ...args: A) {
    if (args.length === 0) {
      this.emit(builder);
    } else {
      this.emit(() => builder(...args));
    }
  }
  clear() {
    this.emit(() => h("!"));
  }
  reset() {
    this.emit(this.initialBuilder);
  }
}
/*class Projector2 extends Signal<() => VNode> {
  current: () => VNode;
  constructor(current: () => VNode) {
    this.current = current;
  }
  put<A extends any[]>(builder: (...args: A) => VNode, ...args: A) {
    if (args.length === 0) {
      this.set(builder);
    } else {
      this.set();
    }
  }
}*/
