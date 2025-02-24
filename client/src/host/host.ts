
import "../shared.css"
import "./host.css"

import {
	Val, ReceiveIndex, SendIndex,
	client,
	Shared,
	h, s, projector, patchRoot, VNode
} from "../modules/index"
import {
	logo,
	mountedBtn
} from "../components/index"
import { exit as exitIcon } from "../assets/icons/index"

import * as Room from "./room"
import { Player } from "./room"
import { Setting } from "./mode"
import Drawblins from "./drawblins"
import Dating from "./dating"

const INC = new ReceiveIndex({
	"inLobby": { leaderId: Val.NUM },
	"gameStarting": Val.NONE,
});

const OUT = new SendIndex({
	"terminate": Val.NONE,
	"kickPlayer": { "playerId": Val.NUM },
	
	"startGame": Val.unchecked<
		ReturnType<typeof Drawblins.remote> |
		ReturnType<typeof Dating.remote>
	>(),
});

client.closed.listen((ev) => {
	if (ev.reason) {
		page.put(error, `${ev.reason}`);
	} else {
		page.put(error, "Fatal connection error");
	}
});

INC.listen("inLobby", ({ leaderId }) => {
	Room.setLeaderId(leaderId);
	page.put(lobby);
});

INC.listen("gameStarting", () => {
	// here we relay the game settings and set the page accordingly
	OUT.send("startGame", mode.get().remote());
	page.put(mode.get().view);
});

const page = projector(loading);
//const mode = new Setting<"drawblins" | "dating">("Game Mode", [ "drawblins", "dating" ], 0);

const mode = new Setting<typeof Dating | typeof Drawblins>(
	"Game Mode",
	[ Drawblins, Dating ],
	1,
	(m) => m.name
);

function error(message: string) {
	return h("div.tab", [
		h("h1", "Error :("),
		h("h3", message),
		h("button", { on: { click: connect } }, "Reconnect"),
	]);
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
		copy(`https://${window.location.host}/play?code=${Room.joinCode}`);
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
				s(mode.changed, () => {
					return h("div.vflow.game-settings", [
						h("h2", "Settings"),
						mode.view(),
						...mode.get().settingViews()
					]);
				})
			]),
			mountedBtn(exitIcon, () => location.href = "/")
		]
	);
}
function playerList() {
	
	const signals = [
		Room.playerJoined,
		Room.playerLeft,
		Room.playerIconChanged
	];
	
	return s(signals, () => {
		let children: VNode[];
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

function connect() {
	client.connect(`${Shared.wsRoot}/host`);
}
function app() {
	client.use(INC, OUT);
	connect();
	return s(page);
}

patchRoot(app());

window.addEventListener("DOMContentLoaded", async () => {
	try {
		console.log("requesting wake lock");
		await navigator.wakeLock.request();
	} catch(err) {
		console.error("error acquiring wake lock:", err);
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


