
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
	playerIcons
} from "../modules"

import * as icons from "../assets/icons"
import * as assets from "../assets/testing"
import * as PlayerIcon from "../modules/player_icons"

//import { Player } from "../host/room";

import { Countdown, Tray, IconBtn, Autoscroll, Logo } from "../components"
import Drawpad from "../play/drawpad"
import { Submission, SubmissionGrid, ReadyDisplay } from "../host/components";

import Canvas from "../modules/canvas"


function generateTransparent(icon: number): Canvas {
	//if (!bases[src].complete) await bases[src]?.decode();
	
	const base = PlayerIcon.bases[icon];
	
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
	const src = generateBackground();
	return h("img", { attrs: { src } });
}


Micron.mount(Background());

