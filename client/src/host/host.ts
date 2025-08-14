
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
	LogoIcons,
	Nav,
	TrayLeft
} from "../components"
import * as icons from "../assets/icons/"

import Room from "./room"
import { Mode, Setting, Settings } from "./mode"
import Drawblins, { test as drawblinsTest } from "./drawblins"
import Dating, { test as datingTest } from "./dating"

import { Player, PlayerMap } from "./data"

import { qrcodegen } from "./qrcodegen"

const INC = new ReceiveIndex({
	"accepted": { joinCode: Val.STR, token: Val.STR },
	
	"inLobby": { leaderId: Val.NUM },
	"playerJoined": { playerId: Val.NUM, name: Val.STR, icon: Val.NUM },
	"playerLeft": { playerId: Val.NUM },
	//"playerDisconnected": { playerId: Val.NUM },
	//"playerReconnected": { playerId: Val.NUM },
	"playerIconChanged": { playerId: Val.NUM, icon: Val.NUM },
	
	"gameStarting": Val.NONE,
});

const OUT = new SendIndex({
	"close": Val.NONE,
	"kickPlayer": { "playerId": Val.NUM },
	
	"startGame": Val.unchecked<
		ReturnType<typeof Drawblins.settingsRemote> |
		ReturnType<typeof Dating.settingsRemote>
	>(),
});

//const stack = Micron.stack
const page = Micron.projector(Loading);
const mode = new Setting<typeof Dating | typeof Drawblins>(
	"Game Mode",
	[ Drawblins, Dating ],
	{ key: "gameMode", initial: 1, stringifier: (m) => m.name }
);
let unloading = false; // not the most elegant solution, but this stops the error page from showing when we click a link


client.closed.listen((ev) => {
	
	if (unloading) {
		return;
	}
	
	switch (ev.code) {
		case Shared.INVALID_HOST_RECONNECT:
			page.put(Error, "Fatal connection error");
			break;
		case Shared.ROOM_CLOSED:
			page.put(Error, "Room timed out");
			break;
		case Shared.CONNECTED_ELSEWHERE:
			page.put(Error, "Connected elsewhere (somehow)");
			break;
		default:
			reconnect();
			//setTimeout(reconnect, 10000);
	}
});

async function acquireWakeLock() {
	try {
		await navigator.wakeLock.request("screen");
		console.info("wake lock acquired");
	} catch (err) {
		console.error("error acquiring wake lock:", err);
	}
}

acquireWakeLock();
//window.addEventListener("load", acquireWakeLock);
window.addEventListener("beforeunload", (event) => {
	if (event.cancelable && Room.players.count > 0 && client.state.is(Connection.OPEN)) {
		event.preventDefault();
		return true;
	}	else {
		unloading = true;
		client.close();
	}
});

/*const lobbySettings = new Settings({
	autoRecap
}, {});*/

function Error(message: string) {
	return h("div#error.page", [
		h("h1", "Error :("),
		h("h3", message),
		h("button", { on: { click: connect } }, "Create New Room"),
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
	
	/*Room.setResults({
		players: PlayerMap.mock(3),
		recap: () => h("div")
	})*/
	
	const QRCodeBuilder = qrBuilder(Room.joinLink);
	const nav = new Nav();
	Micron.defer(
		Signal.documentEvent("keydown").subscribe((ev) => {
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
	
	function JoinFlow() {
		return h("div#join-flow.card", [
			h("div.header", [
				h("h3", "Join Code"),
				h("div.multi-btn", [
					h("button", { on: { click: copyCode } }, "Copy Code"),
					h("button", { on: { click: copyLink } }, "Copy Link")
				]),
			]),
			h("div.content", [
				h("div", [
					h("div#join-code", Room.joinCode),
					h("div#join-info", [
						"Join at ",
						h("u", Shared.httpsRoot),
						h("br"),
						"(or just scan the QR code!)"
					]),
				]),
				h("div#qr-code-ctr", [
					//h("div#qr-code-caption", "Or just scan this!"),
					QRCodeBuilder()
				])
			]),
			
		]);
	}
	function GameResults() {
		
		function RecapBtn() {
			
			if (!Room.results) {
				return h("!");
			}
			
			const { recap } = Room.results;
			
			function click() {
				const close = () => nav.clear();
				nav.toggle(recap, close);
			}
			
			return h("button#recap-btn.multi-btn.green",
				{ on: { click } },
				"Show Recap"
			);
		}
		function Leaderboard() {
			if (!Room.results) {
				return h("div.content", "Once you've completed a game, the results will be shown here!");
			}
			
			const { players } = Room.results;
			
			function Entry({ rank, player }: { rank: number, player: Player }) {
				return h("div.score-entry", [
					h("span.rank", `${rank}) `),
					player.ScoredView()
				]);
			}
			
			const entries = players.winners(3).map(Entry);
			return h("div#leaderboard.content", entries);
		}
		
		//const results = ;
		
		
		return h("div#game-results.card", [
			h("div.header", [
				h("h3", "Game Results"),
				RecapBtn()
			]),
			Leaderboard()
		])
	}
	function ModeSelect() {
		return h("div#mode-select.card", [
			h("div.header", [
				h("h3", "Mode Select"),
				mode.Selector()
				//h("div", "Game Mode")
			]),
			h("div.content", (
				s(mode.changed, () => {
					const { name, desc } = mode.get();
					return h("div", [
						h("b", `${name} Mode: `),
						h("span", desc)
					]);
				})
			))
		]);
	}
	function ModeSettings() {
		
		function resetAll() {
			mode.get().settings.reset()
		}
		
		return h("div#mode-settings.card", [
			h("div.header", [
				h("h3", "Mode Settings"),
				h("div.multi-btn", h("button", { on: { click: resetAll } }, "Reset to Defaults"))
			]),
			s(mode.changed, () => {
				//console.log(mode.get().settings);
				const modeSettings = mode.get().settings.views();
				return h("div#mode-settings-list.content.scrolling", modeSettings)
			})
			
			
		]);
	}
	function LobbySettings() {
		return h("div#lobby-settings.card", [
			h("div.header", [
				h("h3", "Lobby Settings"),
			]),
			h("div.content", [
				h("button#close-btn.red",
					{ on: { click: close } },
					"Close Room"
				),
			])
		]);
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

			return h("div#players.card", [
				h("div.header", [
					h("h3", "Players"),
					h("div#players-status", [
						status,
						h("b", ` (${Room.players.count}/${Shared.MAX_PLAYER_COUNT})`)
					]),
				]),
				h("div#players-list.content.scrolling", [

					...list,
				])
			])
		});
	}
	
	

	return h("div#lobby", [
		h("div#top-bar", [
			h("div#description", [
				h("div.title", "GoblinCon - Lobby"),
				h("div.subtitle", "Players can join now from their phones!")
			]),
			LogoIcons(),
		]),
		h("div#lobby-content", [
			h("div#overview.column", [
				JoinFlow(),
			]),
			h("div#settings.column", [
				ModeSelect(),
				ModeSettings(),
				//RoomSettings(),
				//PreviousRound()
			]),
			h("div#room-status.column", [
				Players()
			]),
			
			h("div.column", LobbySettings()),
			h("div.column", GameResults()),
			
		]),
		s(nav)
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
	Room.reset();
	client.resetAck();
	client.connect(Room.connectUrl());
}
function reconnect() {
	client.connect(Room.reconnectUrl());
}
function close() {
	OUT.send("close");
	client.close();
	location.href = "/";
}
export default function App() {
	
	Micron.tryDefer(
		
		Signal.documentEvent("keypress").subscribe((ev) => {
			if (ev.key.toLowerCase() === "x") {
				client.close();
			}
		}),
	
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
		INC.subscribe("accepted", ({ joinCode, token }) => {
			Room.setJoinCode(joinCode);
			Room.setToken(token);
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
		/*INC.subscribe("playerReconnected", ({ playerId }) => {
			// Don't need to do anything, but it shuts up warnings!
			// (I may or may not have made those warnings myself)
		}),
		INC.subscribe("playerDisconnected", ({ playerId }) => {
			
		}),*/
		client.connected.subscribe(() => {
			//recap = undefined;
		}),
		client.disconnected.subscribe(() => {
			//reconnect();
			//Room.reset();
		}),
	);
	
	connect();
	return s(page);
}

/*const drawblinsRecapTest = Micron.test("drawblins-recap")
	.add(Lobby)
	.setup(() => {
		Room.setResults({
			players: PlayerMap.mock(16),
			recap: () => {
				Drawblins.
			}
		});
	});*/
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
		//console.log(Room.recap);
	});


