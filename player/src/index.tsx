


import React, { useState } from "react";
import client, { Connection, Phase } from "./client"
import Signal from "./modules/signal"
import Canvas from "./canvas"

let code = new URLSearchParams(window.location.search).get("code") ?? "";
let name = localStorage.getItem("playerName") ?? "";

function joinGame(code: string, name: string) {
	if (client.state.is(Connection.CLOSED)) {
		client.connect(`ws://127.0.0.1:5050/play/ws?code=${code.toUpperCase()}&name=${name}`);
	}
}
function Landing() {
	
	enum MessageType {
		NONE,
		LOADING,
		ERROR
	}
	
	let [[messageType, messageContent], setMessage] = React.useState([MessageType.NONE, ""]);
	React.useEffect(() => Signal.group(
		client.connectionFailed.subscribe(() => {
			setMessage([MessageType.ERROR, "Join Error"]);
		}
	)), []);
	
	
	const setCode = (newCode: string) => code = newCode;
	const setName = (newName: string) => {
		try {
			localStorage.setItem("playerName", name = newName);
		} catch(e) {
			console.error(e);
		}
	}
	
	return (
		<div id="tab landing">
			<h1>GoblinCon</h1>
			<div>
				<div>Nickname</div>
				<input id="name-input" defaultValue={name} onChange={ev => setName(ev.target.value)}></input>
			</div>
			<div>
				<div>Join Code</div>
				<input id="code-input" defaultValue={code} onChange={ev => setCode(ev.target.value)}></input>
			</div>
			<button id="join-button" onClick={ev => joinGame(code, name)}>Join!</button>
			{messageType == MessageType.LOADING && <div className="join-message loading">{messageContent}</div>}
			{messageType == MessageType.ERROR && <div className="join-message error">{messageContent}</div>}
		</div>
	);
	
}
function Lobby() {
	
	return (
		<div id="tab lobby">
			<h1>Lobby!!</h1>
		</div>
	);
	
}
function Start() {
	
	return (
		<div id="tab start">
			<h1>Game!!</h1>
		</div>
	);
	
}


type DrawCanvasArgs = {
	canvasRef: React.RefObject<HTMLCanvasElement>,
	startDraw: (ev: React.MouseEvent) => void,
	endDraw: (ev: React.MouseEvent) => void,
	draw: (ev: React.MouseEvent) => void
};
function DrawCanvas({ canvasRef, startDraw, endDraw, draw }: DrawCanvasArgs) {
	
	return (
		<canvas 
			id="canvas"
			width="360px" height="360px"
			ref={canvasRef}
			onMouseDown= {startDraw}
			onMouseUp=   {endDraw}
			onMouseLeave={endDraw}
			onMouseMove= {draw}
		>
			You don't have canvas support!
		</canvas>
	);

}


const colors = [
	"#FF0000",
	"#FF9900",
	"#FFFF00",
	"#00FF00",
	"#0099FF",
	"#0000FF",
	"#9900FF",
	"#000000",
];

function ColorButton({ color, setColor }: { color: string, setColor: (color: string) => void }) {
	
	const unselectedStyle = {
		backgroundColor: color
		
	};
	/*const selectedStyle = {
		backgroundColor: props.color
	}*/
	
	
	return (
		<button
			className="color-select-button"
			style={unselectedStyle}
			onClick={ev => setColor(color)}
		/>
	);
	
}
function ColorSelect({ setColor }: { setColor: (color: string) => void }) {
	
	return (
		<div id="color-select">
			{colors.map(color => <ColorButton key={color} color={color} setColor={setColor} />)}
		</div>
	);
	
}
function DrawPad() {
	
	//const [enabled, setEnabled] = React.useState(true);
	
	let enabled = true;
	
	const canvasElementRef = React.useRef<HTMLCanvasElement>(null);
	
	let canvas: Canvas | undefined;
	let drawing = false;
	
	const setColor = (color: string) => {
		canvas?.setStrokeStyle(color);
	}
	
	const draw = (ev: React.MouseEvent) => {
		
		if (!enabled || !drawing || !canvas)
			return;
		
		canvas.line(
			canvas.mapX(ev.nativeEvent.offsetX),
			canvas.mapY(ev.nativeEvent.offsetY),
			canvas.mapX(ev.nativeEvent.offsetX - ev.movementX),
			canvas.mapY(ev.nativeEvent.offsetY - ev.movementY)
		);
		
	}
	const startDraw = (ev: React.MouseEvent) => {
		
		if (drawing)
			return;
		
		drawing = true;
		draw(ev);
		
	}
	const endDraw = (ev: React.MouseEvent) => {
		
		if (!drawing)
			return;
		
		drawing = false;
		draw(ev);
		
	}
	
	React.useEffect(() => {
		
		let ctx = canvasElementRef.current?.getContext("2d");
		
		if (!ctx)
			throw new Error("Couldn't get canvas context.");
		
		canvas = new Canvas(ctx);
		
		canvas.wipeStyle("white");
		canvas.setStrokeStyle("black");
		canvas.setLineWidth(8);
		canvas.setLineCap("round");
		
	}, [canvasElementRef.current]);
	
	return (
		<div id="drawpad">
			<ColorSelect setColor={setColor} />
			<DrawCanvas
				canvasRef={canvasElementRef}
				startDraw={startDraw}
				endDraw={endDraw}
				draw={draw}
			/>
		</div>
	);
	
}
function Draw() {
	
	return (
		<div id="tab draw">
			<h1>Drawing time!!</h1>
			<DrawPad />
			<button id="drawing-submit-button"></button>
		</div>
	);
	
}
function Vote() {
	return (
		<div id="tab vote">
			<h1>Voting time!!</h1>
		</div>
	);
}
function Score() {
	return (
		<div id="tab score">
			<h1>Scoring time!!</h1>
		</div>
	);
}
function Idle() {
	return (
		<div id="tab idle">
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
	
	const [tab, setTab] = React.useState<keyof typeof Tabs>("Landing");//"Draw");//"Landing");
	const Tab = Tabs[tab];
	
	React.useEffect(() => {
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
	}, []);
	
	return <div id="app"><Tab /></div>
  
}



import { createRoot } from "react-dom/client";
const root = createRoot(document.getElementById("root")!);
root.render(<App />);


