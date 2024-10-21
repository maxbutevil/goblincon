

import {
	Signal, State, Variant, unit, variant,
	Validate, ReceiveIndex, SendIndex,
	Shared,
	client,// Connection,
	h, conditional, stateful, contained, cleaned
} from "../modules/index"

import Globals from "./globals"

import countdown from "../components/countdown"
import Canvas, { Path } from "../modules/canvas"

import * as icons from "../assets/drawpad/index"

const INC = new ReceiveIndex({
	waiting: Validate.choice<"start" | "draw" | "vote" | "results" | "score">("start", "draw", "vote", "results", "score"),
	drawing: { goblinName: Validate.STRING, secsLeft: Validate.NUMBER },
	voting: { choices: Validate.array(Validate.STRING), secsLeft: Validate.NUMBER },
});
const OUT = new SendIndex({
	drawingSubmission: { drawing: Validate.STRING },
	voteSubmission: { forName: Validate.STRING },
});

export type Page = 
	Variant<"start"> |
	Variant<"draw", { goblinName: string, endTime: number }> |
	Variant<"drawingSubmitted"> |
	Variant<"vote", { choices: Array<string>, endTime: number }> |
	Variant<"voteSubmitted"> |
	Variant<"score">;

const page = new State(unit("start") as Page);
const drawingAutoSubmit = new Signal();

export function view() {
	
	page.set(unit("start"));
	
	const cleanup = Signal.group(
		client.use(INC, OUT),
		INC.subscribe("waiting", (kind) => {
			switch(kind) {
				case "start": page.set(unit("start")); break;
				case "results": case "score": page.set(unit("score")); break;
				case "draw": page.set(unit("drawingSubmitted")); break;
				case "vote": page.set(unit("voteSubmitted")); break;
			}
		}),
		INC.subscribe("drawing", ({ goblinName, secsLeft }: { goblinName: string, secsLeft: number }) => {
			let endTime = Date.now() + 1000 * (secsLeft - 5); // shave off some time to allow for automatic submission
			page.set(variant("draw", { goblinName, endTime }));
		}),
		INC.subscribe("voting", ({ choices, secsLeft }) => {
			let endTime = Date.now() + 1000 * (secsLeft - 1);
			page.set(variant("vote", { choices, endTime }));
		})
	)
	
	return cleaned(
		cleanup,
		() => stateful(page, (curr) => {
			switch(curr.key) {
				case "start": return start();
				case "draw": return draw(curr.endTime, curr.goblinName);
				case "drawingSubmitted": return drawingSubmitted();
				case "vote": return vote(curr.endTime, curr.choices);
				case "voteSubmitted": return voteSubmitted();
				case "score": return score();
			}
		})
	);
}

function start() {
	return h("div#start.tab", h("h1", "Game!!"));
}
function drawPad() {
	
	const BACKUP_MAX_LAG = 18; // if current backup is at least this out of date, rebuild (catch up)
	const BACKUP_MED_LAG = 10; // if we undo past the current backup, how far back to we jump?
	const BACKUP_MIN_LAG = 2; // leave this buffer when catching up, so that a few undos don't cause a full rebuild
	const THIN_LINE_WIDTH = 8;
	const THICK_LINE_WIDTH = 20;
	const ERASER_WIDTH = 20;
	
	type DrawWeight = "thick" | "thin";
	//type DrawMode = Variant<"erase"> | Variant<"draw", { style: string, weight: DrawWeight }>;
	// Note that erase 
	type DrawMode = { type: "erase" | "draw", weight: "thick" | "thin", color: string };
	type DrawOperation = {
		path: Path,
		mode: DrawMode
	};
	
	enum CanvasState {
		BLANK,
		IDLE,
		DRAWING,
		SUBMITTED
	};
	
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
		return state.any(CanvasState.IDLE, CanvasState.BLANK) && canvas !== null;
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
	
	function colorSelect() {
		
		return contained(rerender => {
			
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
						}
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
				...Shared.COLORS.map(color => colorButton(color)),
				eraseButton()
			]);
		});
		
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
		
		if (!canvas) return;
		
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
	
	function undo() {
		
		if (state.get() !== CanvasState.IDLE)
			return;
		if (!canvas || undoStack.length === 0)
			return;
		
		redoStack.push(undoStack.pop()!);
		rebuildCanvas();
		
		let isBlank = (backupIndex === 0 && undoStack.length === 0);
		if (isBlank)
			state.set(CanvasState.BLANK);
	}
	function redo() {
		
		if (state.get() === CanvasState.SUBMITTED || !canvas)
			return;
		if (redoStack.length === 0)
			return;
		
		state.set(CanvasState.IDLE);
		let op = redoStack.pop()!;
		undoStack.push(op);
		applyOperation(op); // don't really need to mess with the backup here
		
	}
	
	function draw(ev: PointerEvent) {
		
		if (state.get() !== CanvasState.DRAWING)
			return;
		if (!ev.isPrimary || !canvas)
			return;
		
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
	function handleStartDraw(ev: PointerEvent) {
		
		if (!ev.isPrimary || !canvas)
			return;
		if (state.any(CanvasState.SUBMITTED, CanvasState.DRAWING))
			return;
		
		startDraw();
		draw(ev);
	}
	function handleEndDraw(ev: PointerEvent) {
		if (!ev.isPrimary)
			return;
		if (state.get() !== CanvasState.DRAWING)
			return;
		draw(ev);
		endDraw();
	}
	
	function lineWidthBtn() {
		return contained(rerender => {
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
					}
				},
				icon(iconSrc)
			);
		});
	}
	
	function submit() {
		
		if (state.any(CanvasState.BLANK, CanvasState.SUBMITTED))
			return;
		if (canvas === null)
			return console.error("Couldn't get canvas data");
		
		let drawing = canvas.element.toDataURL("image/png");
			//.replace("data:image/png;base64,", "");
		
		state.set(CanvasState.SUBMITTED);
		OUT.send("drawingSubmission", { drawing });
		page.set(unit("drawingSubmitted"));
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
	
	const cleanup = drawingAutoSubmit.subscribe(submit);
	
	function icon(src: string) {
		return h("img", {  attrs: { src } });
	}
	
	return cleaned(
		cleanup,
		() => h("div#drawpad", [
			colorSelect(),
			h("canvas#canvas", {
				attrs: {
					width: 360,
					height: 360
				},
				on: {
					pointerdown: handleStartDraw,
					pointerup: handleEndDraw,
					pointerleave: handleEndDraw,
					pointermove: draw
				},
				hook: {
					create: (emptyVnode, vnode) => {
						init(vnode.elm as HTMLCanvasElement)
					}
				}
			}, "You don't have canvas support!"),
			h("div#draw-utils.btn-row", [
				h("button#undo-btn", { on: { click: undo }}, icon(icons.undo)),
				h("button#redo-btn", { on: { click: redo }}, icon(icons.redo)),
				lineWidthBtn(),
				h("button#spacer-btn", { attrs: { disabled: true } }),
				h("button#submit-btn", { on: { click: submit }}, "Submit")
			])
		])
	);
}
function draw(endTime: number, goblinName: string) {
	return h("div#draw.tab", [
		h("div#goblin-name", goblinName),
		drawPad(),
		countdown(endTime, () => drawingAutoSubmit.emit())
	]);
}
function vote(endTime: number, choices: string[]) {
	
	const submitVote = (forName: string) => {
		OUT.send("voteSubmission", { forName });
		page.set(unit("voteSubmitted"));
	};
	
	return h("div#vote.tab", [
		h("h1", "Vote!!"),
		countdown(endTime),
		...(choices.map(name => 
			(name === Globals.playerName) ? null : // can't vote for yourself
				h(
					"button",
					{	on: { click: () => submitVote(name) } },
					name
				)
		))
	]);
}
function idle(header: string, subheader?: string) {
	return h("div#idle.tab", [
		h("h1", header),
		conditional(subheader, h("h2", subheader))
	]);
}
function drawingSubmitted() {
	return idle("You've Submitted!", "Waiting for other players to finish drawing...");
}
function voteSubmitted() {
	return idle("You've Voted!", "Waiting for other players to vote...");
}
function score() {
	return idle("Results");
}




