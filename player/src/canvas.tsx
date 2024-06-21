

import React from "react"

type CanvasColorStyle = string | CanvasGradient | CanvasPattern;

export default class Canvas {
	
	ctx: CanvasRenderingContext2D;
	
	//ctxs: Array<CanvasRenderingContext2D>;
	//layer: number = 0;
	
	
	/*get ctx(): CanvasRenderingContext2D {
		return this.ctxs[this.layer];
	}*/
	get element(): HTMLCanvasElement {
		return this.ctx.canvas;
	}
	get sourceWidth() {
		return this.element.width;
	}
	get sourceHeight() {
		return this.element.height;
	}
	get clientWidth() {
		return this.element.clientWidth;
	}
	get clientHeight() {
		return this.element.clientHeight;
	}
	
	static createElement(sourceWidth: number, sourceHeight: number): HTMLCanvasElement {
		let canvasElement: HTMLCanvasElement = document.createElement("canvas");
		canvasElement.width = sourceWidth;
		canvasElement.height = sourceHeight;
		return canvasElement;
	}
	
	/*
	get left(): number {
		return 0;
	}
	get right(): number {
		return this.element.width / this.stretchFactor;
	}
	get top(): number {
		return 0;
	}
	get bottom(): number {
		return this.element.height / this.stretchFactor;
	}
	get width(): number {
		return this.right - this.left;
	}
	get height(): number {
		return this.bottom - this.top;
	}*/
	
	
	
	
	
	// Constructors and related methods
	protected static getCanvasElementContext(canvasElement: HTMLCanvasElement): CanvasRenderingContext2D {
		
		let ctx: CanvasRenderingContext2D | null = canvasElement.getContext("2d");
		
		if (ctx == null)
			throw new Error("Couldn't get 2d canvas context.");
		else
			return ctx;
		
	}
	static fromElement(canvasElement: HTMLCanvasElement): Canvas {
		return new Canvas(this.getCanvasElementContext(canvasElement));
	}
	static fromImageData(imageData: ImageData): Canvas {
		
		let canvas = Canvas.create(imageData.width, imageData.height);
		canvas.ctx.putImageData(imageData, 0, 0);
		return canvas;
		
	}
	static create(sourceWidth: number, sourceHeight: number): Canvas {
		
		let canvasElement: HTMLCanvasElement = document.createElement("canvas");
		canvasElement.width = sourceWidth;
		canvasElement.height = sourceHeight;
		
		return Canvas.fromElement(canvasElement);
		
	}
	
	constructor(ctx: CanvasRenderingContext2D) {
		
		this.ctx = ctx;
		
	}
	
	map(x: number, y: number): Point {
		return [this.mapX(x), this.mapY(y)];
	}
	mapX(x: number): number {
		return x * this.sourceWidth / this.clientWidth;
	}
	mapY(y: number): number {
		return y * this.sourceHeight / this.clientHeight;
	}
	unmap(x: number, y: number): Point {
		return [this.unmapX(x), this.unmapY(y)];
	}
	unmapX(x: number): number {
		return x * this.clientWidth / this.sourceWidth;
	}
	unmapY(y: number): number {
		return y * this.clientHeight / this.sourceHeight;
	}
	
	// 
	reset(): void {
		this.resetTransform();
		this.clear();
	}
	apply(...canvases: Array<Canvas>): void {
		
		this.reset();
		
		for (const canvas of canvases)
			this.ctx.drawImage(canvas.element, 0, 0, this.element.width, this.element.height);
		
	}
	
	// Transform
	scale(x: number, y = x): void {
		this.ctx.scale(x, y);
	}
	
	resetTransform(): void {
		//this.ctx.setTransform(1, 0, 0, 1, 0, 0);
		//this.scale(this.stretch);
		this.ctx.resetTransform();
	}
	
	// Color
	protected static rgbaToStyle(r: number, g: number, b: number, a = 1): string {
		return `rgba(${Math.round(r * 255)}, ${Math.round(g * 255)}, ${Math.round(b * 255)}, ${Math.round(a * 255)})`;
	}
	
	getFillStyle(): CanvasColorStyle {
		return this.ctx.fillStyle;
	}
	getStrokeStyle(): CanvasColorStyle {
		return this.ctx.strokeStyle;
	}
	getLineWidth(): number {
		return this.ctx.lineWidth;
	}
	getOperation(): GlobalCompositeOperation {
		return this.ctx.globalCompositeOperation;
	}
	setFill(r: number, g: number, b: number, a = 1): void {
		this.setFillStyle(Canvas.rgbaToStyle(r, g, b, a));
	}
	setFillStyle(style: string | CanvasGradient | CanvasPattern): void {
		this.ctx.fillStyle = style;
	}
	setStroke(r: number, g: number, b: number, a = 1): void {
		this.setStrokeStyle(Canvas.rgbaToStyle(r, g, b, a));
	}
	setStrokeStyle(style: string | CanvasGradient | CanvasPattern): void {
		this.ctx.strokeStyle = style;
	}
	setLineWidth(width: number): void {
		this.ctx.lineWidth = width;
	}
	setLineCap(cap: CanvasLineCap): void {
		this.ctx.lineCap = cap;
	}
	setLineJoin(join: CanvasLineJoin): void {
		this.ctx.lineJoin = join;
	}
	setOperation(operation: GlobalCompositeOperation): void {
		this.ctx.globalCompositeOperation = operation;
	}
	
	/*protected withoutTransform<T>(callback: () => T): T {
		
		let transform = this.getTransform();
		
		let out = callback();
		
		return out;
		
	}*/
	
	clear(): void { // Doesn't respect transform
		this.clearRect(0, 0, this.sourceWidth, this.sourceHeight);
	}
	wipe(r: number, g: number, b: number, a = 1.0): void {
		this.wipeStyle(Canvas.rgbaToStyle(r, g, b, a));
	}
	wipeStyle(style: string): void {
		
		let fillStyle = this.getFillStyle();
		
		this.setFillStyle(style);
		this.fillRect(0, 0, this.sourceWidth, this.sourceHeight);
		// Maybe reset fillStyle to what it was before
		
	}
	
	// Shapes
	clearRect(x: number, y: number, w: number, h: number): void {
		this.ctx.clearRect(x, y, w, h);
	}
	fillRect(x: number, y: number, w: number, h: number): void {
		//this.ctx.fillStyle = "rgb(0,0,0)";
		//this.ctx.fillStyle = "blue";
		//this.useFill();
		this.ctx.fillRect(x, y, w, h);
	}
	/*
	strokeRect(x: number, y: number, w: number, h: number): void {
		//this.useStroke();
		this.ctx.strokeRect(x, y, w, h);
	}
	fillStrokeRect(x: number, y: number, w: number, h: number): void {
		this.fillRect(x, y, w, h);
		this.strokeRect(x, y, w, h);
	}
	
	private pathEllipse(x: number, y: number, w: number, h: number): void {
		this.ctx.beginPath();
		this.ctx.ellipse(x, y, w, h, 0, 0, 6.3); // 6.3 = a bit over 2pi
	}
	fillEllipse(x: number, y: number, w: number, h = w): void {
		this.pathEllipse(x, y, w, h);
		this.ctx.fill();
	}
	strokeEllipse(x: number, y: number, w: number, h = w): void {
		this.pathEllipse(x, y, w, h);
		this.ctx.stroke();
	}
	ellipse(x: number, y: number, w: number, h = w): void {
		this.pathEllipse(x, y, w, h);
		this.ctx.fill();
		this.ctx.stroke();
	}
	*/
	
	line(x1: number, y1: number, x2: number, y2: number): void {
		this.ctx.beginPath();
		this.ctx.moveTo(x1, y1);
		this.ctx.lineTo(x2, y2);
		this.ctx.stroke();
	}
	path(path: Path) {
		//this.setStrokeStyle(path.style);
		//this.setLineWidth(path.lineWidth);
		//this.ctx.lineJoin = "round";
		/*for (const [[px, py], [x, y]] of path.segments()) {
			this.line(px, py, x, y);
		}*/
		
		this.ctx.beginPath();
		this.ctx.moveTo(...path.start()!);
		for (const [x, y] of path.points()) {
			this.ctx.lineTo(x, y);
			//this.ctx.stroke();
			//this.ctx.begin
			//this.ctx.moveTo(x, y);
		}
		this.ctx.stroke();
	}
	
	getImageData(x = 0, y = 0, w = this.sourceWidth, h = this.sourceHeight): ImageData {
		return this.ctx.getImageData(x, y, w, h);
	}
	putImageData(data: ImageData, x = 0, y = 0): void {
		this.ctx.putImageData(data, x, y);
	}
	
	
	
}

export type Point = [number, number];

export class Path {
	
	//style: CanvasColorStyle;
	//lineWidth: number;
	pointData: Array<number> = [];
	
	/*constructor(style: CanvasColorStyle, lineWidth: number) {
		this.style = style;
		this.lineWidth = lineWidth;
		//this.pointData = start.slice();
	}*/
	*points(): Iterable<Point> {
		for (let i = 0; i < this.pointData.length; i += 2)
			yield [this.pointData[i], this.pointData[i + 1]];
	}
	*segments(): Iterable<[Point, Point]> {
		let prev: Point | undefined;
		for (const point of this.points())
			if (prev == undefined)
				prev = point;
			else
				yield [prev, prev = point];
	}
	
	length(): number {
		return Math.floor(this.pointData.length/2);
	}
	isEmpty(): boolean {
		return this.pointData.length < 2;
	}
	
	start(): Point | undefined {
		if (this.isEmpty()) return;
		return [this.pointData[0], this.pointData[1]];
	}
	end(): Point | undefined {
		if (this.isEmpty()) return;
		return [this.pointData.at(-2)!, this.pointData.at(-1)!];
	}
	
	push(x: number, y: number) {
		this.pointData.push(x);
		this.pointData.push(y);
	}
	
	
}

