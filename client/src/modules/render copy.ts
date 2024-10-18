

import {
  init,
  classModule,
  propsModule,
  styleModule,
  attributesModule,
  datasetModule,
  eventListenersModule,
  Module,
  
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

//type OldVNode = VNode | Element | DocumentFragment;

//const INHERIT = Symbol("INHERIT CLEANUP");
//type Cleanup = typeof INHERIT | (() => void);

/*const refModule: Module = {
  update: (oldVnode, vnode) => {
    const oldRef = Ref.of(oldVnode);
    const newRef = Ref.of(vnode);
    if (oldRef !== undefined && oldRef !== newRef) {
      //console.log("Cleaning up (ref changed)");
      //Ref.consume(oldRef);
    }
  },
  destroy: (vnode) => {
    const ref = Ref.of(vnode);
    if (ref !== undefined) {
      //console.log("Cleaning up (vnode destroyed)")
      //Ref.consume(ref);
    }
  }
};*/
export const patch = init([
  classModule,
  propsModule,
  styleModule,
  //datasetModule,
  //attributesModule,
  eventListenersModule,
  //refModule
], undefined, {
  experimental: {
    fragments: true
  }
});
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
  //let node: VNode;
  let node = builder(state.get());
  //console.log("building with: ", state.get());
  let ref = Ref.to(node, state.changed.subscribe(([from, curr]) => {
    //console.log("rebuilding with: ", curr);
    ref.patch(builder(curr));
  }));
  
  //console.log(Ref.of(node)!.node);
  return node;
}
export function signaled<T>(signals: Signal<T> | Signal<T>[], builder: () => VNode): VNode {
  let node = builder();
  let ref: Ref;
  
  const rebuild = () => ref.patch(builder());
  
  if (Array.isArray(signals)) {
    ref = Ref.to(node, Signal.group(
      ...signals.map(signal => signal.subscribe(rebuild))
    ));
  } else {
    ref = Ref.to(node, signals.subscribe(rebuild));
  }
  
  return node;
}
export function cleaned(cleanup: Cleanup, vnode: VNode): VNode {
  /* No clue if this works, probably best not to use it... */
  Ref.to(vnode, cleanup);
  return vnode;
}


type Cleanup = () => void;

class Ref {
  
  node: VNode | Ref;
  private cleanupCallback: Cleanup | null;
  
  constructor(node: VNode | Ref, cleanup: () => void) {
    this.node = node;
    this.cleanupCallback = cleanup;
  }
  
  static of(vnode: VNode): Ref | undefined {
    return vnode.data?.props?.ref;
  }
  static to(vnode: VNode, cleanup: Cleanup): Ref {
    vnode.data ??= {};
    vnode.data.props ??= {};
    //console.log("old ref = ", vnode.data.props.ref)
    //console.log(vnode.data.props.ref ?? vnode);
    return vnode.data.props.ref = new Ref(vnode.data.props.ref ?? vnode, cleanup);
  }
  static consume(curr: Ref | VNode): VNode {
    if (curr instanceof Ref) {
      curr.cleanup();
      return Ref.consume(curr.node);
    } else {
      return curr;
    }
  }
  
  cleanup() {
    console.log("reference cleaning up");
    if (this.cleanupCallback !== null) {
      this.cleanupCallback();
      this.cleanupCallback = null;
    }
  }
  patch(vnode: VNode) {
    let oldVnode = Ref.consume(this.node);
    let ref = Ref.of(vnode);
    vnode.data ??= {};
    vnode.data.props ??= {};
    vnode.data.props.ref = Ref.of(oldVnode);
    let newVnode = patch(oldVnode, vnode);
    this.node = ref ?? newVnode;
  }
  /*tail(): Ref {
    if (this.node instanceof Ref)
      return this.node.tail();
    return this;
  }*/
  vnode(): VNode {
    if (this.node instanceof Ref)
      return this.node.vnode();
    return this.node;
  }
  
}










