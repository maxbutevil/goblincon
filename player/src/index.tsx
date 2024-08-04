

import React from "react"
import Signal from "./modules/signal"
import State from "./modules/state"
import { Enum, Variant } from "./modules/variant"
import Extract, { ReceiveIndex, SendIndex } from "./modules/extract"
import client, { Connection } from "./client"
import Globals from "./globals"

import * as Utils from "./modules/utils"
import * as Drawblins from "./drawblins"

const INC = new ReceiveIndex({
	
	terminated: Extract.NONE,
	error: Extract.STRING,
	
	accepted: { playerId: Extract.NUMBER, token: Extract.NUMBER },
	inLobby: { promoted: Extract.BOOL },
	inGame: Extract.NONE, // eventually needs to hold the settings
	
	/* Lobby */
	//promoted: Extract.NONE,
	
});
const OUT = new SendIndex({
	/* Lobby */
	startGame: Extract.NONE
	//requestStart: Extract.NONE
});


type StatusUpdate = null | { type: "info" | "error", message: string };
const status = new State<StatusUpdate>(null);
//let currentStatus: StatusUpdate = Enum.empty("none"); // not actually used as of now


/*function useGlobal<T>(state: State<T>) {
	let [, setState] = React.useState<T>();
	let [, ]
}*/

function statusNone() {
	status.set(null);
}
function statusInfo(message: string) {
	status.set({ type: "info", message });
}
function statusError(message: string) {
	status.set({ type: "error", message });
}
function StatusMessage() {
	let [currentStatus, setStatus] = React.useState<StatusUpdate>(status.get());
	//let forceRerender = use
	React.useEffect(() => {
		return status.changed.subscribe(([, to]) => setStatus(to));
	}, []);
	
	if (currentStatus === null)
		return null;
	
	let className = currentStatus.type === "error" ? "status error" : "status info";
	return <div className={className}>{currentStatus.message}</div>;
}


function Landing() {
	
	const CODE_LENGTH = 5;
	const MIN_NAME_LEN = 2;
	const MAX_NAME_LEN = 16;
	
	//function joinGame(code: string, name: string) {
	function joinGame(code: string, name: string) {
	
		if (!client.state.is(Connection.CLOSED))
			return;
		
		if (code.length !== CODE_LENGTH)
			return statusError("Invalid code");
		if (name.length < MIN_NAME_LEN)
			return statusError("Name too short");
		if (name.length > MAX_NAME_LEN)
			return statusError("Name too long");
		
		Globals.joinCode = code.toUpperCase();
		Globals.setPlayerName(name);
		client.connect(`wss://${window.location.host}/play/join?code=${Globals.joinCode}&name=${name}`);
		
	}
	
	React.useEffect(() => Signal.group(
		client.pending.subscribe(() => {
			statusInfo("Connecting...");
		}),
		client.connectionFailed.subscribe(() => {
			// only show this status after a join attempt (not a rejoin)
			if (Globals.joinCode !== undefined)
				statusError("Join failed; check your code");
			else
				statusNone();
		})
	), []);
	
	Utils.useExternal(client.state);
	const disabled = !client.state.is(Connection.CLOSED);
	const joinCode = React.useRef(Globals.getInitialJoinCode());
	const playerName = React.useRef(Globals.getPlayerName());
	
	//const setCode = (newCode: string) => Globals.joinCode = newCode;
	//const setName = (newName: string) => Globals.setPlayerName(newName);
	
	return (
		<div className="tab" id="landing">
			<h1>GoblinCon</h1>
			<div className="tab">
				<div className="join-input-section">
					<div>Nickname</div>
					<input
						id="name-input"
						maxLength={16}
						disabled={disabled}
						defaultValue={playerName.current}
						onChange={ev => playerName.current = ev.target.value}
					></input>
				</div>
				<div className="join-input-section">
					<div>Join Code</div>
					<input
						id="code-input"
						maxLength={5}
						disabled={disabled}
						defaultValue={joinCode.current}
						onChange={ev => joinCode.current = ev.target.value}
					></input>
				</div>
				<button
					id="join-button"
					disabled={disabled}
					onClick={ev => joinGame(joinCode.current, playerName.current)}
				>
					Join!
				</button>
				<StatusMessage />
			</div>
		</div>
	);
	
}
function Lobby({ promoted }: { promoted: boolean }) {
	
	/*const [showStart, setShowStart] = React.useState(promoted);
	
	React.useEffect(() => Signal.group(
		//INC.subscribe("promoted", () => setShowStart(true)),
	), []);*/
	
	function startGame() {
		OUT.send("startGame", undefined);
	}
	
	return (
		<div className="tab" id="lobby">
			<h1>Lobby!!</h1>
			{promoted && <button id="start-game-button" onClick={startGame}>Start Game</button>}
			<StatusMessage />
		</div>
	);
	
}

type Page = 
	Variant<"landing"> |
	Variant<"lobby", { promoted: boolean }> |
	Variant<"drawblins", { state: State<Drawblins.Page>, cleanup: () => void }>;

const page = new State<Page>(Enum.unit("landing"));

function App() {
	
	const rerender = Utils.useForceRerender();
	page.changed.listen(rerender);
	
	//let [page, setPage] = React.useState<Page>(Enum.unit("landing"));
	
	//React.useEffect(() => Signal.group());
	
	/* Attempt Rejoin */
	React.useEffect(() => {
		let rejoinInfo = Globals.getRejoinInfo();
		console.log(rejoinInfo);
		if (rejoinInfo) {
			//Globals.joinCode = 
			let name = Globals.getPlayerName();
			let { code, playerId, token } = rejoinInfo;
			let params = `code=${code.toUpperCase()}&name=${name}&id=${playerId}&token=${token}`;
			client.connect(`ws://${window.location.host}/play/rejoin?${params}`);
		}
	}, []);
	
	React.useEffect(() => Signal.group(
		/*client.connected.subscribe(() => {
			let rejoinInfo = Globals.getRejoinInfo();
			if (rejoinInfo) {
				
			}
		}),*/
		client.use(INC, OUT),
		client.disconnected.subscribe(() => {
			page.set(Enum.unit("landing"));
		}),
		client.connectionFailed.subscribe(() => {
			Globals.clearRejoinInfo();
			Globals.joinCode = undefined;
		}),
		INC.subscribe("terminated", () => {
			Globals.clearRejoinInfo();
			Globals.joinCode = undefined;
		}),
		INC.subscribe("accepted", ({ playerId, token }) => {
			if (Globals.joinCode) {
				// Only set info if this is our first join; not a rejoin
				Globals.setRejoinInfo({ code: Globals.joinCode, playerId, token });
			} else {
				// 
				Globals.joinCode = Globals.getRejoinInfo()?.code;
			}
		}),
		INC.subscribe("inLobby", ({ promoted }) => {
			statusNone();
			page.set(Enum.variant("lobby", { promoted }));
		}),
		INC.subscribe("inGame", () => {
			//client.pause();
			let state = Drawblins.state();
			page.set(Enum.variant("drawblins", state));
		}),
		INC.subscribe("error", (message) => {
			//statusUpdate.emit(Enum.variant("error", { message }));
			statusError(message)
		}),
		page.changed.subscribe(([from, _to]) => {
			switch(from.key) {
				case "drawblins": from.cleanup(); break;
			}
		})
		/*INC.subscribe("promoted", () => {
			setPage(Enum.variant("lobby", { promoted: true }));
		}),*/
		//client.connected.subscribe(() => setTab("Lobby")),
	), []);
	
	let current = page.get();
	switch(current.key) {
		case "landing": return <Landing />;
		case "lobby": return <Lobby promoted={current.promoted} />;
		case "drawblins": return <Drawblins.Component state={current.state} />;
		//case "drawblins": return Drawblins();
	}
}

import { createRoot } from "react-dom/client";
const root = createRoot(document.getElementById("root")!);
root.render(<App />);



