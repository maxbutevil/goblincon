

import {
	Signal, State,
	Shared,
	h, s, c, Micron
} from "../modules/"



//import Globals from "../modules/globals"

import * as icons from "../assets/icons/"

const BACKUP_MAX_LAG = 18; // if current backup is at least this out of date, rebuild (catch up)
const BACKUP_MED_LAG = 10; // if we undo past the current backup, how far back to we jump?
const BACKUP_MIN_LAG = 2; // leave this buffer when catching up, so that a few undos don't cause a full rebuild
const THIN_LINE_WIDTH = 8;
const THICK_LINE_WIDTH = 20;
//const ERASER_WIDTH = 20;

//type DrawMode = { type: "erase" | "draw", weight: "thick" | "thin", color: string };

const erase = Symbol("erase");
type DrawMode = { color: string | typeof erase, weight: "thick" | "thin" };

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

type DrawpadOptions = {
	onSubmit: (drawing: string) => void,
	onStartSubmit?: () => boolean
};

export default class Drawpad {
	
	private readonly options: DrawpadOptions;
	private readonly submitted = new Signal();
	private readonly drawModeChanged = new Signal();
	private readonly state = new State(CanvasState.BLANK);
	private readonly isDisabled = this.state.map(s => s === CanvasState.SUBMITTED);
	
	constructor(options: DrawpadOptions) {
		this.options = options;
	}
	
	/*readonly state = new State(CanvasState.BLANK);
	
	private mode: DrawMode = "draw";
	private weight: DrawWeight = "thin";
	private color: string = "#000000";
	private undoStack: Array<DrawOperation> = [];
	private redoStack: Array<DrawOperation> = [];
	private backup?: ImageData;
	private backupIndex = 0;
	
	canvas?: Canvas;*/
	
	
	
	submit() {
		this.submitted.emit();
	}
	isSubmitted(): boolean {
		return this.state.is(CanvasState.SUBMITTED);
	}
	
	View() {
		
		const { onSubmit, onStartSubmit } = this.options;
		const { state, isDisabled, submitted, drawModeChanged } = this;
		
		const penIcon = Canvas.create(128, 128);
		
		let undoStack: Array<DrawOperation> = [];
		let redoStack: Array<DrawOperation> = [];
		let backup: ImageData | undefined;
		let backupIndex = 0;
		let drawMode: DrawMode = { color: "#000000", weight: "thin" };
		
		let canvas: Canvas | null = null;
		
		function applyMode(mode: DrawMode = drawMode) {
			
			if (canvas === null) return;
			
			if (mode.weight === "thin") {
				canvas.setLineWidth(THIN_LINE_WIDTH);
			} else {
				canvas.setLineWidth(THICK_LINE_WIDTH);
			}
			
			if (mode.color === erase) {
				canvas.setOperation("destination-out");
			} else {
				canvas.setStrokeStyle(mode.color);
				if (mode.weight === "thin") {
					canvas.setOperation("source-over");
				} else {
					canvas.setOperation("destination-over");
				}
			}
		}
		function setMode(color: string | typeof erase, weight = drawMode.weight) {
			drawMode = { color, weight };
			applyMode();
			drawModeChanged.emit();
		}
		
		function applyOperation(operation: DrawOperation) {
			applyMode(operation.mode);
			canvas?.path(operation.path);
		}
		
		function canChangeMode(): boolean {
			return canvas !== null && state.any(CanvasState.IDLE, CanvasState.BLANK);
		}
		function selectColor(color: typeof erase | string) {
			if (color === erase) {
				if (drawMode.color !== erase) {
					setMode(erase, "thick");
				}
			} else {
				if (drawMode.color === erase) {
					setMode(color, "thin");
				} else {
					setMode(color);
				}
			}
		}
		function toggleWeight() {
			setMode(drawMode.color, drawMode.weight === "thin" ? "thick" : "thin");
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
			applyMode();
			
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
			if (state.is(CanvasState.BLANK) && drawMode.color === erase) {
				return;
			}
			state.set(CanvasState.DRAWING);
			redoStack = [];
			undoStack.push({
				path: new Path(),
				mode: Object.assign({}, drawMode)
			});
		}
		function endDraw() {
			state.set(CanvasState.IDLE);
			let op = undoStack.at(-1)!;
			if (op.mode.weight === "thick") {
				op.path.smooth(1, 1);
			} else {
				op.path.smooth(4, 2);
			}
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
		
		function init(vnode: Micron.Node) {
			
			if (canvas)
				return;
			
			const ctx = (vnode.elm as HTMLCanvasElement).getContext("2d");
			
			if (!ctx)
				throw new Error("Couldn't get canvas context.");
			
			canvas = new Canvas(ctx);
			canvas.clear();
			applyMode();
			canvas.setLineCap("round");
			canvas.setLineJoin("round");
			//canvas.setStrokeStyle("black");
			//canvas.setLineWidth(THIN_LINE_WIDTH);
		}
		
		
		let submittingTimeout: number;
		Micron.tryDefer(
			submitted.subscribe(submit),
			Signal.keydown.subscribe((ev) => {
				if (ev.ctrlKey) {
					const key = ev.key.toLowerCase();
					if (key === 'z') {
						undo();
					} else if (key === 'y') {
						redo();
					}
				}
			}),
		);
		function startSubmit() {
			if (!state.is(CanvasState.IDLE)) {
				return;
			}
			if (onStartSubmit) {
				if (!onStartSubmit()) {
					return;
				}
			}
			clearTimeout(submittingTimeout);
			submittingTimeout = setTimeout(submit, 0.7 * 1000);
		}
		function cancelSubmit() {
			clearTimeout(submittingTimeout);
		}
		
		function Icon(src: string) {
			return h("img", { attrs: { src } });
		}
		
		const colorSelect = s(isDisabled, disabled => {
			return s(drawModeChanged, () => {
				
				function Btn(color: typeof erase | string) {
					
					const selected = drawMode.color === color;
					const click = () => {
						if (canChangeMode()) selectColor(color);
					};
					let backgroundColor;
					let borderColor;
					
					if (color === erase) {
						backgroundColor = "white";
						borderColor = selected ? "black" : "white";
					} else {
						backgroundColor = color;
						borderColor = selected ? "white" : color;
					}
					
					return h("button",
						{
							style: { backgroundColor, borderColor },
							on: { click },
							attrs: { disabled }
						},
						c(color === erase && Icon(icons.eraseThick))
					);
				}
				
				return h("div#color-btn-row", [
					...Shared.DRAW_COLORS.map(color => Btn(color)),
					Btn(erase)
				]);
			});
		});
		const actionSelect = s(isDisabled, (disabled) => {
			
			function WeightBtn() {
				return s(drawModeChanged, () => {

					let iconSrc;
					if (drawMode.color === erase) {
						iconSrc = drawMode.weight === "thin" ? icons.eraseThin : icons.eraseThick;

					} else {
						penIcon.clear();
						penIcon.setFillStyle(drawMode.color);
						penIcon.fillEllipse(64, 64, drawMode.weight === "thin" ? 25 : 40);
						iconSrc = penIcon.element.toDataURL();
					}

					return h(
						"button#weight-btn",
						{
							on: {
								click: () => {
									if (canChangeMode()) toggleWeight();
								}
							},
							attrs: { disabled }
						},
						Icon(iconSrc)
					);
				});
			}
			
			return h("div#action-btn-row", [
				//h("button.spacer", { attrs: { disabled: true } }),
				h("button#undo-btn", { on: { click: undo }, attrs: { disabled } }, Icon(icons.undo)),
				h("button#redo-btn", { on: { click: redo }, attrs: { disabled } }, Icon(icons.redo)),
				WeightBtn(),
				h("button.spacer", { attrs: { disabled: true } }),
				h(
					"button#submit-btn",
					{
						on: {
							pointerdown: startSubmit,
							pointerup: cancelSubmit,
							pointerleave: cancelSubmit
						},
						attrs: { disabled }
					},
					disabled ? "Submitted!" : "Hold to Submit"
				)
			])
		});
		
		return h("div#drawpad", [
			colorSelect,
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
					create: (_emptyNode, vnode) => init(vnode),
					update: (_oldNode, vnode) => init(vnode)
				}
			}, "You don't have canvas support!"),
			actionSelect
		]);
		
		
	}
}

type CanvasColorStyle = string | CanvasGradient | CanvasPattern;

type Point = [number, number];

class Path {
	
	//style: CanvasColorStyle;
	//lineWidth: number;
	//pointData: Array<number> = [];
	
	x: number[] = [];
	y: number[] = [];
	
	/*constructor(style: CanvasColorStyle, lineWidth: number) {
		this.style = style;
		this.lineWidth = lineWidth;
		//this.pointData = start.slice();
	}*/
	*points(): Iterable<Point> {
		for (let i = 0; i < this.x.length; i++)
			yield [this.x[i], this.y[i]];
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
		return this.x.length;
	}
	isEmpty(): boolean {
		return this.length() === 0;
	}
	
	start(): Point | undefined {
		if (this.isEmpty()) return;
		return [this.x[0], this.y[0]];
	}
	end(): Point | undefined {
		if (this.isEmpty()) return;
		return [this.x.at(-1)!, this.y.at(-1)!];
	}
	pop(): Point | undefined {
		if (this.isEmpty()) return undefined;
		return [this.x.pop()!, this.y.pop()!];
	}
	
	push(x: number, y: number) {
		this.x.push(x);
		this.y.push(y);
	}
	
	/*extend(x2: number, y2: number) {
		if (this.length() <= 1) {
			this.push(x2, y2);
			return;
		}
		
		let [x1, y1] = this.pop()!;
		let dx = x1 - x2, dy = y1 - y2;
		let d = dx * dx + dy * dy;
		
		if (d <= 5 * 5) {
			this.push(x1 * 0.5 + x2 * 0.5, y1 * 0.5 + y2 * 0.5);
			this.push(x2, y2);
		}
		
	}*/
	/*smooth() {
		if (this.isEmpty()) return;
		
		const A = 0.5, B = 1.0 - A;
		let x = [], y = [];
		x.push(this.x[0]);
		y.push(this.y[0]);
		for (const [[x1, y1], [x2, y2]] of this.segments()) {
			x.push(x1 * B + x2 * A, x1 * A + x2 * B);
			y.push(y1 * B + y2 * A, y1 * A + y2 * B);
		}
		x.push(this.x.at(-1)!);
		y.push(this.y.at(-1)!);
		this.x = x;
		this.y = y;
	}*/
	
	smooth(omitDistance: number, iterations: number) {
		/* this could use some improvements, but it's a good start */
		if (this.length() <= 2) return;
		
		/* Omit points that are too close to the point immediately before and after them */
		let smoothed = new Path();
		smoothed.push(this.x[0], this.y[0]);
		
		
		const end = this.length() - 1;
		const max = omitDistance * omitDistance;
		for (let i = 1; i < end; i++) {
			const x = this.x[i], y = this.y[i];
			const [px, py] = smoothed.end()!; // previous point
			const x0 = px - x, y0 = py - y;
			const x1 = this.x[i+1] - x, y1 = this.y[i+1] - y; // to next point
			//const x2 = this.x[i+1] - px, y2 = this.y[i+1] - y2;
			const dot = x0 * x1 + y0 * y1
			if (dot >= 0) {
				if (x0 * x0 + y0 * y0 <= max) {
					if (x1 * x1 + y1 * y1 <= max) {
						continue;
					}
				}
			}
			
			
			/**/
			smoothed.push(x, y);
		}
		smoothed.push(...this.end()!);
		this.x = smoothed.x;
		this.y = smoothed.y;
		
		/* Move points around */
		for (let i = 0; i < iterations; i++) {
			let smoothed = new Path();
			smoothed.push(this.x[0], this.y[0]);
			for (const [[x1, y1], [x2, y2]] of this.segments()) {
				let dx = x1 - x2, dy = y1 - y2;
				let d = dx * dx + dy * dy;
				if (d >= 5 * 5) {
					smoothed.push(
						x1 * 0.7 + x2 * 0.3,
						y1 * 0.7 + y2 * 0.3,
					);
					smoothed.push(
						x1 * 0.25 + x2 * 0.75,
						y1 * 0.25 + y2 * 0.75
					);
				} else {
					smoothed.push(
						x1 * 0.5 + x2 * 0.5,
						y1 * 0.5 + y2 * 0.5
					);
				}
				//let length = (x1 - x2) * (x1 - x2) - (y1 - y2) 
			}
			const [ex, ey] = this.end()!;
			smoothed.push(ex, ey);
			this.x = smoothed.x;
			this.y = smoothed.y;
		}
	}
	
}

class Canvas {
	
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




