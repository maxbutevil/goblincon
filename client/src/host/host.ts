
import "../shared.css"
import "./host.css"

import {
	State, Variant, unit, variant,
	Validate, ReceiveIndex, SendIndex,
	client,
	Shared,
	//PlayerIcons,
	patchRoot, h, signaled, stateful
} from "../modules/index"
import logo from "../components/logo"

import * as Room from "./room"
import { Player } from "./room"
import * as Drawblins from "./drawblins"
import Setting from "./setting"

import { exit as exitIcon } from "../assets/icons/index" 



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
	page.set(unit("loading"))); // should maybe have an error code thing

INC.listen("inLobby", ({ leaderId }) => {
	Room.setLeaderId(leaderId);
	page.set(unit("lobby"));
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
	Variant<"loading"> |
	Variant<"lobby"> |
	Variant<"drawblins">;

const page = State.deep<Page>(unit("loading"));
const mode = new Setting<"drawblins">("Game Mode", [ "drawblins" ]);

//window.addEventListener("DOMContentLoaded", () => {


patchRoot(app());
function app() {
	client.use(INC, OUT);
	client.connect(`${Shared.wsRoot}/host`);
	
	return stateful(page, (curr) => {
		switch (curr.key) {
			case "loading": return loading();
			case "lobby": return lobby();
			case "drawblins": return Drawblins.view();
			default: return h("div", {});
		}
	});
}

function loading() {
	return h(
		"div#loading.tab", {},
		[
			h("h1", {}, "Connecting...")
		]
	);
}
function lobby() {
	
	function copy(text: string) {
		navigator.clipboard.writeText(text).catch(() => {
			console.error("Couldn't write to clipboard; check browser settings.");
		});
	}
	function copyCode() {
		copy(Room.joinCode);
	}
	function copyLink() {
		//wss://${window.location.host}/ws
		copy(`https://${window.location.host}/play?code=${Room.joinCode}`);
	}
	
	function exitBtn() {
		return h("div.mounted-btn-vflow", [
			h("button#exit-btn",
				{ on: { click: () => location.href = "/" } },
				h("img#exit-btn-icon", { attrs: { src: exitIcon }})
			)
		]);
	}
	
	return h(
		"div.tab",
		[
			logo(),
			h("div#lobby", {}, [
				h("div.vflow.overview", {}, [
					h("h2", "Lobby"),
					h("div", [
						h("h3", "Join Code"),
						h("div#join-code", {}, Room.joinCode),
						h("div.multi-btn", { style: { fontSize: "0.8em" } }, [
							h("button", { on: { click: copyCode } }, "Copy Code"),
							h("button", { on: { click: copyLink } }, "Copy Link")
						]),
					]),
					playerList()
				]),
				h("div.vflow.game-settings", {}, [
					h("h2", "Settings"),
					Setting.view(mode),
					...modeSettings()
				])
			]),
			exitBtn(),
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
		let children;
		if (Room.playerCount() === 0) {
			children = [ h("div", "No players yet!") ];
		} else {
			const players = Array.from(Room.players.values());
			children = players.map((player) => Player.view(player));
		}
		
		return h("div.player-list", {}, [
			h("h3", {}, "Players"),
			...children
		]);
	});
}

window.addEventListener("DOMContentLoaded", async () => {
	try {
		console.log("requesting wake lock");
		await navigator.wakeLock.request();
	} catch(err) {
		console.error("error acquiring wake lock: ", err);
	}
});
window.addEventListener("beforeunload", (event) => {
	if (Room.playerCount() > 0) {
		event.preventDefault();
		return true;
	}	else {
		client.close();
	}
});


