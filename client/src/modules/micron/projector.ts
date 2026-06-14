
//import State from "./state"
import Signal from "./signal"

import * as builder from "./builder"
import { Builder, bundle } from "./builder"

import * as blueprint from "./blueprint"
import { Blueprint } from "./blueprint"

//import { h, VNode, } from "./snabbdom"
//type Blueprint<A extends any[]> = { builder: Builder<A>, args: A };

/* Exposed constructors */
export function projector<A extends any[] = []>(initial?: Builder<A>, ...initialArgs: A): Projector {
  return Projector.create(initial, ...initialArgs);
}
export function anchor<A extends any[] = []>(initial?: Builder<A>, ...initialArgs: A): Anchor {
  return Anchor.create(initial, ...initialArgs);
}
export function stack<A extends any[] = []>(initial?: Builder<A>, ...initialArgs: A): Stack {
  return Stack.create(initial, ...initialArgs);
}

export class Projector {
  
  readonly changed = new Signal<[Builder]>();
  readonly initial: Builder;
  
  static create<A extends any[] = []>(initial?: Builder<A>, ...initialArgs: A): Projector {
    return new Projector(!initial ? builder.EMPTY : bundle(initial, initialArgs));
  }
  constructor(initialBuilder: Builder) {
    this.initial = initialBuilder;
  }
  put<A extends any[]>(builder: Builder<A>, ...builderArgs: A) {
    this.changed.emit(bundle(builder, builderArgs));
  }
  clear() {
    this.changed.emit(builder.EMPTY);
  }
  reset() {
    this.changed.emit(this.initial);
  }
}

export class Anchor {
  readonly changed = new Signal<[Blueprint]>();
  curr: Blueprint;
  
  static create<A extends any[] = []>(initial?: Builder<A>, ...initialArgs: A): Anchor {
    return new Anchor(!initial ? undefined : [initial, initialArgs]);
  }
  constructor(initial?: Blueprint) {
    this.curr = initial ?? blueprint.EMPTY;
  }
  private putBlueprint(blueprint: Blueprint) {
    this.changed.emit(this.curr = blueprint);
  }
  put<A extends any[]>(builder: Builder<A>, ...args: A) {
    this.putBlueprint([builder, args]);
  }
  toggle<A extends any[]>(builder: Builder<A>, ...args: A) {
    if (this.is(builder))
      this.clear();
    else
      this.put(builder, ...args);
  }
  clear() {
    this.putBlueprint(blueprint.EMPTY);
  }
  get(): Builder<any> {
    return this.curr[0];
  }
  is(builder: Builder): boolean {
    return this.get() === builder;
  }
  isEmpty(): boolean {
    return this.is(builder.EMPTY);
  }
  any(...builders: Builder<any>[]): boolean {
    return builders.includes(this.get());
  }
  /*anyOrEmpty(...builders: Builder<any>[]): boolean {
    
  }*/
}

export class Stack {
  
  readonly changed = new Signal<[Blueprint]>();
  blueprints: Blueprint[];
  
  get count() {
    return this.blueprints.length;
  }
  get empty(): boolean {
    return this.count === 0;
  }
  get curr(): Blueprint{
    return this.blueprints.at(-1) ?? blueprint.EMPTY;
  };
  
  /*get currOrEmpty(): Blueprint {
    return this.curr ?? blueprint.EMPTY;
  }*/
  
  
  static create<A extends any[] = []>(initial?: Builder<A>, ...initialArgs: A): Stack {
    return new Stack(!initial ? [] : [[initial, initialArgs]]);
  }
  constructor(blueprints?: Blueprint[]) {
    this.blueprints = blueprints ?? [];
  }
  protected notify() {
    this.changed.emit(this.curr);
  }
  protected add<A extends any[]>(builder: Builder<A>, args: A) {
    this.blueprints.push([builder, args]);
  }
  
  
  top(): Builder | undefined {
    return this.blueprints.at(-1)?.[0];
  }
  root(): Builder | undefined {
    return this.blueprints.at(0)?.[0];
  }
  push<A extends any[]>(builder: Builder<A>, ...builderArgs: A) {
    this.add(builder, builderArgs);
    this.notify();
  }
  splice<A extends any[]>(builder: Builder<A>, ...builderArgs: A) {
    this.blueprints.pop();
    this.add(builder, builderArgs);
    this.notify();
  }
  pop() {
    if (this.blueprints.length > 0) {
      this.blueprints.pop();
      this.notify();
    }
  }
  clear<A extends any[] = []>(initial?: Builder<A>, ...args: A) {
    if (initial === undefined) {
      if (this.count > 0) {
        this.blueprints = [];
        this.notify();
      }
    } else {
      this.blueprints = [[initial, args]];
      this.notify();
    }
  }
  
}


