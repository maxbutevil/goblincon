



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

export default class Ctx {
  
  /* This is used to pass evil secret arguments to the stateful node functions */
  private static stack: Ctx[] = [];
  private static initialBuild = false;
  
  node: VNode | Ctx = null as unknown as VNode;
  children?: Ctx[];
  deferreds?: Cleanup[];
  cleanups?: Cleanup[] | null; // null = this node has been cleaned up
  
  constructor(node: VNode | Ctx = null as unknown as VNode) {
    this.node = node;
  }
  static exists(): boolean {
    return this.stack.length > 0;
  }
  static get(): Ctx | undefined {
    return this.stack.at(-1);
  }
  static isInitialBuild(): boolean {
    return this.initialBuild;
  }
  static defer(...callbacks: Cleanup[]) {
    const ctx = this.get();
    if (ctx === undefined) {
      console.error("called Ctx.defer() with no valid context");
      return;
    }
    ctx.defer(...callbacks);
  }
  static cleanup(...callbacks: Cleanup[]) {
    let ctx = this.stack.at(-1);
    if (ctx === undefined) {
      console.error("attempted to register cleanup callback while ctx stack empty");
      return;
    }
    
    if (Ctx.initialBuild) {
      // cleanup callbacks are only added on the initial build, NOT on rebuilds
      ctx.cleanup(...callbacks);
    }
  }
  static build(builder: Builder, cleanup: Cleanup | null): [Ctx, VNode] {
    let ctx = new Ctx();
    if (cleanup) ctx.cleanup(cleanup);
    
    Ctx.initialBuild = true;
    let vnode = ctx.build(builder);
    Ctx.initialBuild = false;
    
    // add as child of parent
    let parent = Ctx.stack.at(-1);
    if (parent) (parent.children ??= []).push(ctx);
    
    return [ctx, vnode];
  }
  
  isDestroyed(): boolean {
    return this.cleanups === null;
  }
  defer(...callbacks: Cleanup[]) {
    (this.deferreds ??= []).push(...callbacks);
  }
  cleanup(...callbacks: Cleanup[]) {
    if (this.isDestroyed()) {
      console.error("added cleanup to context that has been destroyed");
    } else {
      (this.cleanups ??= []).push(...callbacks);
    }
  }
  
  build(builder: Builder): VNode {
    
    Ctx.stack.push(this);
    let vnode = builder();
    Ctx.stack.pop();
    
    /* Check if ctx is stacked (points to another ctx rather than a vnode) */
    if (this.children && this.children.length === 1) {
      if (vnode === this.children[0].vnode()) {
        this.node = this.children[0];
        this.children = undefined;
        return vnode;
      }
    }
    
    return this.node = vnode;
  }
  rebuild(builder: Builder) {
    
    if (this.cleanups === null) {
      console.warn("Ctx attempted to rebuild after being destroyed.");
      return;
    }
    
    let oldVnode = Ctx.consume(this.node);
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
      tail.node = oldVnode; // Not sure if necessary
    } catch(e) {
      console.error("error patching:", newVnode.sel);
      console.error(e);
      dumpErr(oldVnode);
      dumpErr(newVnode);
    }
  }
  static consume(curr: Ctx | VNode): VNode {
    if (curr instanceof Ctx) {
      return curr.destroy();
    } else {
      return curr;
    }
  }
  destroy(): VNode {
    if (this.cleanups === null) {
      console.warn("ctx destroyed after it has already cleaned up");
    } else {
      
      /*if (VERBOSE) {
        if (this.node instanceof Ctx)
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
    
    if (this.node instanceof Ctx)
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
  tail(): Ctx {
    if (this.node instanceof Ctx)
      return this.node.tail();
    return this;
  }
  vnode(): VNode {
    if (this.node instanceof Ctx)
      return this.node.vnode();
    return this.node;
  }
}