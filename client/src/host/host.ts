
import "../shared.css"
import "./host.css"

import {
	State, Variant, unit, variant,
	Validate, ReceiveIndex, SendIndex,
	client,
	Shared,
	//PlayerIcons,
	patchRoot, h, fragment, signaled, stateful
} from "../modules/index"
import logo from "../components/logo"

import * as Room from "./room"
import { Player } from "./room"
import * as Drawblins from "./drawblins"
import Setting from "./setting"



const INC = new ReceiveIndex({
	
	"terminated": Validate.NONE,
	
	"inLobby": { leaderId: Validate.NUMBER },
	"gameStarting": Validate.NONE,
	//"gameStarted": Validate.NONE,
	

	//"drawingSubmitted": { playerId: Validate.NUMBER, drawing: Validate.STRING },
	//"voteSubmitted": { playerId: Validate.NUMBER, forId: Validate.NUMBER }
	
});
const OUT = new SendIndex({
	"terminate": Validate.NONE,
	"kickPlayer": { "playerId": Validate.NUMBER },
	"startGame": Validate.branch(
		{
			mode: Validate.fixed<"drawblins">("drawblins"),
			settings: {
				roundCount: Validate.NUMBER,
				drawTimeFactor: Validate.NUMBER,
				voteTimeFactor: Validate.NUMBER
			}
		}
	)
});

/*client.disconnected.listen(() => {
	if (page.get().key !== "landing") {
		page.set(unit("landing"));
	}
});*/
INC.listen("terminated", () =>
	page.set(unit("landing"))); // should maybe have an error code thing

INC.listen("inLobby", ({ leaderId }) => {
	Room.setLeaderId(leaderId);
	page.set(unit("lobby"))
});

INC.listen("gameStarting", () => {
	// here we relay the game settings and set the page accordingly
	switch(mode.get()) {
		case "drawblins":
			OUT.send("startGame", {
				mode: "drawblins",
				settings: Drawblins.getSettingsRemote()
			});
			page.set(unit("drawblins"));
			break;
		default: /* Something went wrong somehow, handle */
	}
});

type Page =
	Variant<"landing"> |
	Variant<"lobby"> |
	Variant<"drawblins">;

const page = new State<Page>(unit("landing"));
const mode = new Setting<"drawblins">("Game Mode", [ "drawblins" ]);

//window.addEventListener("DOMContentLoaded", () => {


patchRoot(app());
function app() {
	client.use(INC, OUT);
	client.connect(`${Shared.wsRoot}/host`);
	
	return stateful(page, (curr) => {
		switch (curr.key) {
			case "landing": return landing();
			case "lobby": return lobby();
			case "drawblins": return Drawblins.view();
			default: return h("div", {});
		}
	});
}

function landing() {
	return h(
		"div#landing.tab", {},
		[
			h("h1", {}, "Connecting...")
		]
	);
}
function lobby() {
	return h(
		"div.tab",
		[
			logo(),
			h("div#lobby", {}, [
				h("div.tab.overview", {}, [
					h("h1", {}, "Lobby"),
					h("div", {}, [
						h("h2", {}, "Join Code"),
						h("div#join-code", {}, Room.joinCode)
					]),
					h("div", {}, [
						h("h2", {}, "Players"),
						playerList()
					]),
				]),
				h("div.tab.game-settings", {}, [
					h("h1", {}, "Settings"),
					Setting.view(mode),
					modeSettings()
				])
			])
		]
	);
}
function modeSettings() {
	
	let settingsMap;
	
	switch (mode.get()) {
		case "drawblins": settingsMap = Drawblins.settings;
	}
	
	return Setting.multiView(settingsMap);
}
function playerList() {
	
	const signals = [
		Room.playerJoined,
		Room.playerLeft,
		Room.playerIconChanged
	];
	return signaled(signals, () => {
		if (Room.playerCount() === 0) {
			return h("div.player-name", "No players yet!");
		} else {
			const players = Array.from(Room.players.values());
			return fragment(players.map((player) => Player.view(player)));
		}
	});
}

window.onbeforeunload = (event) => {
	if (Room.playerCount() > 0) {
		event.preventDefault();
		return true;
	}	else {
		client.close();
	}
}


