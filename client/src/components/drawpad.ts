

import {
	Signal, State,
	Shared,
	h, s, defer
} from "../modules/index"

//import Globals from "../modules/globals"

import Canvas, { Path } from "../modules/canvas"

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
	
	private readonly autoSubmit = new Signal();
	
	submit() {
		this.autoSubmit.emit();
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
			
			let drawingData = canvas.element.toDataURL("image/png");
				//.replace("data:image/png;base64,", "");
			
			state.set(CanvasState.SUBMITTED);
			onSubmit(drawingData);
			//OUT.send("drawingSubmission", { drawing });
			//page.set(unit("drawingSubmitted"));
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
		
		function init(canvasElement: HTMLCanvasElement) {
			let ctx = canvasElement.getContext("2d");
			
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
		defer(this.autoSubmit.subscribe(submit));
		
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
						create: (emptyVnode, vnode) => {
							init(vnode.elm as HTMLCanvasElement)
						}
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


