
import icons from "../assets/players/index"
import Canvas from "./canvas"

const bases: Record<string, HTMLImageElement> = {};
const cache: Record<string, Record<string, string>> = {};
for (const path in icons) {
	let img = new Image();
	img.onload = () => bases[path] = img;
	img.src = icons[path as keyof typeof icons] as string;
}

function generate(src: string, color: string): string {
	let canvas = Canvas.fromImage(bases[src]);
	canvas.setOperation("multiply");
	canvas.wipeStyle(color);
	return cache[src][color] = canvas.element.toDataURL();
}
export function get(src: string, color: string): string {
	if (!(src in cache)) {
		cache[src] = {};
		return cache[src][color] = generate(src, color);
	} else {
		return cache[src][color] ??= generate(src, color);
	}
}
