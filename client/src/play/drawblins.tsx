


import React from "react";
import client, { Connection } from "../client"
import Signal from "../modules/signal"
import State from "../modules/state"
import { Enum, Variant } from "../modules/variant"
import Extract, { ReceiveIndex, SendIndex } from "../modules/extract";
import Globals from "./globals"
import Canvas, { Path } from "../components/canvas"
import Countdown from "../components/countdown"
import * as Utils from "../utils"




const INC = new ReceiveIndex({
	
	//starting: Extract.NONE,
	waiting: Extract.choice<"start" | "draw" | "vote" | "results" | "score">("start", "draw", "vote", "results", "score"),
	drawing: { goblinName: Extract.STRING, secsLeft: Extract.NUMBER },
	voting: { choices: Extract.array(Extract.STRING), secsLeft: Extract.NUMBER },
	//scoring: Extract.NONE,
	
	
	
	//scoringStarted: Extract.NONE,
	
});
const OUT = new SendIndex({
	drawingSubmission: { drawing: Extract.STRING },
	voteSubmission: { forName: Extract.STRING },
});

export type Page = 
	Variant<"start"> |
	Variant<"draw", { goblinName: string, endTime: number }> |
	Variant<"drawingSubmitted"> |
	Variant<"vote", { choices: Array<string>, endTime: number }> |
	Variant<"voteSubmitted"> |
	Variant<"score">;

/* Global state (mildly cursed) */
const page = new State(Enum.unit("start") as Page);
const drawingAutoSubmit = new Signal();

export function init(): () => void {
	
	page.set(Enum.unit("start")); /* TODO: Maybe a dedicated loading/connecting page instead */
	return Signal.group(
		client.use(INC, OUT),
		INC.subscribe("waiting", (kind) => {
			switch(kind) {
				case "start": page.set(Enum.unit("start")); break;
				case "results": case "score": page.set(Enum.unit("score")); break;
				case "draw": page.set(Enum.unit("drawingSubmitted")); break;
				case "vote": page.set(Enum.unit("voteSubmitted")); break;
			}
		}),
		INC.subscribe("drawing", ({ goblinName, secsLeft }: { goblinName: string, secsLeft: number }) => {
			let endTime = Date.now() + 1000 * (secsLeft - 5); // shave off some time to allow for automatic submission
			page.set(Enum.variant("draw", { goblinName, endTime }));
		}),
		INC.subscribe("voting", ({ choices, secsLeft }) => {
			let endTime = Date.now() + 1000 * (secsLeft - 1);
			page.set(Enum.variant("vote", { choices, endTime }));
		}),
		
		//drawingSubmitted.subscribe(() => page.set(Enum.unit("drawingSubmitted"))),
		//voteSubmitted.subscribe(() => page.set(Enum.unit("voteSubmitted"))),
	);
}
export function Component() {
	
	const current = Utils.useExternal(page);
	
	//let page = state.get();
	switch(current.key) {
		case "draw": return <Draw goblinName={current.goblinName} endTime={current.endTime} />;
		case "drawingSubmitted": return <DrawingSubmitted />;
		case "vote": return <Vote choices={current.choices} endTime={current.endTime} />;
		case "voteSubmitted": return <VoteSubmitted />;
		case "score": return <Score />;
		default: return <Start />;
	}
	
}

function Start() {
	return (
		<div className="tab" id="start">
			<h1>Game!!</h1>
		</div>
	);
}
function DrawPad() {
	
	type DrawWeight = "thick" | "thin";
	type DrawMode = Variant<"erase"> | Variant<"draw", { style: string, weight: DrawWeight }>;
	type DrawOperation = {
		path: Path,
		mode: DrawMode
	};
	
	let undoStack: Array<DrawOperation> = [];
	let redoStack: Array<DrawOperation> = [];
	let backup: ImageData | undefined;
	let backupIndex = 0;
	let drawMode: DrawMode = { key: "draw", style: "#000000", weight: "thin" };
	
	//const [enabled, setEnabled] = React.useState(true);
	//const MAX_UNDO_QUEUE_SIZE = 10;
	const BACKUP_MAX_LAG = 18; // if current backup is at least this out of date, rebuild (catch up)
	const BACKUP_MED_LAG = 10; // if we undo past the current backup, how far back to we jump?
	const BACKUP_MIN_LAG = 2; // leave this buffer when catching up, so that a few undos don't cause a full rebuild
	const THIN_LINE_WIDTH = 8;
	const THICK_LINE_WIDTH = 20;
	const ERASER_WIDTH = 20;
	
	enum CanvasState {
		BLANK,
		IDLE,
		DRAWING,
		SUBMITTED
	};
	
	const state = React.useRef(CanvasState.BLANK);
	
	//const canvasRef = React.useRef<HTMLCanvasElement>(null);
	//const drawpadRef = React.useRef<HTMLDivElement>(null);
	const canvasRef = React.useRef<HTMLCanvasElement>(null);
	
	let canvas: Canvas | undefined;
	
	//let drawing = false;
	
	function setMode(mode: DrawMode) {
		applyMode(drawMode = mode);
	}
	function selectErase() {
		setMode({ key: "erase" });
	}
	function selectColor(style: string) {
		setMode({ key: "draw", style, weight: drawMode.key === "draw" ? drawMode.weight : "thin" });
	}
	//function selectColor
	function applyMode(mode: DrawMode = drawMode) {
		
		if (canvas == undefined) return;
		
		switch(mode.key) {
			case "erase":
				canvas.setOperation("destination-out");
				canvas.setLineWidth(ERASER_WIDTH);
				break;
			case "draw":
				canvas.setStrokeStyle(mode.style);
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
	
	function ColorSelect() {
		
		const COLORS = [
			"#ff0000",
			"#ff9900",
			"#ffff00",
			"#00ff00",
			"#0099ff",
			"#0000ff",
			"#9900ff",
			"#000000",
		]; // must be lowercase
		
		const rerenderColorSelect = Utils.useForceRerender();
		
		function ColorButton({ color }: { color: string }) {
			
			const isSelected = drawMode.key === "draw" && drawMode.style === color;
			let borderColor = isSelected ? "white" : color;
			
			return (
				<button
					className="button color-select-button"
					style={{
						backgroundColor: color,
						borderColor
					}}
					onClick={ev => {
						selectColor(color);
						rerenderColorSelect();
					}}
				/>
			);
		}
		
		function EraseButton() {
			const isSelected = drawMode.key === "erase";
			let borderColor = isSelected ? "black" : "white";
			return (
				<button
					className="button erase-select-button"
					style={{
						backgroundColor: "white",
						border: `3px solid ${borderColor}`
					}}
					onClick={ev => {
						selectErase();
						rerenderColorSelect();
					}}
				/>
			);
		}
		
		return (
			<div id="color-select" className="button-row">
				{COLORS.map(color => <ColorButton key={color} color={color} />)}
				<EraseButton />
			</div>
		);
		
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
		
		if (state.current !== CanvasState.IDLE)
			return;
		if (!canvas || undoStack.length === 0)
			return;
		
		redoStack.push(undoStack.pop()!);
		rebuildCanvas();
		
		let isBlank = (backupIndex === 0 && undoStack.length === 0);
		if (isBlank)
			state.current = CanvasState.BLANK;
	}
	function redo() {
		
		if (state.current === CanvasState.SUBMITTED || !canvas)
			return;
		if (redoStack.length === 0)
			return;
		
		state.current = CanvasState.IDLE;
		let op = redoStack.pop()!;
		undoStack.push(op);
		applyOperation(op); // don't really need to mess with the backup here
		
	}
	
	function draw(ev: React.PointerEvent) {
		
		if (state.current !== CanvasState.DRAWING)
			return;
		if (!ev.isPrimary || !canvas)
			return;
		
		let [x, y] = canvas.map(ev.nativeEvent.offsetX, ev.nativeEvent.offsetY);
		
		let op = undoStack.at(-1)!;
		let [px, py] = op.path.end() ?? [x + 0.01, y + 0.01]; // if this is the first point, just draw a dot at x, y
		canvas.line(px, py, x, y);
		op.path.push(x, y);
		
		if (x < 0 || y < 0 || x > canvas.sourceWidth || y > canvas.sourceHeight)
			endDraw();
		
	}
	function startDraw() {
		state.current = CanvasState.DRAWING;
		redoStack = [];
		undoStack.push({
			path: new Path(),
			mode: Object.assign({}, drawMode)
		});
	}
	function endDraw() {
		state.current = CanvasState.IDLE;
		rebuildCanvas();
	}
	function handleStartDraw(ev: React.PointerEvent) {
		
		if (!ev.isPrimary || !canvas)
			return;
		if (state.current === CanvasState.DRAWING)
			return;
		if (state.current === CanvasState.SUBMITTED)
			return;
		
		startDraw();
		draw(ev);
	}
	function handleEndDraw(ev: React.PointerEvent) {
		if (state.current !== CanvasState.DRAWING)
			return;
		if (!ev.isPrimary)
			return;
		draw(ev);
		endDraw();
	}
	
	function toggleLineWidth() {
		
		if (state.current === CanvasState.SUBMITTED)
			return;
		if (state.current === CanvasState.DRAWING)
			return;
		if (!canvas)
			return;
		
		if (drawMode.key === "draw") {
			drawMode.weight = (drawMode.weight === "thin" ? "thick" : "thin");
			applyMode();
		}
	}
	
	function submit() {
		
		if (state.current === CanvasState.BLANK)
			return;
		if (state.current === CanvasState.SUBMITTED)
			return;
		if (canvasRef.current === null)
			return console.error("Couldn't get canvas data");
		
		//canvasRef.current.getContext("2d")?.getImageData
		let drawing = canvasRef.current
			.toDataURL("image/png");
			//.replace("data:image/png;base64,", "");
		
		state.current = CanvasState.SUBMITTED;
		OUT.send("drawingSubmission", { drawing });
		page.set(Enum.unit("drawingSubmitted"));
	}
	
	/*React.useEffect(() => INC.subscribe("drawingTimeout", () => {
		submit();
	}), []);*/
	React.useEffect(() => drawingAutoSubmit.subscribe(submit), []);
	React.useEffect(() => {
		
		let ctx = canvasRef.current?.getContext("2d");
		
		if (!ctx)
			throw new Error("Couldn't get canvas context.");
		
		canvas = new Canvas(ctx);
		//canvas.wipeStyle("white");
		canvas.clear();
		canvas.setStrokeStyle("black");
		canvas.setLineWidth(THIN_LINE_WIDTH);
		canvas.setLineCap("round");
		canvas.setLineJoin("round");
		
		return () => {
			undoStack = [];
			redoStack = [];
			backup = undefined;
			backupIndex = 0;
			drawMode = { key: "draw", style: "#000000", weight: "thin" };
		};
	}, []);
	
	return (
		<div id="drawpad">
			<ColorSelect />
			<canvas
				id="canvas"
				key="canvas"
				width="360px" height="360px"
				ref={canvasRef}
				onPointerDown= {handleStartDraw}
				onPointerUp=   {handleEndDraw}
				onPointerLeave={handleEndDraw}
				onPointerMove= {draw}
			>
				You don't have canvas support!
			</canvas>
			<div id="draw-utils" className="button-row">
				<button id="undo-button" className="button" onClick={undo}>&lt;</button>
				<button id="redo-button" className="button" onClick={redo} style={{backgroundColor:"grey"}}>&gt;</button>
				<button id="weight-button" className="button" onClick={toggleLineWidth}></button>
				<button id="spacer-button" className="button" disabled={true}></button>
				<button id="submit-button" className="button" onClick={submit}>Submit</button>
			</div>
		</div>
	);
	
}
function Draw({ goblinName, endTime }: { goblinName: string, endTime: number }) {
	return (
		<div className="tab" id="draw">
			<div id="goblin-name">{goblinName}</div>
			<DrawPad />
			<Countdown endTime={endTime} onFinish={() => drawingAutoSubmit.emit()} />
		</div>
	);
}
function Vote({ choices, endTime }: { choices: Array<string>, endTime: number }) {
	
	function VoteButton({ name, submitVote }: { name: string, submitVote: (name: string) => void }) {
		return (
			<button className="vote-button" onClick={() => submitVote(name)}>{name}</button>
		);
	}
	
	const submitVote = (forName: string) => {
		OUT.send("voteSubmission", { forName });
		page.set(Enum.unit("voteSubmitted"));
	};
	
	return (
		<div className="tab" id="vote">
			<h1>Vote!!</h1>
			<Countdown endTime={endTime} />
			{
				choices
					.filter((name: string) => name !== Globals.playerName) // can't vote for yourself
					.map((name: string) => <VoteButton key={name} name={name} submitVote={submitVote}></VoteButton>)
			}
		</div>
	);
}
function Idle({ header, subheader }: { header: string, subheader?: string }) {
	return (
		<div className="tab" id="idle">
			<h1>{header}</h1>
			{subheader && <h2>{subheader}</h2>}
		</div>
	);
}
function DrawingSubmitted() {
	return <Idle header="You've Submitted!" subheader="Waiting for other players to finish drawing..." />;
}
function VoteSubmitted() {
	return <Idle header="You've Voted!" subheader="Waiting for other players to vote..." />;
}
function Score() {
	return <Idle header="Results!" />
}




