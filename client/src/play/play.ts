
import "./play.scss"

import {
	Signal, State,
	Val, ReceiveIndex, SendIndex,
	client, Connection,
	Shared,
	PlayerIcons,
	h, s, defer, projector, mount, VNode,
} from "../modules/"

import Session from "./session"
import * as Drawblins from "./drawblins"
import * as Dating from "./dating"

import {
	Logo,
	Tray,
	IconBtn
} from "../components"
import { help as helpIcon } from "../assets/icons/"

const INC = new ReceiveIndex({
	terminated: Val.NONE,
	error: Val.STR,
	
	accepted: { playerId: Val.NUM, token: Val.NUM },
	inLobby: { playerCount: Val.orNullish(Val.NUM) }, //promoted: Val.BOOL },
	//inGame: Val.NONE, // eventually needs to hold the settings
	inDrawblins: Val.NONE,
	inDating: Val.NONE,
});
const OUT = new SendIndex({
	leave: Val.NONE,
	startGame: Val.NONE,
	changeIcon: { icon: Val.NUM }
});

const page = projector(Landing);
const status = projector(() => h("!"));
let hasAttemptedAutoRejoin = false;

client.pending.listen(() => {
	status.put(Info, "Connecting...");
});
client.connected.listen(() => {
	hasAttemptedAutoRejoin = false;
});
client.disconnected.listen(() => {
	
});
client.closed.listen((ev) => {
	// Possible issue:
	// if the server somehow connects client,
	// then immediately disconnects it without a reason
	// it may be possible to enter a loop of immediately attempting to rejoin
	// Very unlikely to be an issue, though
	if (!ev.reason && !ev.wasClean) {
		// Possible automatic disconnect induced by browser
		// Attempt to reconnect automatically before doing anything else
		if (!hasAttemptedAutoRejoin) {
			// This is our first attempt; don't show anything
			hasAttemptedAutoRejoin = true;
			attemptRejoin();
		} else {
			page.put(Landing);
			status.put(Error, "Connection error");
		}
	} else {
		
		function _error(msg: string = ev.reason) {
			page.put(Landing);
			status.put(Error, msg);
		}
		function _info(msg: string = ev.reason) {
			page.put(Landing);
			status.put(Info, msg);
		}
		function _reset() {
			page.put(Landing);
			status.reset();
		}
		
		switch (ev.code) {
			case Shared.CUSTOM_ERROR: return _error();
			case Shared.INVALID_JOIN: return _error("Join failed; check your code");
			case Shared.INVALID_AUTO_REJOIN:
				console.warn("Auto rejoin failed");
				Session.clearRejoinInfo();
				return _reset();
				
			
			
			case Shared.INVALID_MANUAL_REJOIN:
			case Shared.ROOM_CLOSED:
			case Shared.PLAYER_LEFT:
			case Shared.PLAYER_KICKED:
				Session.clearRejoinInfo();
				Session.joinCode = "";
				return _info();
			
			case Shared.ALREADY_CONNECTED:
				Session.setupManualRejoin();
				return _info();
			case Shared.CONNECTED_ELSEWHERE: return _info();
				
			default:
				if (ev.reason) {
					return _info();
				} else {
					return _error("Something went wrong")
				}
		}
		
		/*if (ev.code === Shared.CUSTOM_ERROR) {
			status.put(error, ev.reason);
		} else if (ev.code === Shared.INVALID_JOIN) {
			status.put(error, "Join failed; check your code");
		} else if (ev.code === Shared.INVALID_AUTO_REJOIN) {
			console.warn("Auto rejoin failed");
			Session.clearRejoinInfo();
			status.reset();
		} else if (ev.code === Shared.) {
			
		} else if (ev.reason) {
			status.put(info, ev.reason);
		} else {
			status.put(info, `${Session.joinCode}, ${Session.playerName}`)
			//status.reset();
		}*/
	}
});
window.addEventListener("beforeunload", () => {
	client.close();
});

function Info(message: string) {
	return h(`div#status.info`, message);
}
function Error(message: string) {
	return h(`div#status.error`, message);
}

function Landing() {
	
	const helpOpen = new State(false);
	
	defer(Signal.keydown.subscribe(keydown));
	function keydown(ev: KeyboardEvent) {
		if (helpOpen.is(false) && ev.key === "Enter") {
			attemptJoin();
		}
	}
	
	function attemptJoin() {
	
		if (!client.state.is(Connection.CLOSED))
			return;
		
		const code = Session.joinCode;
		const name = Session.playerName;
		
		if (name.length < Session.MIN_NAME_LEN)
			return status.put(Error, "Name too short");
		if (name.length > Session.MAX_NAME_LEN)
			return status.put(Error, "Name too long");
		if (code.length < Session.CODE_LEN)
			return status.put(Error, "Invalid code (not long enough)");
		if (code.length > Session.CODE_LEN)
			return status.put(Error, "Invalid code (too long?? somehow???)");
		
		if (Session.canManualRejoin()) {
			Session.pullRejoinInfo();
			attemptConnect(Session.manualRejoinUrl());
		} else {
			Session.storePlayerName();
			Session.clearRejoinInfo();
			attemptConnect(Session.joinUrl());
		}
	}
	function pasteCode(ev: ClipboardEvent) {
		
		function extractUrlCode(content: string): string | undefined {
			//if (!content.toLowerCase().startsWith("https:")) return;
			if (!URL.canParse(content)) return;
			const url = new URL(content);
			if (url.hostname !== window.location.hostname) return;
			const code = url.searchParams.get("code");
			if (!code) return;
			if (code.length !== Session.CODE_LEN) return;
			return code;
		}
		
		const content = ev.clipboardData?.getData("text");
		const elm = ev.currentTarget as HTMLInputElement;
		if (!content) return;
		if (content.length === 5) {
			Session.joinCode = elm.value = content;
			return;
		}
		
		//const elm = document.querySelector("#code-input") as HTMLInputElement;
		Session.joinCode = elm.value = "";
		ev.preventDefault();
		
		const code = extractUrlCode(content);
		if (code) {
			Session.joinCode = elm.value = code;
		} else {
			status.put(Error, "Clipboard does not contain a code");
		}
		
	}
	
	function HelpPopup() {
		
		function b(content: string): VNode {
			return h("b", { style: { fontWeight: "bold" }}, content);
		}
		function close() {
			helpOpen.set(false);
		}
		
		defer(Signal.keydown.subscribe((ev) => {
			if (ev.key === "Escape") {
				close();
			}
		}));
		
		return s(helpOpen, (curr) => {
			if (!curr) {
				return h("!");
			} else {
				return h("div#overlay", { on: { click: close } },
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
								h("br"),
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
	function HostLink() {
		const canHost = !Shared.isMobileClient;
		if (!canHost) {
			return null
		} else {
			return h("a#footer", {
				attrs: { href: "/host" }
			}, "Hosting a game? Click here");
		}
	}

	return h("div#landing.tab", [
		h("div", [
			Logo(),
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
									maxLength: Session.MAX_NAME_LEN,
									value: Session.playerName,
								},
								on: {
									keydown,
									input: (ev) => {
										Session.playerName = (ev.currentTarget as HTMLInputElement).value;
									},
								}
							})
						]),
						h("div.join-input-section", [
							h("div", "Join Code"),
							h("input#code-input", {
								attrs: {
									disabled,
									maxLength: Session.CODE_LEN,
									value: Session.joinCode
								},
								on: {
									keydown,
									paste: pasteCode,
									input: (ev) => {
										Session.joinCode = (ev.currentTarget as HTMLInputElement).value;
										status.reset();
									},
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
		HostLink(),
		HelpPopup(),
		Tray(IconBtn(helpIcon, () => helpOpen.mutate(curr => !curr)))
	]);
}
function Lobby(playerCount: number | null | undefined) {
	
	const promoted = playerCount != undefined;
	
	function IconSelect() {
		
		return s(rerender => {
			
			let icons: VNode[] = [];
			for (let i = 0; i < PlayerIcons.count(); i++) {
				let color = Session.playerIcon === i ? Session.playerColor : "#ffffff";
				let src = PlayerIcons.get(i, color);
				icons.push(h(
					"img.player-icon",
					{
						attrs: { src },
						on: {
							click: () => {
								if (Session.playerIcon !== i) {
									Session.setPlayerIcon(i);
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
		
		const canStart = playerCount >= Shared.MIN_PLAYER_COUNT;
		const blurb = canStart ?
			`${playerCount} players` :
			`${playerCount} players (not enough)`;
		
		startInterface = [
			h("div", "Start the game when everybody's in!"),
			h("div", blurb),
			h(
				"button#start-btn",
				{
					on: { click: () => OUT.send("startGame") },
					attrs: { disabled: !canStart }
				},
				"Start"
			),
		];
	}
	
	return h("div#lobby.tab", [
		h("div", [
			h("h1", "Lobby"),
			IconSelect(),
			...startInterface
		]),
		h(
			"button#leave-btn",
			{ on: { click: () => OUT.send("leave", undefined) } },
			"Leave Game",
		)
	]);
}

function attemptConnect(url: string | null) {
	if (url) client.connect(url);
}
function attemptRejoin() {
	attemptConnect(Session.rejoinUrl());
}
function App() {
	client.use(INC, OUT);
	INC.listen("terminated", () => Session.clearRejoinInfo());
	INC.listen("accepted", ({ playerId, token }) => Session.storeRejoinInfo(playerId, token));
	INC.listen("inLobby", ({ playerCount }) => page.put(Lobby, playerCount));
	INC.listen("inDrawblins", () => page.put(Drawblins.view));
	INC.listen("inDating", () => page.put(Dating.view));
	
	attemptRejoin();
	return s(page);
}

mount(App());


