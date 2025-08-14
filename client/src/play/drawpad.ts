

import {
	Signal, State,
	Shared,
	Val,
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

const erase = null;
type DrawMode = { color: string | typeof erase, weight: "thick" | "thin" };

type DrawOperation = {
	path: Path,
	mode: DrawMode
};

type Point = [number, number];
type Segment = [number, number, number, number];
type Operation = Mode & Path;
//type Path = { x: number[], y: number[] };
const a: Operation = { weight: "thick", x: [], y: [], color: null };

enum Drawing {
	//BLANK,
	IDLE,
	DRAWING,
	//LOCKED, // vestigial
	SUBMITTED
};

type DrawpadOptions = {
	key?: string,
	onSubmit: (drawing: string) => void,
	onStartSubmit?: () => boolean
};

//const visibilityChange = Signal.documentEvent("visibilitychange");

/*const DRAWING_DATA = Val.array({
	color: Val.STR,
	weight: Val.choice("thick", "thin"),
	x: Val.array(Val.NUM),
	y: Val.array(Val.NUM)
});*/


class Path {
	
	//style: CanvasColorStyle;
	//lineWidth: number;
	//pointData: Array<number> = [];
	
	x: number[] = [];
	y: number[] = [];
	
	static length({ x }: Path) {
		return x.length;
	}
	static empty({ x }: Path) {
		return x.length === 0;
	}
	static *points({ x, y }: Path): Iterable<Point> {
		for (let i = 0; i < x.length; i++)
			yield [x[i], y[i]];
	}
	static *segments({ x, y }: Path): Iterable<Segment> {
		for (let i = 1; i < x.length; i++) {
			yield [x[i-1], y[i-1], x[i], y[i]];
		}
	}
	static start({ x, y }: Path): Point | undefined {
		return x.length === 0 ? undefined : [x[0], y[0]];
	}
	static end({ x, y }: Path): Point | undefined {
		return x.length === 0 ? undefined : [x.at(-1)!, y.at(-1)!];
	}
	static at({ x, y }: Path, i: number): Point | undefined {
		return i >= x.length ? undefined : [x[i], y[i]]; 
	}
	static push({ x, y }: Path, [px, py]: Point) {
		x.push(px);
		y.push(py);
	}
	static pop({ x, y }: Path): Point | undefined {
		return x.length === 0 ? undefined : [x.pop()!, y.pop()!];
	}
	static smoothed({ x, y }: Path, omitDistance: number, iterations: number): Path {
		/* this could use some improvements, but it's a good start */
		if (x.length <= 2) return { x, y };
		
		/* Omit points that are too close to the point immediately before and after them */
		let smoothed = new Path();
		Path.push(smoothed, Path.start({ x, y })!);
		
		const end = x.length - 1;
		const omitDistanceSq = omitDistance * omitDistance;
		for (let i = 1; i < end; i++) {
			const cx = x[i], cy = y[i];
			const [px, py] = Path.end(smoothed)!; // previous point
			const [nx, ny] = Path.at({ x, y }, i + 1)!;
			const x0 = cx - px, y0 = cy - py; // difference from previous point
			const x1 = nx - cx, y1 = ny - cy; // difference from next point
			const dot = x0 * x1 + y0 * y1;
			if (dot >= 0) {
				if (x0 * x0 + y0 * y0 <= omitDistanceSq) {
					if (x1 * x1 + y1 * y1 <= omitDistanceSq) {
						continue;
					}
				}
			}
			
			Path.push(smoothed, [cx, cy]);
		}
		
		Path.push(smoothed, Path.end({ x, y })!);
		x = smoothed.x;
		y = smoothed.y;

		/* Move points around */
		for (let i = 0; i < iterations; i++) {
			const smoothed = new Path();
			Path.push(smoothed, Path.start({ x, y })!);
			
			for (const [x1, y1, x2, y2] of Path.segments({ x, y })) {
				let dx = x1 - x2, dy = y1 - y2;
				let d = dx * dx + dy * dy;
				if (d >= 5 * 5) {
					Path.push(smoothed, [
						x1 * 0.7 + x2 * 0.3,
						y1 * 0.7 + y2 * 0.3,
					]);
					Path.push(smoothed, [
						x1 * 0.3 + x2 * 0.7,
						y1 * 0.3 + y2 * 0.7
					]);
				} else {
					Path.push(smoothed, [
						x1 * 0.5 + x2 * 0.5,
						y1 * 0.5 + y2 * 0.5
					]);
				}
				//let length = (x1 - x2) * (x1 - x2) - (y1 - y2) 
			}
			Path.push(smoothed, Path.end({ x, y })!);
			x = smoothed.x;
			y = smoothed.y;
		}
		
		function round(n: number): number {
			return Math.round(n * 10) / 10;
		}
		
		x = x.map(round);
		y = y.map(round);
		
		/*const rounded = new Path();
		Path.push(rounded, [Math.round(x[0]), Math.round(y[0])]);
		for (let i = 1; i < x.length; i++) {
			const [cx, cy] = [Math.round(x[i]), Math.round(y[i])];
			const [px, py] = Path.end(rounded)!;
			if (px !== cx || py !== cy) {
				Path.push(rounded, [cx, cy]);
			}
		}
		x = rounded.x;
		y = rounded.y;*/
		
		return { x, y };
	}
	static smooth(path: Path, omitDistance: number, iterations: number) {
		const smoothed = Path.smoothed(path, omitDistance, iterations);
		path.x = smoothed.x;
		path.y = smoothed.y;
	}
	
	constructor(x: number[] = [], y: number[] = []) {
		if (x.length !== y.length) {
			console.error("path with different amount of x and y coordinates");
			this.x = [];
			this.y = [];
		} else {
			this.x = x;
			this.y = y;
		}
	}
		
}

type Mode = { color: string | null, weight: "thick" | "thin" };


export default class Drawpad {
	
	private static readonly defaultMode: Mode = { color: "#000000", weight: "thin" };
	private static readonly storageKey = "savedDrawing";
	
	state = new State<Drawing>(Drawing.IDLE);
	mode = new State<Mode>(
		Drawpad.defaultMode,
		(curr, from) => curr.color === from.color && curr.weight === from.weight
	);
	
	submitted = new Signal<[string]>();
	disabled = this.state.map(s => s === Drawing.SUBMITTED);
	color = this.mode.map(m => m.color);
	weight = this.mode.map(m => m.weight);
	
	options: DrawpadOptions;
	canvas: Canvas | null = null;
	undoStack: Operation[] = [];
	redoStack: Operation[] = [];
	backupIndex = 0;
	backup?: ImageData;
	
	constructor(options: DrawpadOptions) {
		this.options = options;
		
		const ok = this.loadDrawing();
		if (!ok) {
			localStorage.removeItem(Drawpad.storageKey);
		}
		
	}
	
	
	loadDrawing(): boolean {
		
		const { key } = this.options;
		if (!key) {
			return false;
		}
		
		const VAL = {
			mode: {
				color: Val.STR,
				weight: Val.choice("thin", "thick")
			},
			ops: Val.array({
				color: Val.STR,
				weight: Val.choice("thin", "thick"),
				x: Val.array(Val.ANY),
				y: Val.array(Val.ANY)
			})
		};
		
		try {
			console.log(`loading drawing (${key})`);
			const encoded = localStorage.getItem(Drawpad.storageKey);
			if (!encoded) return false;
			
			const data = JSON.parse(encoded);
			
			if (data.key !== key) {
				return false;
			}
			if (!Val.is(VAL, data)) {
				console.error("error parsing drawing data: ", data);
				return false;
			}
			
			const { mode, ops } = data;
			
			this.mode.set(mode);
			this.undoStack = ops;
			return true;
		} catch(err) {
			
			//this.canvas?.clear();
			//this.undoStack = [];
			
			console.error("error loading drawing: ", err);
			return false;
		}
	}
	saveDrawing() {
		//console.log(ops)
		
		if (this.state.is(Drawing.SUBMITTED)) {
			return;
		}
		
		const { key } = this.options;
		const mode = this.mode.get();
		const ops = this.undoStack;
		const data = { key, mode, ops };
		
		try {
			console.log(`saving drawing (${key})`);
			localStorage.setItem(Drawpad.storageKey, JSON.stringify(data));
		} catch (err) {
			console.error("error saving drawing: ", err);
		}
	}
	
	
	applyMode({ color, weight } = this.mode.get()) {
		
		const canvas = this.canvas;
		if (!canvas) return;
		
		canvas.setLineWidth(
			weight === "thin" ?
				THIN_LINE_WIDTH :
				THICK_LINE_WIDTH
		);
		
		if (color === erase) {
			canvas.setOperation("destination-out");
		} else {
			canvas.setStrokeStyle(color);
			canvas.setOperation(
				weight === "thin" ?
					"source-over" :
					"destination-over"
			); // thin pen draws over existing content; thick pen draws under
		}
	}
	setMode(mode: Mode) {
		this.applyMode(mode);
		this.mode.set(mode);
	}
	
	setColor(color: string | null) {
		const { weight } = this.mode.get();
		this.setMode({ color, weight });
	}
	selectColor(color: string | null) {
		const prev = this.mode.get();
		if (color === erase) {
			// color -> erase; set pen to thick
			this.setMode({ color, weight: "thick" });
		} else if (prev.color === erase) {
			// erase -> color; set pen to thin
			this.setMode({ color, weight: "thin" })
		} else {
			// color -> color; keep pen
			this.setMode({ color, weight: prev.weight });
		}
	}
	setWeight(weight: "thin" | "thick") {
		const { color } = this.mode.get();
		this.setMode({ color, weight });
	}
	toggleWeight() {
		const { weight } = this.mode.get();
		this.setWeight(weight === "thin" ? "thick" : "thin");
	}
	
	applyOperation(op: Operation) {
		this.applyMode(op);
		this.canvas?.path(op);
	}
	applyOperationRange(start = 0, end = Infinity) {
		end = Math.min(end, this.undoStack.length);
		for (let i = start; i < end; i++)
			this.applyOperation(this.undoStack[i]);
	}
	
	
	storeBackup(index: number) {
		this.backupIndex = index;
		this.backup = this.canvas?.getImageData();
	}
	restoreBackup() {
		if (!this.canvas) return;
		
		this.canvas.clear();
		if (this.backup) {
			this.canvas.putImageData(this.backup);
		}
	}
	rebuildBackup(index: number) {
		if (!this.canvas) return;
		
		if (index < 0)
			index = 0;
		else if (index > this.undoStack.length)
			index = this.undoStack.length;
		
		if (index === this.backupIndex) {
			// identical to the old backup, just restore
			this.restoreBackup();
		} else if (index > this.backupIndex) {
			// we can refer to the old backup, so just use that
			this.restoreBackup();
			this.applyOperationRange(this.backupIndex, index);
			this.storeBackup(index);
		} else {
			// we have to rebuild everything, so do that
			this.canvas.clear();
			this.applyOperationRange(0, index);
			this.storeBackup(index);
		}
	}
	rebuild() {
		
		const index = this.undoStack.length;
		
		if (index < this.backupIndex) // rebuild the backup, we're going deeper
			this.rebuildBackup(index - BACKUP_MED_LAG);
		else if (index > this.backupIndex + BACKUP_MAX_LAG) // catch up
			this.rebuildBackup(index - BACKUP_MIN_LAG);
		else // stay where we are
			this.rebuildBackup(this.backupIndex);

		// now apply everything that happened since the backup
		this.applyOperationRange(this.backupIndex);
		this.applyMode(); // keep the same user settings

	}
	
	private pop(redoable = false) {
		if (!this.canvas || this.undoStack.length === 0) return;
		if (!this.state.is(Drawing.IDLE)) return; // ?????
		
		const op = this.undoStack.pop()!;
		if (redoable) this.redoStack.push(op);
		
		this.rebuild();
	}
	abort() {
		this.pop(false);
	}
	undo() {
		this.pop(true);
	}
	redo() {
		if (!this.canvas || this.redoStack.length === 0)
			return;
		if (!this.state.is(Drawing.IDLE))
			return;
		
		const op = this.redoStack.pop()!;
		this.undoStack.push(op);
		this.applyOperation(op); // don't really need to mess with the backup here
		this.applyMode();
	}
	
	draw({ offsetX, offsetY }: PointerEvent) {
		
		if (!this.canvas) return;
		
		const op = this.undoStack.at(-1)!;
		const prev = Path.end(op);
		const curr = this.canvas.map(offsetX, offsetY);
		curr[0] = Math.round(curr[0]);
		curr[1] = Math.round(curr[1]);
		const [x, y] = curr;
		
		const inBounds = (
			x >= 0 && x <= this.canvas.sourceWidth &&
			y >= 0 && y <= this.canvas.sourceHeight
		);
		
		if (!prev) {
			if (!inBounds) {
				this.endDraw();
				return;
			}
			
			// some platforms won't draw a path at all without this fuzzing
			this.canvas.line(x + 0.001, y + 0.001, x, y);
			Path.push(op, curr);
		} else {
			
			const [px, py] = prev;
			this.canvas.line(px, py, x, y);
			Path.push(op, curr);
			
			if (!inBounds) {
				this.endDraw();
			}
		}
		
		/*if (!prev) {
			
		} else {
			const [px, py] = prev;
			if (px === x && py === y) {
				return;
			}
			this.canvas.line(px, py, x, y);
			
		}
		
		Path.push(op, [x, y]);
		
		// if we go out of bounds, finish and end the current operation
		if (x < 0 || y < 0 || x > this.canvas.sourceWidth || y > this.canvas.sourceHeight) {
			this.endDraw();
		}
			
		
		
		
		if (prev) {
			const [px, py] = prev;
			
		} else {
			
		}
		
		//const [x, y] = this.canvas.map(offsetX, offsetY);
		//x = Math.round(x);
		//y = Math.round(y);
		
		
		//const [x, y] = this.canvas.map(offsetX, offsetY);
		const [px, py] = Path.end(op) ?? [x + 0.01, y + 0.01]; // if this is the first point, just draw a dot at x, y
		
		this.canvas!.line(px, py, x, y);
		Path.push(op, [x, y]);*/

		
	}
	startDraw() {
		const { color, weight } = this.mode.get();
		
		if (this.isBlank() && color === erase)
			return;
		
		this.state.set(Drawing.DRAWING);
		this.redoStack = [];
		this.undoStack.push({ x: [], y: [], color, weight });
	}
	endDraw() {
		this.state.set(Drawing.IDLE);
		const op = this.undoStack.at(-1)!;
		if (Path.length(op) === 0) {
			this.undoStack.pop();
			return;
		} else if (op.weight === "thick") {
			Path.smooth(op, 1, 1);
		} else {
			Path.smooth(op, 4, 2);
		}
		this.rebuild();
	}
	handleDraw(ev: PointerEvent) {
		if (!ev.isPrimary || !this.canvas)
			return;
		if (!this.state.is(Drawing.DRAWING))
			return;
		this.draw(ev);
	}
	handleStartDraw(ev: PointerEvent) {
		if (this.state.is(Drawing.DRAWING)) {
			this.endDraw();
			
			// this is so you can pinch zoom without leaving a point or short line under the first finger to touch the canvas
			const op = this.undoStack.at(-1);
			if (op && Path.length(op) <= 3) {
				this.abort();
			}
			
			return;
		}
		
		if (!ev.isPrimary || !this.canvas)
			return;
		if (this.state.is(Drawing.SUBMITTED))
			return;
		
		this.startDraw();
		this.draw(ev);
	}
	handleEndDraw(ev: PointerEvent) {
		if (!ev.isPrimary || !this.state.is(Drawing.DRAWING))
			return;
		this.draw(ev);
		this.endDraw();
	}
	
	submit() {
		if (this.isBlank() || this.state.is(Drawing.SUBMITTED))
			return;
		if (this.canvas === null)
			return console.error("Couldn't get canvas data");
		
		this.state.set(Drawing.SUBMITTED);
		const drawingData = this.canvas.element.toDataURL("image/png");
		this.submitted.emit(drawingData);
	}
	
	init(vnode: Micron.Node) {
		if (this.canvas) {
			console.warn("Drawpad.init() called multiple times");
		}
		
		const ctx = (vnode.elm as HTMLCanvasElement).getContext("2d");
		if (!ctx) throw new Error("Couldn't get canvas context.");
		
		const canvas = this.canvas = new Canvas(ctx);
		canvas.clear();
		canvas.setLineCap("round");
		canvas.setLineJoin("round");
		
		try {
			this.applyOperationRange(0, Infinity);
		} catch(err) {
			console.error("error with loaded canvas data", err)
			this.undoStack = [];
			this.mode.set(Drawpad.defaultMode);
		}
		
		this.applyMode();
		
		//this.applyMode();
		//canvas.setStrokeStyle("black");
		//canvas.setLineWidth(THIN_LINE_WIDTH);
	}
	
	isBlank() {
		return this.undoStack.length === 0;
	}
	isIdle() {
		//return this.state.is(Drawing.IDLE);
	}
	isSubmitted() {
		return this.state.is(Drawing.SUBMITTED);
	}
	
	Icon(src: string) {
		return h("img", { attrs: { src } });
	}
	ColorSelect() {
		
		return s(this.disabled, disabled => {
			return s(this.mode, mode => {
				
				const Btn = (color: string | null) => {

					const click = () => {
						if (this.state.is(Drawing.IDLE)) {
							this.selectColor(color);
						}
					};

					const selected = mode.color === color;
					let backgroundColor, borderColor;

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
						c(color === erase && this.Icon(icons.eraseThick))
					);
				};
				
				return h("div#color-btn-row", [
					...Shared.DRAW_COLORS.map(Btn),
					Btn(erase)
				]);
			});
		});
	}
	ActionSelect() {
		
		let submittingTimeout: number;
		
		const penIcon = Canvas.create(128, 128);
		
		
		const submit = this.submit.bind(this);
		const startSubmit = () => {
			if (this.isBlank() || !this.state.is(Drawing.IDLE))
				return;
			
			const { onStartSubmit } = this.options;
			if (onStartSubmit) {
				if (!onStartSubmit()) {
					return;
				}
			}
			
			clearTimeout(submittingTimeout);
			submittingTimeout = setTimeout(submit, 0.7 * 1000);
		};
		const cancelSubmit = () => {
			clearTimeout(submittingTimeout);
		};
		
		return s(this.disabled, disabled => {
			
			const undo = this.undo.bind(this);
			const redo = this.redo.bind(this);
			
			const weightBtn = s(this.mode, ({ color, weight }) => {
				
				let iconSrc;
				if (color === erase) {
					iconSrc = weight === "thin" ? icons.eraseThin : icons.eraseThick;
				} else {
					penIcon.clear();
					penIcon.setFillStyle(color);
					penIcon.fillEllipse(64, 64, weight === "thin" ? 24 : 44);
					iconSrc = penIcon.element.toDataURL();
				}

				return h(
					"button#weight-btn",
					{
						on: {
							click: () => {
								if (this.state.is(Drawing.IDLE)) {
									this.toggleWeight();
								}
							}
						},
						attrs: { disabled }
					},
					this.Icon(iconSrc)
				);
			});
			
			return h("div#action-btn-row", [
				//h("button.spacer", { attrs: { disabled: true } }),
				h("button#undo-btn", { on: { click: undo }, attrs: { disabled } }, this.Icon(icons.undo)),
				h("button#redo-btn", { on: { click: redo }, attrs: { disabled } }, this.Icon(icons.redo)),
				weightBtn,
				h("button.spacer", { attrs: { disabled: true } }),
				h("button#submit-btn",
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
	}
	View() {
		
		const handleStartDraw = this.handleStartDraw.bind(this);
		const handleEndDraw = this.handleEndDraw.bind(this);
		const handleDraw = this.handleDraw.bind(this);
		
		Micron.tryDefer(
			//submitted.subscribe(submit),
			Signal.documentEvent("keydown").subscribe((ev) => {
				if (ev.ctrlKey) {
					const key = ev.key.toLowerCase();
					if (key === 'z') {
						this.undo();
					} else if (key === 'y') {
						this.redo();
					}
				}
			}),
			Signal.documentEvent("visibilitychange").subscribe((ev) => {
				if (document.hidden) {
					this.saveDrawing();
				}
			})
		);
		
		return h("div#drawpad", [
			this.ColorSelect(),
			h("canvas#canvas", {
				attrs: {
					width: Shared.SUBMISSION_SIZE,
					height: Shared.SUBMISSION_SIZE
				},
				on: {
					pointerdown: handleStartDraw,
					pointerup: handleEndDraw,
					pointerleave: handleEndDraw,
					pointermove: handleDraw
				},
				hook: {
					create: (_emptyNode, vnode) => this.init(vnode),
					update: (_oldNode, vnode) => this.init(vnode)
				}
			}, "You don't have canvas support!"),
			this.ActionSelect()
		]);
	}
}

type CanvasColorStyle = string | CanvasGradient | CanvasPattern;

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
		
		const length = Path.length(path);
		if (length === 0) return;
		
		const [sx, sy] = Path.start(path)!;
		
		// mildly shitty hack because some browsers won't draw anything if the start and end are identical
		this.ctx.beginPath();
		this.ctx.moveTo(sx + 0.001, sy + 0.001);
		for (let i = 0; i < length; i++)
			this.ctx.lineTo(path.x[i], path.y[i]);
		
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




