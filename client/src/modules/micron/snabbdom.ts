
import {
	init,
	classModule,
	styleModule,
	attributesModule,
	eventListenersModule,
	Options,
	
	h,
  VNode,
  VNodeChildren,
  VNodeChildElement,
	VNodeData
} from "snabbdom"

export {
	h,
	patch
};
export type {
  VNode,
  VNodeChildren,
  VNodeChildElement,
	VNodeData
};

/* SnabbDOM config */
const modules = [
	classModule,
	styleModule,
	attributesModule,
	eventListenersModule,
];
const options: Options = { /* experimental: { fragments: true } */ };
const patch = init(modules, undefined, options);

export function mount(vnode: VNode, id = "root") {
	let element = document.getElementById(id);
	if (element == null) {
		console.error(`Error in mount(): element with id ${id} does not exist`);
		return null;
	}
	return patch(element, vnode);
}

