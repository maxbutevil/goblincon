
import "./play.scss"

import {
	State,
	Val, ReceiveIndex, SendIndex,
	client, Connection,
	Shared,
	PlayerIcons,
	h, s, projector, mount, VNode,
} from "../modules/index"

import Globals from "./globals"
import * as Drawblins from "./drawblins"
import * as Dating from "./dating"

import {
	logo,
	mountedBtn
} from "../components"
import { help as helpIcon } from "../assets/icons/index"

const INC = new ReceiveIndex({
	terminated: Val.NONE,
	error: Val.STR,
	
	accepted: { playerId: Val.NUM, token: Val.NUM },
	inLobby: { playerCount: Val.optional(Val.NUM) }, //promoted: Val.BOOL },
	//inGame: Val.NONE, // eventually needs to hold the settings
	inDrawblins: Val.NONE,
	inDating: Val.NONE,
});
const OUT = new SendIndex({
	leave: Val.NONE,
	startGame: Val.NONE,
	changeIcon: { icon: Val.NUM }
});

const page = projector(landing);
const status = projector(() => h("!"));

client.pending.listen(() => {
	status.put(info, "Connecting...");
});
client.disconnected.listen(() => {
	page.put(landing);
});
client.closed.listen((ev) => {
	
	if (ev.code === Shared.CUSTOM_ERROR) {
		status.put(error, ev.reason);
	} else if (ev.code === Shared.INVALID_JOIN) {
		status.put(error, "Join failed; check your code");
	} else if (ev.code === Shared.INVALID_REJOIN) {
		console.warn("Rejoin failed");
		Globals.clearRejoinInfo();
		status.reset();
	} else if (ev.reason) {
		status.put(info, ev.reason);
	} else if (!ev.wasClean) {
		status.put(error, "Connection Error");
	} else {
		status.reset();
	}
});

INC.listen("terminated", () => {
	Globals.clearRejoinInfo();
});
INC.listen("accepted", ({ playerId, token }) => {
	Globals.playerId = playerId;
	Globals.storeRejoinInfo(token);
	Globals.joinCode = ""; // make sure we see future rejoin attempts as rejoin attempts
});
INC.listen("inLobby", ({ playerCount }) => {
	page.put(lobby, playerCount);
});
INC.listen("inDrawblins", () => {
	page.put(Drawblins.view);
});
INC.listen("inDating", () => {
	page.put(Dating.view);
});
/*INC.listen("error", (message) => {
	if (page.get().key === "landing" && Globals.wasRejoining())
		console.warn("Couldn't rejoin game:", message);
	else
		statusError(message);
});*/

function info(message: string) {
	return h(`div#status.info`, message);
}
function error(message: string) {
	return h(`div#status.error`, message);
}

function landing() {
	
	let helpOpen = new State(false);
	
	//function joinGame(code: string, name: string) {
	function attemptJoin() {
	
		if (!client.state.is(Connection.CLOSED))
			return;
		
		let code = Globals.joinCode;
		let name = Globals.playerName;
		
		if (name.length < Globals.MIN_NAME_LEN)
			return status.put(error, "Name too short");
		if (name.length > Globals.MAX_NAME_LEN)
			return status.put(error, "Name too long");
		
		Globals.clearRejoinInfo();
		Globals.storePlayerName();
		
		if (code.length !== Globals.CODE_LEN)
			return status.put(error, "Invalid code");
		
		//console.log(name, code);
		//Globals.joinCode = code.toUpperCase();
		let url = Globals.getJoinUrl();
		if (url) client.connect(url);
	}
	
	function helpPopup() {
		
		function b(content: string): VNode {
			return h("b", { style: { fontWeight: "bold" }}, content);
		}
		
		function br(): VNode {
			return h("br");
		}
		function close() {
			helpOpen.set(false);
		}
		
		return s(helpOpen, (curr) => {
			if (!curr) {
				return h("!");
			} else {
				return h("div#overlay-shadow", { on: { click: close } },
					h("div#help-popup.popup.vflow", [
						h("div", [
							h("h2", "How to Play"),
							h("div.section", [
								b("Host"),
								" on a PC or similar device",
							]),
							h("div.small", [
								"(this device ",
								b(Shared.isMobileClient ? "cannot" : "can"),
								" be used to host)",
							]),
							h("div.section", [
								b("Join"),
								//" and ",
								//b("Play"),
								" from a mobile device",
								br(),
								h("div.small", "(other devices are ok too)")
							]),
							h("div.section", [
								"Designed for 3-16 players"
							]),
							h("div.section", [
								"Draw silly creatures & have fun!"
							]),
						]),
						h("button",
							{ on: { click: close } },
							"Back"
						)
					])
				);
			}
		});
	}
	function hostLink() {
		const canHost = !Shared.isMobileClient;
		if (!canHost) {
			return null
		} else {
			return h("a#footer", {
				attrs: { href: "/host" }
			}, "Hosting a game? Click here");
		}
	}
	function pasteCode(ev: ClipboardEvent) {
		
		function extractUrlCode(content: string): string | undefined {
			if (!content.toLowerCase().startsWith("https:")) return;
			if (!URL.canParse(content)) return;
			const url = new URL(content);
			if (url.hostname !== window.location.hostname) return;
			const code = url.searchParams.get("code");
			if (!code) return;
			if (code.length !== Globals.CODE_LEN) return;
			return code;
		}
		
		const content = ev.clipboardData?.getData("text");
		if (!content || content.length === 5) return;
		
		const elm = document.querySelector("#code-input") as HTMLInputElement;
		Globals.joinCode = elm.value = "";
		ev.preventDefault();
		
		const code = extractUrlCode(content);
		if (code) {
			Globals.joinCode = elm.value = code;
		} else {
			status.put(error, "Clipboard does not contain a code");
		}
		
	}
	
	return h("div#landing.tab", [
		h("div", [
			logo(),
			s(client.state, curr => {
				const disabled = (curr !== Connection.CLOSED);
				return h(
					"div#join-input.tab",
					[
						h("div.join-input-section", [
							h("div", "Nickname"),
							h("input#name-input", {
								attrs: {
									disabled,
									maxLength: Globals.MAX_NAME_LEN,
									value: Globals.playerName,
								},
								on: {
									change: ev => Globals.playerName = (ev.currentTarget as HTMLInputElement).value
								}
							})
						]),
						h("div.join-input-section", [
							h("div", "Join Code"),
							h("input#code-input", {
								attrs: {
									disabled,
									maxLength: Globals.CODE_LEN,
									value: Globals.joinCode ?? ""
								},
								on: {
									change: ev => Globals.joinCode = (ev.currentTarget as HTMLInputElement).value,
									paste: pasteCode
								}
							})
						]),
						h("button#join-btn", {
							attrs: { disabled },
							on: { click: attemptJoin }
						}, "Join!"),
					]
				);	
			}),
			s(status)
		]),
		hostLink(),
		helpPopup(),
		mountedBtn(helpIcon, () => helpOpen.set(!helpOpen.get()))
	]);
}
function lobby(playerCount: number | undefined) {
	
	const promoted = playerCount !== undefined;
	
	function leave() {
		OUT.send("leave", undefined);
	}
	function startGame() {
		OUT.send("startGame", undefined);
	}
	
	function iconSelect() {
		
		return s(rerender => {
			
			let icons: VNode[] = [];
			for (let i = 0; i < PlayerIcons.count(); i++) {
				let color = Globals.playerIcon === i ? Globals.playerColor : "#ffffff";
				let src = PlayerIcons.get(i, color);
				icons.push(h(
					"img.player-icon",
					{
						attrs: { src },
						on: {
							click: () => {
								if (Globals.playerIcon !== i) {
									Globals.playerIcon = i;
									Globals.storePlayerIcon();
									OUT.send("changeIcon", { icon: i });
									rerender();
								}
							}
						}
					},
				));
			}
			
			return h("div.icon-select", icons);
		});
	}
	
	let startInterface: VNode[] = [];
	if (promoted) {
		
		let blurb;
		if (playerCount <= 1) {
			blurb = "1 player (not enough)";
		} else if (playerCount == 2) {
			blurb = "2 players (not recommended)";
		} else {
			blurb = `${playerCount} players`;
		}
		
		startInterface = [
			h("div", "Start the game when everybody's in!"),
			h("div", blurb),
			h(
				"button#start-btn",
				{
					on: { click: startGame },
					attrs: { disabled: playerCount <= 1 }
				},
				"Start"
			),
		];
	}
	
	return h("div#lobby.tab", [
		h("div", [
			h("h1", "Lobby"),
			iconSelect(),
			...startInterface
		]),
		h(
			"button#leave-btn",
			{ on: { click: leave } },
			"Leave Game",
		)
	]);
}

function attemptRejoin() {
	if (client.state.is(Connection.CLOSED)) {
		let rejoinUrl = Globals.getRejoinUrl();
		if (rejoinUrl) client.connect(rejoinUrl);
	}
}
function app() {
	client.use(INC, OUT);
	attemptRejoin();
	return s(page);
}

mount(app());

/* misc event handling */
/*window.addEventListener("pageshow", () => {
	console.log("whee!")
	attemptRejoin();
});*/
document.addEventListener("visibilitychange", (ev) => {
	if (!document.hidden) {
		attemptRejoin();
	}
});
window.addEventListener("beforeunload", () => {
	client.close();
});


