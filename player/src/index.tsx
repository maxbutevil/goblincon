


import React from "react";
import client, { Connection } from "./client"
import Signal from "./modules/signal"
//import State from "./modules/state"
import { Variant } from "./modules/variant"
import Canvas, { Path } from "./canvas"



let joinCode = new URLSearchParams(window.location.search).get("code") ?? "";
let playerName = localStorage.getItem("playerName") ?? "";


let canStartGame = false;
let votingChoices: Array<string> = [];


/*type DrawingMode =
		Variant<"color", { size: "small" | "big", color: string }>
	| Variant<"erasing">;*/

const statusUpdate = new Signal<StatusUpdate>();

type StatusUpdate =
	Variant<"none"> |
	Variant<"error", { message: string }> |
	Variant<"info", { message: string}>;

function statusNone() {
	statusUpdate.emit({ key: "none" });
}
function statusInfo(message: string) {
	statusUpdate.emit({ key: "info", message });
}
function statusError(message: string) {
	statusUpdate.emit({ key: "error", message });
}
function StatusMessage() {
	
	let [status, setStatus] = React.useState<StatusUpdate>({ key: "none" });
	React.useEffect(() => {
		return statusUpdate.subscribe((update) => {
			setStatus(update);
		});
	}, []);
	
	if (status.key === "none" || status.message === undefined)
		return undefined;
	
	let className = status.key === "error" ? "status error" : "status info";
	return <div className={className}>{status.message}</div>;
	
}
function Landing() {
	
	const CODE_LENGTH = 5;
	const MIN_NAME_LEN = 2;
	const MAX_NAME_LEN = 16;
	
	function joinGame(code: string, name: string) {
		
		if (!client.state.is(Connection.CLOSED))
			return;
		
		if (code.length != CODE_LENGTH)
			return statusError("Invalid code");
		if (name.length < MIN_NAME_LEN)
			return statusError("Name too short");
		if (name.length > MAX_NAME_LEN)
			return statusError("Name too long");
		
		client.connect(`ws://127.0.0.1:5050/play/ws?code=${code.toUpperCase()}&name=${name}`);
		
	}
	
	
	React.useEffect(() => Signal.group(
		client.pending.subscribe(() => {
			statusInfo("Connecting...");
		}),
		client.connectionFailed.subscribe(() => {
			statusError("Join failed; check your code");
		})
	), []);
	
	const setCode = (newCode: string) => joinCode = newCode;
	const setName = (newName: string) => {
		try {
			localStorage.setItem("playerName", playerName = newName);
		} catch(e) {
			console.error(e);
		}
	}
	
	return (
		<div className="tab" id="landing">
			<h1>GoblinCon</h1>
			<div className="tab">
				<div className="join-input-section">
					<div>Nickname</div>
					<input id="name-input" defaultValue={playerName} onChange={ev => setName(ev.target.value)}></input>
				</div>
				<div className="join-input-section">
					<div>Join Code</div>
					<input id="code-input" defaultValue={joinCode} onChange={ev => setCode(ev.target.value)}></input>
				</div>
				<button id="join-button" onClick={ev => joinGame(joinCode, playerName)}>Join!</button>
				<StatusMessage />
			</div>
		</div>
	);
	
}
function Lobby() {
	
	const [showStart, setShowStart] = React.useState(canStartGame);
	
	React.useEffect(() => {
		return client.inc.subscribe("promoted", () => setShowStart(true));
	}, []);
	
	function startGame() {
		client.out.send("startGame", undefined);
	}
	
	return (
		<div className="tab" id="lobby">
			<h1>Lobby!!</h1>
			{showStart && <button id="start-game-button" onClick={startGame}>Start Game</button>}
			<StatusMessage />
		</div>
	);
	
}
function Start() {
	
	return (
		<div className="tab" id="start">
			<h1>Game!!</h1>
		</div>
	);
	
}




/*
REMINDER TO UNFUCK:
do some line shit to fix the joining
"round" line joining is fire
*/

function useForceRerender(): () => void {
	var [, setState] = React.useState({});
	return React.useCallback(() => setState({}), []);
}
function rerenderOn<V>(signal: Signal) {
	
}

//type DrawMode = 
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
//const drawingSubmitted = new Signal();
function DrawPad() {
	
	//const [enabled, setEnabled] = React.useState(true);
	//const MAX_UNDO_QUEUE_SIZE = 10;
	const BACKUP_MAX_LAG = 18; // if current backup is at least this out of date, rebuild (catch up)
	const BACKUP_MED_LAG = 10; // if we undo past the current backup, how far back to we jump?
	const BACKUP_MIN_LAG = 2; // leave this buffer when catching up, so that a few undos don't cause a full rebuild
	const THIN_LINE_WIDTH = 8;
	const THICK_LINE_WIDTH = 20;
	const ERASER_WIDTH = 20;
	
	let enabled = true;
	
	const canvasElementRef = React.useRef<HTMLCanvasElement>(null);
	
	let canvas: Canvas | undefined;
	let drawing = false;
	
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
		
		const rerenderColorSelect = useForceRerender();
		
		function ColorButton({ color }: { color: string }) {
			
			const isSelected = drawMode.key === "draw" && drawMode.style === color;
			let borderColor = isSelected ? "white" : color;
			
			return (
				<button
					className="button color-select-button"
					style={{
						backgroundColor: color,
						border: `3px solid ${borderColor}`
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
		
		if (!enabled || !canvas)
			return;
		if (undoStack.length === 0)
			return;
		
		redoStack.push(undoStack.pop()!);
		rebuildCanvas();
		
	}
	function redo() {
		
		if (!enabled || !canvas)
			return;
		if (redoStack.length === 0)
			return;
		
		let op = redoStack.pop()!;
		undoStack.push(op);
		applyOperation(op); // don't really need to mess with the backup here
		
	}
	
	function draw(ev: React.MouseEvent) {
		
		if (!enabled || !drawing || !canvas)
			return;
		
		let op = undoStack.at(-1)!;
		let [x, y] = canvas.map(ev.nativeEvent.offsetX, ev.nativeEvent.offsetY);
		let [px, py] = op.path.end() ?? [x, y]; // if this is the first point, just draw a dot at x, y
		canvas.line(px, py, x, y);
		op.path.push(x, y);
		//let startX = canvas.mapX(ev.nativeEvent.offsetX - ev.movementX);
		//let startY = canvas.mapY(ev.nativeEvent.offsetY - ev.movementY);
		
	}
	function startDraw(ev: React.MouseEvent) {
		if (drawing || !canvas)
			return;
		
		redoStack = [];
		undoStack.push({
			path: new Path(),
			mode: Object.assign({}, drawMode)
		});
		
		drawing = true;
		draw(ev);
	}
	function endDraw(ev: React.MouseEvent) {
		
		if (!drawing)
			return;
		
		draw(ev);
		drawing = false;
		rebuildCanvas();
		
	}
	
	function toggleLineWidth() {
		
		if (drawing || !canvas || !enabled)
			return;
		
		if (drawMode.key === "draw") {
			drawMode.weight = drawMode.weight === "thin" ? "thick" : "thin";
			applyMode();
		}
		
	}
	
	function submit() {
		
		if (!enabled)
			return false;
		if (canvasElementRef.current === null)
			return console.error("Couldn't get canvas data");
		
		//canvasElementRef.current.getContext("2d")?.getImageData
		
		let drawing = canvasElementRef.current
			.toDataURL("image/png")
			.replace("data:image/png;base64,", "");
		client.out.send("drawingSubmission", { drawing });
		enabled = false; // Don't want to rerender here, will reset the canvas
		
	}
	
	React.useEffect(() => {
		return client.inc.subscribe("drawingTimeout", () => {
			submit();
		});
	}, [canvasElementRef]);
	
	React.useEffect(() => {
		
		let ctx = canvasElementRef.current?.getContext("2d");
		
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
		
	}, [canvasElementRef.current]);
	
	return (
		<div id="drawpad">
			<ColorSelect />
			<canvas 
				id="canvas"
				key="canvas"
				width="360px" height="360px"
				ref={canvasElementRef}
				onMouseDown= {startDraw}
				onMouseUp=   {endDraw}
				onMouseLeave={endDraw}
				onMouseMove= {draw}
			>
				You don't have canvas support!
			</canvas>
			<div id="draw-utils" className="button-row">
				<button id="undo-button" className="button" onClick={undo}>Undo</button>
				<button id="redo-button" className="button" onClick={redo} style={{backgroundColor:"grey"}}>Redo</button>
				<button id="weight-button" className="button" onClick={toggleLineWidth}></button>
				<button id="spacer-button" className="button" disabled={true}></button>
				<button id="submit-button" className="button" onClick={submit}>Submit</button>
			</div>
		</div>
	);
	
}
function Draw() {
	
	/*function submitDrawing() {
		//client.out.send("drawingSubmission", { drawing: })
		drawingSubmitted.emit();
	}*/
	
	return (
		<div className="tab" id="draw">
			<DrawPad />
		</div>
	);
	
}

function VoteButton({ name, submitVote }: { name: string, submitVote: (name: string) => void }) {
	
	return (
		<button className="vote-button" onClick={() => submitVote(name)}>{name}</button>
	);
	
}
function Vote() {
	
	const [hasVoted, setHasVoted] = React.useState(false);
	
	const submitVote = (forName: string) => {
		client.out.send("voteSubmission", { forName });
		setHasVoted(true);
	};
	
	return (
		<div className="tab" id="vote">
			<h1>Voting time!!</h1>
			{!hasVoted && (
				votingChoices
					.filter((name: string) => name != playerName) // can't vote for yourself
					.map((name: string) => <VoteButton key={name} name={name} submitVote={submitVote}></VoteButton>)
			)}
		</div>
	);
}
function Score() {
	return (
		<div className="tab" id="score">
			<h1>Scoring time!!</h1>
		</div>
	);
}
function Idle() {
	return (
		<div className="tab" id="idle">
			<h1>Waiting...</h1>
		</div>
	);
}

const Tabs = {
	Landing,
	Lobby,
	Start,
	Draw,
	Vote,
	Score,
	Idle,
};

function App() {
	
	const [tab, setTab] = React.useState<keyof typeof Tabs>("Draw");//"Draw");//"Landing");
	const Tab = Tabs[tab];
	
	React.useEffect(() => Signal.group(
		
		client.inc.subscribe("statusUpdate", ({ kind, message } : { kind: "info" | "error", message: string }) => {
			statusUpdate.emit({ key: kind, message });
		}),
		//client.connected.subscribe(() => setTab("Lobby")),
		client.inc.subscribe("lobbyJoined", ({ promoted }: { promoted: boolean }) => {
			canStartGame = promoted;
			setTab("Lobby");
		}),
		client.inc.subscribe("gameStarted", () => setTab("Start")),
		client.inc.subscribe("drawingStarted", () => setTab("Draw")),
		client.inc.subscribe("scoringStarted", () => setTab("Score")),
		
		client.inc.subscribe("gameTerminated", () => {
			setTab("Landing");
		}),
		client.inc.subscribe("votingStarted", ({ choices }: { choices: Array<string> }) => {
			votingChoices = choices;
			setTab("Vote");
		}),
		
		//client.inc.subscribe("promoted", () => promoted = true)
		
	), []);
	
	/*React.useEffect(() => {
		client.phase.changed.subscribe(([oldPhase, newPhase]: [Phase, Phase]) => {
			switch (newPhase) {
				case Phase.NONE: setTab("Landing"); break;
				case Phase.LOBBY: setTab("Lobby"); break;
				case Phase.START: setTab("Start"); break;
				case Phase.DRAW: setTab("Draw"); break;
				case Phase.VOTE: setTab("Vote"); break;
				case Phase.SCORE: setTab("Score"); break;
			}
		});
	}, []);*/
	
	return <div id="app"><Tab /></div>
  
}



import { createRoot } from "react-dom/client";
const root = createRoot(document.getElementById("root")!);
root.render(<App />);


