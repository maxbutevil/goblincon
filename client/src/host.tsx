
import React from "react"
import Signal from "./modules/signal"
import State from "./modules/state"
import { Enum, Variant } from "./modules/variant"
import Extract, { ReceiveIndex, SendIndex } from "./modules/extract"
import client from "./client"
import * as Utils from "./utils"
import * as Room from "./host/room"
import * as Drawblins from "./host/drawblins";

const INC = new ReceiveIndex({
	"accepted": { joinCode: Extract.STRING },
	"terminated": Extract.NONE,
	
	"inLobby": Extract.NONE,
	"gameStarting": Extract.NONE,
	//"gameStarted": Extract.NONE,
	"playerJoined": { playerId: Extract.NUMBER, playerName: Extract.STRING },
	"playerLeft": { playerId: Extract.NUMBER }

	//"drawingSubmitted": { playerId: Extract.NUMBER, drawing: Extract.STRING },
	//"voteSubmitted": { playerId: Extract.NUMBER, forId: Extract.NUMBER }
	
});
const OUT = new SendIndex({
	"terminate": Extract.NONE
});

client.use(INC, OUT);

INC.listen("accepted", ({ joinCode }) => {
	Room.setJoinCode(joinCode);
});
INC.listen("terminated", () =>
	page.set(Enum.unit("landing"))); // should maybe have an error code thing

INC.listen("inLobby", () =>
	page.set(Enum.unit("lobby")));
INC.listen("playerJoined", ({ playerId, playerName }) =>
	Room.handlePlayerJoined(playerId, playerName));
INC.listen("playerLeft", ({ playerId }) =>
	Room.handlePlayerLeft(playerId));
INC.listen("gameStarting", () => {
	// here we relay the game settings and set the page accordingly
	const cleanup = Drawblins.init();
	page.set(Enum.variant("drawblins", { cleanup }));
});
/*INC.listen("gameStarted", () => {
	// here we switch to game page, based on settings (eventually)
	page.set(Enum.unit("drawblins"));
});*/


type Page =
	Variant<"landing"> |
	Variant<"lobby"> |
	Variant<"drawblins", { cleanup: () => void }>;

const page = new State<Page>(Enum.unit("landing"));

page.changed.listen(([from, to]) => {
	if ("cleanup" in from)
		from.cleanup();
});

function App() {
	
	React.useEffect(() => {
		client.connect(`${Utils.wsRoot}/host`);
	}, []);
	
	let { key } = Utils.useExternal(page);
	switch(key) {
		case "landing": return <Landing />;
		case "lobby": return <Lobby />;
		case "drawblins": return <Drawblins.Component />;
	}
}

function Landing() {
	return (
		<div className="tab">
			<h1>Connecting...</h1>
		</div>
	);
}
function Lobby() {
	return (
		<div id="lobby">
			<div className="tab overview">
				<h1>Lobby</h1>
				<div id="join-code">{Room.getJoinCode()}</div>
				<PlayerList />
			</div>
			<div className="tab game-settings">
				<h1>Settings</h1>
				
			</div>
		</div>
	);
}
function SettingSelect() {
	
}
function PlayerList() {
	
	const rerender = Utils.useForceRerender();
	React.useEffect(() => Signal.group(
		Room.playerJoined.subscribe(rerender),
		Room.playerLeft.subscribe(rerender)
	), []);
	
	return (
		<>
			{Room.players.map((player) =>
				<div className="player-name" key={player.name}>
					{player.name}
				</div>
			)}
		</>
	);
}

import { createRoot } from "react-dom/client";
const root = createRoot(document.getElementById("root")!);
root.render(<App />);

