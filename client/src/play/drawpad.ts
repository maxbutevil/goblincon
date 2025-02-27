

import {
	Signal, State,
	Shared,
	h, s, defer, VNode
} from "../modules/index"

//import Globals from "../modules/globals"

import * as icons from "../assets/icons/index"

const BACKUP_MAX_LAG = 18; // if current backup is at least this out of date, rebuild (catch up)
const BACKUP_MED_LAG = 10; // if we undo past the current backup, how far back to we jump?
const BACKUP_MIN_LAG = 2; // leave this buffer when catching up, so that a few undos don't cause a full rebuild
const THIN_LINE_WIDTH = 8;
const THICK_LINE_WIDTH = 20;
const ERASER_WIDTH = 20;

type DrawMode = { type: "erase" | "draw", weight: "thick" | "thin", color: string };
type DrawOperation = {
	path: Path,
	mode: DrawMode
};

enum CanvasState {
	BLANK,
	IDLE,
	DRAWING,
	LOCKED, // vestigial
	SUBMITTED
};

export default class Drawpad {
	
	private readonly submitted = new Signal();
	
	submit() {
		this.submitted.emit();
	}
	view(onSubmit: (drawingData: string) => void) {
		
		const state = new State(CanvasState.BLANK);
		
		let undoStack: Array<DrawOperation> = [];
		let redoStack: Array<DrawOperation> = [];
		let backup: ImageData | undefined;
		let backupIndex = 0;
		let drawMode: DrawMode = { type: "draw", weight: "thin", color: "#000000" };
		
		let canvas: Canvas | null = null;
		
		function applyMode(mode: DrawMode = drawMode) {
			
			if (canvas === null) return;
			
			switch(mode.type) {
				case "erase":
					canvas.setOperation("destination-out");
					canvas.setLineWidth(ERASER_WIDTH);
					break;
				case "draw":
					canvas.setStrokeStyle(mode.color);
					if (mode.weight === "thin") {
						canvas.setOperation("source-over");
						canvas.setLineWidth(THIN_LINE_WIDTH);
					} else {
						canvas.setOperation("destination-over");
						canvas.setLineWidth(THICK_LINE_WIDTH);
					}
					break;
			}
		}
		function applyOperation(operation: DrawOperation) {
			applyMode(operation.mode);
			canvas?.path(operation.path);
		}
		
		function canChangeMode(): boolean {
			return canvas !== null && state.any(CanvasState.IDLE, CanvasState.BLANK);
		}
		function selectErase() {
			drawMode.type = "erase";
			applyMode();
		}
		function selectColor(color: string) {
			drawMode.type = "draw";
			drawMode.color = color;
			applyMode();
		}
		function toggleLineWeight() {
			drawMode.weight = (drawMode.weight === "thin" ? "thick" : "thin");
			applyMode();
		}
		
		function applyOperationRange(start: number, end = Infinity) {
			end = Math.min(end, undoStack.length);
			for (let i = start; i < end; i++)
				applyOperation(undoStack[i]);
		}
		function restoreBackup() {
			if (canvas) {
				canvas.clear();
				if (backup) canvas.putImageData(backup);
			}
		}
		function saveBackup(index: number) {
			//if (backupIndex === index) return;
			backupIndex = index;
			backup = canvas?.getImageData();
		}
		function rebuildBackup(index: number) {
			
			if (!canvas)
				return;
			
			if (index < 0)
				index = 0;
			else if (index > undoStack.length)
				index = undoStack.length;
			
			if (index === backupIndex) {
				// identical to the old backup, just restore
				restoreBackup();
			} else if (index > backupIndex) {
				// we can refer to the old backup, so just use that
				restoreBackup();
				applyOperationRange(backupIndex, index);
				saveBackup(index);
			} else {
				// we have to rebuild everything, so do that
				canvas.clear();
				applyOperationRange(0, index);
				saveBackup(index);
			}
		}
		function rebuildCanvas() {
			
			if (undoStack.length < backupIndex) // rebuild the backup, we're going deeper
				rebuildBackup(undoStack.length - BACKUP_MED_LAG);
			else if (undoStack.length > backupIndex + BACKUP_MAX_LAG) // catch up
				rebuildBackup(undoStack.length - BACKUP_MIN_LAG);
			else // stay where we are
				rebuildBackup(backupIndex);
			
			// apply everything that happened since the backup
			applyOperationRange(backupIndex);
			applyMode(); // keep the same user settings
			
		}
		
		function abort(redoable = false) {
			
			if (!canvas || undoStack.length === 0)
				return;
			if (!state.is(CanvasState.IDLE))
				return;
			
			let op = undoStack.pop()!;
			if (redoable) redoStack.push(op);
			rebuildCanvas();
			
			let isBlank = (backupIndex === 0 && undoStack.length === 0);
			if (isBlank)
				state.set(CanvasState.BLANK);
		}
		function undo() {
			abort(true);
		}
		
		function redo() {
			
			if (!canvas || redoStack.length === 0)
				return;
			if (state.any(CanvasState.LOCKED, CanvasState.SUBMITTED))
				return;
			
			state.set(CanvasState.IDLE);
			let op = redoStack.pop()!;
			undoStack.push(op);
			applyOperation(op); // don't really need to mess with the backup here
			
		}
		
		function draw(ev: PointerEvent) {
			
			if (!canvas) return;
			
			let [x, y] = canvas.map(ev.offsetX, ev.offsetY);
			
			let op = undoStack.at(-1)!;
			let [px, py] = op.path.end() ?? [x + 0.01, y + 0.01]; // if this is the first point, just draw a dot at x, y
			canvas.line(px, py, x, y);
			op.path.push(x, y);
			
			if (x < 0 || y < 0 || x > canvas.sourceWidth || y > canvas.sourceHeight)
				endDraw();
		}
		function startDraw() {
			state.set(CanvasState.DRAWING);
			redoStack = [];
			undoStack.push({
				path: new Path(),
				mode: Object.assign({}, drawMode)
			});
		}
		function endDraw() {
			state.set(CanvasState.IDLE);
			rebuildCanvas();
		}
		function handleDraw(ev: PointerEvent) {
			if (!ev.isPrimary || !canvas)
				return;
			if (state.get() !== CanvasState.DRAWING)
				return;
			draw(ev);
		}
		function handleStartDraw(ev: PointerEvent) {
			
			if (state.is(CanvasState.DRAWING)) {
				// multiple touches cancels drawing
				endDraw();
				
				// if we try to pinch-zoom on the drawpad we leave a single point behind
				// this fixes that
				let op = undoStack.at(-1);
				let isPoint = op != undefined && op.path.length() <= 1;
				if (isPoint) abort();
				
				return;
			}
			
			if (!ev.isPrimary || !canvas)
				return;
			if (state.any(CanvasState.LOCKED, CanvasState.SUBMITTED))
				return;
			
			startDraw();
			draw(ev);
		}
		function handleEndDraw(ev: PointerEvent) {
			if (!ev.isPrimary || state.get() !== CanvasState.DRAWING)
				return;
			draw(ev);
			endDraw();
		}
		
		function submit() {
			if (state.any(CanvasState.BLANK, CanvasState.SUBMITTED))
				return;
			if (canvas === null)
				return console.error("Couldn't get canvas data");
			
			state.set(CanvasState.SUBMITTED);
			const drawingData = canvas.element.toDataURL("image/png");
			onSubmit(drawingData);
		}
		
		function lineWidthBtn(disabled: boolean) {
			return s(rerender => {
				const iconSrc = drawMode.weight === "thin" ? icons.thin : icons.thick;
				return h(
					"button#weight-btn",
					{
						on: {
							click: () => {
								if (canChangeMode()) {
									toggleLineWeight();
									rerender();
								}
							}
						},
						attrs: { disabled }
					},
					icon(iconSrc)
				);
			});
		}
		function colorSelect(disabled: boolean) {
			
			return s(rerender => {
				
				function colorButton(color: string) {
					const isSelected = drawMode.type === "draw" && drawMode.color === color;
					let borderColor = isSelected ? "white" : color;
					
					return h("button.button.color-select-btn",
						{
							style: {
								backgroundColor: color,
								borderColor
							},
							on: {
								click: () => {
									if (canChangeMode()) {
										selectColor(color);
										rerender();
									}
								}
							},
							attrs: { disabled }
						}
					);
				}
				function eraseButton() {
					const isSelected = drawMode.type === "erase";
					let borderColor = isSelected ? "black" : "white";
					return h(
						"button.button.color-select-btn",
						{
							style: {
								backgroundColor: "white",
								borderColor
							},
							on: {
								click: () => {
									if (canChangeMode()) {
										selectErase();
										rerender();
									}
								}
							}
						},
						icon(icons.erase)
					);
				}
				
				return h("div#color-select.btn-row", [
					...Shared.DRAW_COLORS.map(color => colorButton(color)),
					eraseButton()
				]);
			});
			
		}
		
		function init(vnode: VNode) {
			
			if (canvas)
				return;
			
			const ctx = (vnode.elm as HTMLCanvasElement).getContext("2d");
			
			if (!ctx)
				throw new Error("Couldn't get canvas context.");
			
			canvas = new Canvas(ctx);
			//canvas.wipeStyle("white");
			canvas.clear();
			canvas.setStrokeStyle("black");
			canvas.setLineWidth(THIN_LINE_WIDTH);
			canvas.setLineCap("round");
			canvas.setLineJoin("round");
		}
		
		function icon(src: string) {
			return h("img", { attrs: { src } });
		}
		let submittingTimeout: NodeJS.Timeout;
		defer(this.submitted.subscribe(submit));
		
		// This could probably avoid rerendering on every canvas state change
		return s(state, curr => {
			
			//clearTimeout(submittingTimeout);
			const submitted = curr === CanvasState.SUBMITTED;
			const canSubmit = curr === CanvasState.IDLE;
			const disabled = submitted;
			
			function startSubmit() {
				clearTimeout(submittingTimeout);
				submittingTimeout = setTimeout(submit, 0.7 * 1000);
			}
			function cancelSubmit() {
				clearTimeout(submittingTimeout);
			}
			
			return h("div#drawpad", [
				colorSelect(disabled),
				h("canvas#canvas", {
					attrs: {
						width: 360,
						height: 360
					},
					on: {
						pointerdown: handleStartDraw,
						pointerup: handleEndDraw,
						pointerleave: handleEndDraw,
						pointermove: handleDraw
					},
					hook: {
						create: (_emptyVnode, vnode) => init(vnode),
						update: (_oldVnode, vnode) => init(vnode)
					}
				}, "You don't have canvas support!"),
				h("div#draw-utils.btn-row", [
					h("button#undo-btn", { on: { click: undo }, attrs: { disabled } }, icon(icons.undo)),
					h("button#redo-btn", { on: { click: redo }, attrs: { disabled } }, icon(icons.redo)),
					lineWidthBtn(disabled),
					h("button#spacer-btn", { attrs: { disabled: true } }),
					h(
						"button#submit-btn" + (submitted ? ".submitted" : ""),
						{
							on: {
								pointerdown: startSubmit,
								pointerup: cancelSubmit,
								pointerleave: cancelSubmit
							},
							attrs: { disabled: !canSubmit }
						},
						submitted ? "Submitted!" : "Hold to Submit"
					)
				])
			])
		});
	}
}

type CanvasColorStyle = string | CanvasGradient | CanvasPattern;

type Point = [number, number];

class Path {
	
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

class Canvas {
	
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
	static fromImage(image: HTMLImageElement): Canvas {
		let canvas = Canvas.create(image.width, image.height);
		canvas.putImage(image);
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
		
		if (path.isEmpty())
			return;
		
		this.ctx.beginPath();
		let [sx, sy] = path.start()!;
		
		// mildly shitty hack because some browsers won't draw anything if the start and end are identical
		this.ctx.moveTo(sx + 0.01, sy + 0.01);
		for (const [x, y] of path.points())
			this.ctx.lineTo(x, y);
		
		this.ctx.stroke();
	}
	
	getImageData(x = 0, y = 0, w = this.sourceWidth, h = this.sourceHeight): ImageData {
		return this.ctx.getImageData(x, y, w, h);
	}
	putImageData(data: ImageData, x = 0, y = 0): void {
		this.ctx.putImageData(data, x, y);
	}
	putImage(image: CanvasImageSource, x = 0, y = 0) {
		this.ctx.drawImage(image, x, y);
	}
}




