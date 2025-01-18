
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
  eventListenersModule
];
const options = { experimental: { fragments: true } };
export const patch = init(modules, undefined, options);
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
const EMPTY_CLEANUP: Cleanup = () => {};

export function conditional(condition: any, vnode: VNode): VNode | null {
  return !!condition ? vnode : null;
}
export function stateful<T>(state: State<T>, builder: (current: T) => VNode): VNode {
  //console.log("Building with: ", state.get());
  const rebuild = ([from, curr]: [T, T]) => {
    //console.log("Rebuilding with: ", state.get());
    ref.rebuild(() => builder(state.get()));
  };
  let [ref, vnode] = Ref.build(
    () => builder(state.get()),
    state.changed.subscribe(rebuild)
  );
  //return ref.vnode(); // lame traversal here
  return vnode;
}
export function signaled<T>(signals: Signal<T> | Signal<T>[], builder: (arg: T | null | undefined) => VNode): VNode {
  
  let ref: Ref, vnode: VNode;
  const rebuild = (arg: T) => ref.rebuild(() => builder(arg));
  if (Array.isArray(signals)) {
    [ref, vnode] = Ref.build(
      builder as any,
      Signal.group(...signals.map(signal => signal.subscribe(rebuild)))
    );
  } else {
    [ref, vnode] = Ref.build(
      builder as any,
      signals.subscribe(rebuild)
    );
  }
  
  return vnode;
}
export function contained<T = void>(builder: (rerender: () => void) => VNode) {
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
export function cleanup(callback: Cleanup) {
  // staples a cleanup function to the most relevant ref in the tree
  Ref.addCleanup(callback);
}

class Ref {
  
  /* This is used to pass an evil secret argument to the stateful node functions */
  private static stack: Ref[] = [];
  
  node: VNode | Ref = null as unknown as VNode;
  cleanups: Cleanup[] | null = [];
  children: Ref[] = [];
  
  constructor(node: VNode | Ref = null as unknown as VNode) {
    this.node = node;
    /*this.cleanup = [];
    this.children = children;*/
  }
  /*private static empty(cleanup: Cleanup): Ref {
    return new Ref(null as unknown as VNode, [], cleanup);
  }*/
  static addCleanup(cleanup: Cleanup) {
    let ref = this.stack.at(-1);
    if (ref === undefined) {
      console.error("attempted to register cleanup function while ref stack empty");
    } else {
      ref.addCleanup(cleanup);
    }
  }
  static build(builder: () => VNode, cleanup: Cleanup | null): [Ref, VNode] {
    let ref = new Ref();
    if (cleanup) ref.addCleanup(cleanup);
    let vnode = ref.build(builder);
    Ref.stack.at(-1)?.children?.push(ref); // add as child of parent
    return [ref, vnode];
  }
  
  addCleanup(cleanup: Cleanup) {
    if (this.cleanups === null) {
      console.error("added cleanup to destroyed ref");
    } else {
      this.cleanups.push(cleanup);
    }
  }
  
  build(builder: () => VNode): VNode {
    
    Ref.stack.push(this);
    let vnode = builder();
    Ref.stack.pop();
    
    if (this.children.length === 1 && vnode === this.children[0].vnode()) {
      /* Stacked ref (points to a ref rather than a vnode) */
      this.node = this.children.pop()!;
      return vnode;
    } else {
      return this.node = vnode;
    }
  }
  rebuild(builder: () => VNode) {
    
    //if (this.cleanup == null) return;
    
    let oldVnode = Ref.consume(this.node);
    this.destroyChildren();
    this.children = [];
    
    this.build(builder);
    let tail = this.tail();
    //let vnode = tail.node as VNode;
    //console.log(oldVnode.sel, "->", vnode.sel); 
    
    // this line requires so much faith in SnabbDOM, but it works
    tail.node = patch(oldVnode, tail.node as VNode);
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
      
      for (const cleanup of this.cleanups)
        cleanup();
      this.cleanups = null;
    }
    
    this.destroyChildren();
    
    if (this.node instanceof Ref)
      return this.node.destroy();
    else
      return this.node;
  }
  destroyChildren() {
    for (const child of this.children)
      child.destroy();
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



