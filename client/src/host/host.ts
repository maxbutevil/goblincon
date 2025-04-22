
import "./host.scss"

import {
	Signal, State,
	Val, ReceiveIndex, SendIndex,
	client,
	Shared,
	h, s, c, defer, projector, mount, VNode
} from "../modules/"
import {
	Logo,
	Tray,
	IconBtn
} from "../components"
import * as icons from "../assets/icons/"

import * as Room from "./room"
import { Player } from "./room"
import { Mode, Setting } from "./mode"
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

const page = projector(Loading);
const mode = new Setting<typeof Dating | typeof Drawblins>(
	"Game Mode",
	[ Drawblins, Dating ],
	{ key: "gameMode", initial: 1, stringifier: (m) => m.name }
);
//let prevMode: Mode<any> | undefined = undefined;
let unloading = false; // not the most elegant solution, but this stops the error page from showing when we click a link

client.closed.listen((ev) => {
	if (!unloading) {
		if (ev.reason) {
			page.put(Error, `${ev.reason}`);
		} else {
			page.put(Error, "Fatal connection error");
		}
	}
});
window.addEventListener("DOMContentLoaded", async () => {
	try {
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
		unloading = true;
		client.close();
	}
});

function Error(message: string) {
	return h("div.tab", [
		h("h1", "Error :("),
		h("h3", message),
		h("button", { on: { click: connect } }, "Reconnect"),
	]);
}
function Loading() {
	return h(
		"div#loading.tab", {},
		[
			h("h1", {}, "Connecting...")
		]
	);
}
function Lobby() {
	
	const overlay = new State<null | ((close: () => void) => VNode)>(null);
	defer(Signal.keydown.subscribe((ev) => {
		if (ev.key === "Escape") overlay.set(null);
	}));
	
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
			Logo(),
			h("div#lobby", {}, [
				h("div#overview.tab", {}, [
					h("h2", "Lobby"),
					h("div", [
						h("h3", "Join Code"),
						h("div#join-code", {}, Room.joinCode),
						h("div.multi-btn", /* { style: { fontSize: "0.8em" } },*/ [
							h("button", { on: { click: copyCode } }, "Copy Code"),
							h("button", { on: { click: copyLink } }, "Copy Link")
						]),
					]),
					h("div",
						{ style: { fontSize: "0.7em" } },
						[
							"(Join at ",
							h("u", Shared.httpsRoot),
							")"
						]
					),
					PlayerList()
				]),
				s(mode.changed, () => {
					return h("div#settings.tab", [
						h("h2", "Settings"),
						mode.View(),
						...mode.get().settingViews()
					]);
				})
			]),
			s(overlay, curr => curr ? curr(() => overlay.set(null)) : h("!")),
			Tray(
				IconBtn(icons.exit, () => location.href = "/"),
				c(
					Room.recap !== undefined &&
					IconBtn(icons.recap, () => overlay.toggle(Room.recap!, null))
				)
			)
		]
	);
}
function PlayerList() {
	
	const signals = [
		Room.playerJoined,
		Room.playerLeft,
		Room.playerIconChanged
	];
	
	return s(signals, () => {
		
		let status: string;
		let list = Room.players()
			.map(player => player.View());
		
		if (Room.playerCount() === 0) {
			status = "No players yet!";
		} else if (Room.playerCount() < Shared.MIN_PLAYER_COUNT) {
			status = `Need ${Shared.MIN_PLAYER_COUNT} to start!`;
		} else if (Room.playerCount() === Shared.MAX_PLAYER_COUNT) {
			status = "Room is full!";
		} else {
			status = "Ready to start!";
		}
		
		return h("div#player-list", [
			h("h3", {}, `Players (${Room.playerCount()}/${Shared.MAX_PLAYER_COUNT})`),
			h("div#status", status),
			...list
		]);
	});
}

function connect() {
	client.connect(`${Shared.wsRoot}/host`);
}
function App() {
	client.use(INC, OUT);
	INC.listen("inLobby", ({ leaderId }) => {
		Room.setLeaderId(leaderId);
		page.put(Lobby);
	});
	INC.listen("gameStarting", () => {
		// here we relay the game settings and set the page accordingly
		OUT.send("startGame", mode.get().remote());
		page.put(mode.get().view);
	});
	
	connect();
	return s(page);
}

mount(App());


