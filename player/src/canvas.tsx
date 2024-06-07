

import React from "react"

type CanvasColorStyle = string | CanvasGradient | CanvasPattern;

export default class Canvas {
	
	ctx: CanvasRenderingContext2D;
	
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
	
	mapX(x: number): number {
		return x * this.sourceWidth / this.clientWidth;
	}
	mapY(y: number): number {
		return y * this.sourceHeight / this.clientHeight;
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
	
	line(x1: number, y1: number, x2: number, y2: number): void {
		this.ctx.beginPath();
		this.ctx.moveTo(x1, y1);
		this.ctx.lineTo(x2, y2);
		this.ctx.stroke();
	}
	
}
