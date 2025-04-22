



import Signal from "./signal"
import State from "./state"
export { Signal, State };


import {
  patch,
  
  h,
  VNode,
  VNodeChildren,
  VNodeChildElement,
} from "./snabbdom";
export {
  h,
};
export type {
  VNode,
  VNodeChildren,
  VNodeChildElement,
};

export type Cleanup = () => void;
export type Builder<A extends any[] = []> = (...args: A) => VNode;


/* Internal debug functions for dumping state of VNode tree to the console */
function dump(vnode: VNode, err = false) {
  
  function inner(vnode: VNodeChildElement, out: string[], depth: number) {
    if (typeof vnode !== "object" || vnode instanceof Number || vnode instanceof String || vnode === null) {
      out.push(`"${vnode}"`);
      return;
    }
    const tag = document.contains(vnode.elm!) ? " (+)" : "";
    out.push(`${"-".repeat(depth)}${vnode.sel}${tag}`);
    if (vnode.children) {
      for (const child of vnode.children)
        inner(child, out, depth + 1);
    }
  }
  
  const out: string[] = [];
  inner(vnode, out, 0);
  (err ? console.error : console.warn)(out.join("\n"))
}
function dumpErr(vnode: VNode) {
  dump(vnode, true);
}

export default class Ctx {
  
  /* This is used to pass evil secret arguments to the stateful node functions */
  protected static stack: Ctx[] = [];
  //protected static initialBuild = false;
  
  node: VNode | null = null;
  children?: Ctx[];
  deferred?: Cleanup[];
  
  static exists(): boolean {
    return this.stack.length > 0;
  }
  static get(): Ctx | undefined {
    return this.stack.at(-1);
  }
  static create(builder: Builder, cleanup: Cleanup | null): [Ctx, VNode] {
    const ctx = new Ctx();
    // add as child of parent
    const parent = Ctx.get();
    if (parent) {
      if (cleanup) parent.defer(cleanup);
      (parent.children ??= []).push(ctx);
    }
    
    ctx.node = ctx.build(builder);
    return [ctx, ctx.node];
  }
  
  defer(...callbacks: Cleanup[]) {
    (this.deferred ??= []).push(...callbacks);
  }
  
  build(builder: Builder): VNode {
    Ctx.stack.push(this);
    const vnode = builder();
    Ctx.stack.pop();
    return vnode;
  }
  rebuild(builder: Builder) {
    
    if (this.node === null) {
      console.warn("ctx attempted to rebuild after being destroyed");
      return;
    }
    
    this.clear();
    const oldVnode = this.node;
    const newVnode = this.build(builder);
    try {
      patch(oldVnode, newVnode);
      
      /*
      console.log("patched:", newVnode.sel);
      dump(oldVnode);
      dump(newVnode);
      */
      
      // This appeases SnabbDOM and lets it do proper DOM updates in the future
      // It's necessary because ancestors of this Ctx will hold a reference to the VNode tree
      // Their copy of the VNode tree will not be updated when this one rerenders
      // The outdated VNode tree will cause SnabbDOM to break on rerender
      // We get around this by putting our new node into the existing VNode tree
      oldVnode.elm = newVnode.elm;
      oldVnode.data = newVnode.data;
      oldVnode.children = newVnode.children;
      
      oldVnode.key = newVnode.key;
      oldVnode.sel = newVnode.sel;
      oldVnode.text = newVnode.text;
    } catch(e) {
      console.error("error patching:", newVnode.sel);
      console.error(e);
      dumpErr(oldVnode);
      dumpErr(newVnode);
    }
  }
  clear() {
    if (this.children) {
      for (const child of this.children)
        child.destroy();
      this.children = undefined;
    }
    if (this.deferred) {
      for (const callback of this.deferred)
        callback();
      this.deferred = undefined;
    }
  }
  destroy() {
    if (this.node === null) {
      console.warn("ctx destroyed after it has already been destroyed, or before it has initialized");
      return;
    }
    
    this.clear();
    this.node = null;
  }
}