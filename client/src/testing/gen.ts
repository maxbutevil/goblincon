
import "../styles/index.scss"
//import "../host/host.scss"
//import "./host/host.scss"
//import { exit as exitIcon } from "./assets/icons/"
import "../assets/icons"

import {
	Micron,
	Signal, State,
	h, s, c,
	projector, defer, Node, mount,
	playerIcons,
	Shared
} from "../modules"

import * as icons from "../assets/icons"
import * as assets from "../assets/testing"

import Canvas from "../modules/canvas"

function generate() {
	
	const canvas = Canvas.create(512, 512);
	const bx = 0;
	const by = -180;
	
	function put(x: number, y: number, icon: number, color: string, scale = 1) {
		canvas.putImage(playerIcons.generate(icon, color).element, x - 64, y - 64);
	}
	function put2(i: number) {
		//const icon = playerIcons.generate(i, Shared.playerColor(i)).element;
		const color = Shared.playerColor(i);
		const theta = (i + 3) * Math.PI * 2 / 7;
		const x = by * -Math.sin(theta)
		const y = by *  Math.cos(theta);
		put(x, y, i, color);
	}
	
	canvas.wipeStyle("#f9ddcc");
	canvas.translate(256, 256)
	canvas.scale(1.5);
	put(0, 0, 0, "red");
	canvas.scale(1 / 1.5);
	for (let i = 1; i < 8; i++) {
		put2(i);
	}
	//canvas.putImage(playerIcons.generate());
	return canvas.element.toDataURL();
}


function generateTransparent(icon: number): Canvas {
	//if (!bases[src].complete) await bases[src]?.decode();
	
	const base = playerIcons.bases[icon];
	
	const canvas = Canvas.create(base.width, base.height);
	canvas.putImage(base);
	const imageData = canvas.getImageData();
	const data = imageData.data;
	for (let i = 0; i < data.length; i += 4) {
		data[i+3] = Math.max(0, data[i+3] - data[i+0]);
		//	data[i+3] = 0;
		data[i+0] = data[i+1] = data[i+2] = 0;
	}
	canvas.putImageData(imageData);
	
	return canvas;
}
function generateBackground() {
	
	const icons = [];
	for (let i = 0; i < playerIcons.count(); i++) {
		icons.push(generateTransparent(i).element);
	}
	
	const scale = 0.75;
	const canvas = Canvas.create(1024 * scale, 1024 * scale);
	canvas.scale(scale);
	
	for (let i = 0; i < 4; i++) {
		canvas.putImage(icons[i], i * 256, 32 + ((i % 2 == 0) ? 0 : 64));
	}
	for (let i = 0; i < 4; i++) {
		canvas.putImage(icons[i+4], 64 + i * 256, 32+256 + ((i % 2 == 0) ? 0 : 64));
	}
	for (let i = 0; i < 4; i++) {
		canvas.putImage(icons[i], i * 256, 32+512 + ((i % 2 == 0) ? 0 : 64));
	}
	for (let i = 0; i < 4; i++) {
		canvas.putImage(icons[i+4], 64 + i * 256, 32+256*3 + ((i % 2 == 0) ? 0 : 64));
	}
	
	const imageData = canvas.getImageData();
	const data = imageData.data;
	for (let i = 0; i < data.length; i += 4) {
		data[i+3] *= 0.036;
	}
	
	canvas.putImageData(imageData);
	
	return canvas.element.toDataURL();
}
function Background() {
	const src = generate();
	return h("img", { attrs: { src }, style: { border: "2px solid black" } });
}


Micron.mount(Background());

