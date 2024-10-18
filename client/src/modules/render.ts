

import {
  init,
  classModule,
  //propsModule,
  styleModule,
  attributesModule,
  eventListenersModule,
  //Module,
  
  h,
  fragment,
  VNode,
  
} from "snabbdom";
export {
  h,
  fragment,
};
export type {
  VNode
};

import Signal from "./signal"
import State from "./state"

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
  return ref.vnode(); // lame traversal here
}
export function signaled<T>(signals: Signal<T> | Signal<T>[], builder: () => VNode): VNode {
  
  let ref: Ref, vnode: VNode;
  const rebuild = () => ref.rebuild(builder);
  if (Array.isArray(signals)) {
    [ref, vnode] = Ref.build(
      builder,
      Signal.group(...signals.map(signal => signal.subscribe(rebuild)))
    );
  } else {
    [ref, vnode] = Ref.build(
      builder,
      signals.subscribe(rebuild)
    );
  }
  
  return vnode;
}
export function contained(builder: (rerender: () => void) => VNode) {
  //let ref: Ref;
  let ref: Ref, vnode: VNode;
  const _builder = () => builder(rerender);
  const rerender = () => {
    ref.rebuild(_builder);
  };
  [ref, vnode] = Ref.build(_builder, () => {});
  return vnode;
}
export function cleaned(cleanup: Cleanup, builder: () => VNode): VNode {
  // No clue if this works, probably best not to use it...
  let [_ref, vnode] = Ref.build(builder, cleanup);
  return vnode;
}
/*export function mount() {
  
}*/

type Cleanup = () => void;


class Ref {
  
  /* This is used to pass an evil secret argument to the stateful node functions */
  private static stack: Ref[] = [];
  
  node: VNode | Ref;
  cleanup: Cleanup | null;
  children: Ref[] = [];
  
  
  constructor(node: VNode | Ref, children: Ref[] = [], cleanup: Cleanup) {
    this.node = node;
    this.cleanup = cleanup;
    this.children = children;
  }
  private static empty(cleanup: Cleanup): Ref {
    return new Ref(null as unknown as VNode, [], cleanup);
  }
  static build(builder: () => VNode, cleanup: Cleanup): [Ref, VNode] {
    let ref = Ref.empty(cleanup);
    let vnode = ref.build(builder);
    Ref.stack.at(-1)?.children?.push(ref); // Add as child of parent
    return [ref, vnode];
  }
  build(builder: () => VNode): VNode {
    Ref.stack.push(this);
    let vnode = builder();
    Ref.stack.pop();
    
    if (this.children.length === 1 && vnode === this.children[0].vnode()) {
      /* Stacked */
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
    
    /* fucked up and evil workaround */
    oldVnode = patch(oldVnode, h("!"));
    tail.node = patch(oldVnode, tail.node as VNode);
  }
  /*static to(vnode: VNode, cleanup: Cleanup): Ref {
    return new Ref(vnode, cleanup);
    //vnode.data ??= {};
    //vnode.data.props ??= {};
    //console.log("old ref = ", vnode.data.props.ref)
    //console.log(vnode.data.props.ref ?? vnode);
    //return vnode.data.props.ref = new Ref(vnode.data.props.ref ?? vnode, cleanup);
  }*/
  static consume(curr: Ref | VNode): VNode {
    if (curr instanceof Ref) {
      return curr.destroy();
    } else {
      return curr;
    }
  }
  destroy(): VNode {
    if (this.cleanup === null) {
      console.warn("ref destroyed after it has already cleaned up");
    } else {
      if (this.node instanceof Ref)
        console.log(`reference cleaning up (stacked)`);
      else
        console.log(`reference cleaning up (${this.node.sel})`);
      
      this.cleanup();
      this.cleanup = null;
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
  /*patch(builder: () => VNode) {
    let oldVnode = Ref.consume(this.node);
    this.rebuild(builder);
    let newVnode = patch(oldVnode, vnode);
    this.node = ref ?? newVnode;
  }*/
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



