
import iconMap from "../assets/players/"
import Canvas from "./canvas"

export const icons: string[] = Object.values(iconMap);

const bases: HTMLImageElement[] = new Array(icons.length);
const cache: { [key: string]: string }[] = new Array(icons.length);

let promises: Promise<void>[] = [];
for (let i = 0; i < icons.length; i++) {
	cache[i] = {};
	
	let img = new Image();
	bases[i] = img;
	img.src = icons[i];
	promises.push(img.decode());
}

await Promise.all(promises);


function generate(icon: number, color: string): string {
	//if (!bases[src].complete) await bases[src]?.decode();
	
	const base = bases[icon];
	if (typeof base !== "object") {
		console.error("Attempted to generate icon with invalid icon index:", icon);
	}
	if (typeof color !== "string") {
		console.error("Attempted to generate icon with invalid color:", color);
	}
	
	let canvas = Canvas.fromImage(bases[icon]);
	canvas.setOperation("source-in");
	canvas.wipeStyle(color);
	canvas.setOperation("multiply");
	canvas.putImage(bases[icon]);
	return canvas.element.toDataURL();
}
export function get(icon: number, color: string): string {
	return cache[icon][color] ??= generate(icon, color);
}
export function cacheColor(color: string) {
	for (let i = 0; i < count(); i++)
		get(i, color);
}

export function count(): number {
	return icons.length;
}

import { h } from "./micron"
export function View(icon: number, color: string, disabled = false) {
	return h("img.player-icon", {
		attrs: { src: get(icon, color) },
		class: { disabled }
	});
}

