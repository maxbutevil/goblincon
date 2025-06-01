
import "./host.scss"

import {
	Signal, State,
	Val, ReceiveIndex, SendIndex,
	client, Connection,
	Shared,
	h, s, c, Micron
} from "../modules/"
import {
	Logo,
	Nav,
	TrayLeft
} from "../components"
import * as icons from "../assets/icons/"

import Room from "./room"
import { Mode, Setting } from "./mode"
import Drawblins, { test as drawblinsTest } from "./drawblins"
import Dating, { test as datingTest } from "./dating"

import { qrcodegen } from "./qrcodegen"

const INC = new ReceiveIndex({
	"accepted": { joinCode: Val.STR },
	
	"inLobby": { leaderId: Val.NUM },
	"playerJoined": { playerId: Val.NUM, name: Val.STR, icon: Val.NUM },
	"playerLeft": { playerId: Val.NUM },
	"playerDisconnected": { playerId: Val.NUM },
	"playerReconnected": { playerId: Val.NUM },
	"playerIconChanged": { playerId: Val.NUM, icon: Val.NUM },
	
	"gameStarting": Val.NONE,
});

const OUT = new SendIndex({
	"terminate": Val.NONE,
	"kickPlayer": { "playerId": Val.NUM },
	
	"startGame": Val.unchecked<
		ReturnType<typeof Drawblins.settingsRemote> |
		ReturnType<typeof Dating.settingsRemote>
	>(),
});

const page = Micron.projector(Loading);
const mode = new Setting<typeof Dating | typeof Drawblins>(
	"Game Mode",
	[ Drawblins, Dating ],
	{ key: "gameMode", initial: 1, stringifier: (m) => m.name }
);
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
	if (Room.players.count > 0 && client.state.is(Connection.OPEN)) {
		event.preventDefault();
		return true;
	}	else {
		unloading = true;
		client.close();
	}
});

function Error(message: string) {
	return h("div#error.page", [
		h("h1", "Error :("),
		h("h3", message),
		h("button", { on: { click: connect } }, "Reconnect"),
	]);
}
function Loading() {
	return h("div#loading.page", [
		Logo(),
		h("h1",
			{ style: { marginTop: "0.6em" } },
			"Connecting..."
		)
	]);
}

function qrBuilder(text: string): Micron.Builder {
	const QR = qrcodegen.QrCode;
	const canvas = document.createElement("canvas");
	const qr = QR.encodeText(text, QR.Ecc.MEDIUM);
	QR.toCanvas(qr, canvas, 8, 2);
	const src = canvas.toDataURL();
	return () => h("img#qr-code", { attrs: { src } });
}
function Lobby() {
	
	const QRCode = qrBuilder(Room.joinLink);
	const nav = new Nav();
	Micron.defer(
		Signal.keydown.subscribe((ev) => {
			if (ev.key === "Escape") {
				nav.clear();
			}
		})
	);
	
	function copy(text: string) {
		navigator.clipboard.writeText(text).catch(() => {
			console.error("Couldn't write to clipboard; check browser settings.");
		});
	}
	function copyCode() {
		copy(Room.joinCode);
	}
	function copyLink() {
		copy(Room.joinLink);
	}
	
	function hasRecap(): boolean {
		return Room.recap !== undefined;
	}
	function Recap() {
		return Room.recap!(() => nav.clear());
	}
	function Players() {
		
		const signals = [
			Room.playerJoined,
			Room.playerLeft,
			Room.playerIconChanged
		];
		
		return s(signals, (_) => {
			
			const players = Room.players.array();
			const list = players.map(p => p.View());
			
			let status: string;
			if (players.length === 0) {
				status = "No players yet!";
			} else if (players.length < Shared.MIN_PLAYER_COUNT) {
				status = `Need ${Shared.MIN_PLAYER_COUNT} to start!`;
			} else if (players.length >= Shared.MAX_PLAYER_COUNT) {
				status = "Room is full!";
			} else {
				status = "Ready to start!";
			}
			
			
			
			return h("div#players.page.stretch", [
				h("div#players-header", [
					h("h2", `Players`),
				]),
				h("div#players-list.flow.scrolling", [
					h("div#players-status", [
						status,
						h("b", ` (${Room.players.count}/${Shared.MAX_PLAYER_COUNT})`)
					]),
					...list,
				])
			])
		});
	}
	function Overview() {
		return h("div#overview.page.stretch", [
			h("h2", "Lobby"),
			h("div#overview-ctr.flow.scrolling", [
				h("div#join-code-ctr.flow", [
					h("h3", "Join Code"),
					h("div#join-code", Room.joinCode),
					h("div.multi-btn", [
						h("button", { on: { click: copyCode } }, "Copy Code"),
						h("button", { on: { click: copyLink } }, "Copy Link")
					]),
					h("div#site-link", [
						"Join at ",
						h("u", Shared.httpsRoot)
					]),
				]),
				h("div#qr-code-ctr", [
					h("div#qr-code-caption", "Or just scan this!"),
					QRCode()
				]),
				h("div.flow.spacer"),
			]),
		]);
	}
	function Settings() {
		return s(mode.changed, () => {
			const modeSettings = mode.get().settings.views();
			return h("div#settings.page.stretch", [
				h("h2", "Settings"),
				//h("div#settings-ctr", [
					h("div#settings-list.flow.scrolling", [
						/*h("div#utils", [
							h("button#close-btn",
								{ on: { click: () => location.href = "/" } },
								"Close Lobby"
							),
							h("button#recap-btn",
								{
									attrs: {
										title: Room.recap === undefined ? "Finish a game first!" : "",
										disabled: Room.recap === undefined
									},
									on: {
										click: () => {
											if (Room.recap) {
												nav.put(Room.recap, () => nav.clear());
											}
										}
									}
								},
								"View Recap"
							)
						]),*/
						mode.View(),
						...modeSettings
					])
				//])
				
			]);
		});
	}

	return h("div#lobby.page", [
		Logo(),
		h("div#lobby-content", [
			Overview(),
			Settings(),
			Players(),
		]),
		s(nav),
		TrayLeft([
			h("button#close-btn.nav-btn",
				{
					attrs: {
						title: "Close Lobby"
					},
					on: {
						click: () => location.href = "/"
					}
				},
				h("img", { attrs: { src: icons.exit } })
			),
			h("button#recap-btn.nav-btn",
				{
					attrs: {
						disabled: !hasRecap(),
						title: hasRecap() ? "" : "Finish a game first!"
					},
					on: {
						click: () => nav.toggle(Recap)
					}
				},
				h("img", { attrs: { src: icons.recap } })
			)
		]),
		/*Tray([
			IconBtn(icons.exit, () => location.href = "/"),
			c(
				Room.recap !== undefined &&
				IconBtn(icons.recap, () => nav.toggle(Recap))
			)
		])*/
	]);
}

/*function Lobby() {
	
	const nav = Micron.anchor();
	Micron.defer(Signal.keydown.subscribe((ev) => {
		if (ev.key === "Escape") nav.clear();
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
	
	function PlayerList() {

		const signals = [
			Room.playerJoined,
			Room.playerLeft,
			Room.playerIconChanged
		];

		return s(signals, (_) => {

			let status: string;
			let list = Room.players.array()
				.map(player => player.View());
			
			if (Room.players.count === 0) {
				status = "No players yet!";
			} else if (Room.players.count < Shared.MIN_PLAYER_COUNT) {
				status = `Need ${Shared.MIN_PLAYER_COUNT} to start!`;
			} else if (Room.players.count === Shared.MAX_PLAYER_COUNT) {
				status = "Room is full!";
			} else {
				status = "Ready to start!";
			}

			return h("div#player-list", [
				h("h3", {}, `Players (${Room.players.count}/${Shared.MAX_PLAYER_COUNT})`),
				h("div#status", status),
				...list
			]);
		});
	}
	function Overview() {
		return h("div#overview.page.stretch", [
			h("h2", "Lobby"),
			h("div", [
				h("div#code-ctr", [
					h("h3", "Join Code"),
					h("div#code", Room.joinCode),
					h("div.multi-btn", [
						h("button", { on: { click: copyCode } }, "Copy Code"),
						h("button", { on: { click: copyLink } }, "Copy Link")
					]),
					h("div#site-link",
						{ style: { fontSize: "0.8em" } },
						[ "(Join at ", h("u", Shared.httpsRoot), ")" ]
					),
				]),
			]),
			PlayerList()
		]);
	}
	function Settings() {
		return s(mode.changed, () => (
			h("div#settings.page.stretch", [
				h("h2", "Settings"),
				h("div#settings-list", [
					mode.View(),
					...mode.get().settingViews()
				])
			])
		));
	}
	function Recap() {
		return Room.recap!(() => nav.clear());
	}
	
	return h("div.page", [
		Logo(),
		h("div#lobby", [
			Overview(),
			Settings()
		]),
		s(nav),
		Tray([
			IconBtn(icons.exit, () => location.href = "/"),
			c(
				Room.recap !== undefined &&
				IconBtn(icons.recap, () => nav.toggle(Recap))
			)
		])
	]);
}*/

function connect() {
	client.connect(`${Shared.wsRoot}/host`);
}
export default function App() {
	
	Micron.tryDefer(
	
		client.use(INC, OUT),
		INC.subscribe("inLobby", ({ leaderId }) => {
			Room.setLeaderId(leaderId);
			page.put(Lobby);
		}),
		INC.subscribe("gameStarting", () => {
			// here we relay the game settings and set the page accordingly
			OUT.send("startGame", mode.get().settingsRemote());
			page.put(mode.get().view);
		}),
		INC.subscribe("accepted", ({ joinCode }) => {
			Room.setJoinCode(joinCode)
		}),
		INC.subscribe("playerJoined", ({ playerId, name, icon }) => {
			Room.handleJoin(playerId, name, icon);
		}),
		INC.subscribe("playerLeft", ({ playerId }) => {
			Room.handleLeave(playerId);
		}),
		INC.subscribe("playerIconChanged", ({ playerId, icon }) => {
			Room.handleIconChanged(playerId, icon);
		}),
		INC.subscribe("playerReconnected", ({ playerId }) => {
			// Don't need to do anything, but it shuts up warnings!
			// (I may or may not have made those warnings myself)
		}),
		INC.subscribe("playerDisconnected", ({ playerId }) => {
			
		}),
		client.connected.subscribe(() => {
			//recap = undefined;
		}),
		client.disconnected.subscribe(() => {
			Room.reset();
		}),
	);
	
	connect();
	return s(page);
}

export const test = Micron.test("host")
	.add(Loading)
	.add(Error, "Test Error")
	.add(Lobby)
	.nest(drawblinsTest)
	.nest(datingTest)
	.create(() => {
		Room.mock(15);
		Room.setJoinCode("WWWWW");
		Room.handleJoin(15, "WWWWWWWWWWWWWWWW", 7);
		console.log(Room.recap);
	});


