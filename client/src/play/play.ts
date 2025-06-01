
import "./play.scss"

import {
	Signal, State,
	Val, ReceiveIndex, SendIndex,
	client, Connection,
	Shared,
	playerIcons,
	h, s, defer, Micron
} from "../modules/"

import Session from "./session"
import * as Drawblins from "./drawblins"
import * as Dating from "./dating"

import {
	Logo,
	Nav,
	TrayRight,
	TopBar,
	BottomBar,
} from "../components"
import * as icons from "../assets/icons/"

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

const page = Micron.projector(Landing);
const status = Micron.projector(() => h("!"));

let hasAttemptedAutoRejoin = false;

client.pending.listen(() => {
	status.put(Info, "Connecting...");
});
client.connected.listen(() => {
	hasAttemptedAutoRejoin = false;
});
client.closed.listen((ev) => {
	
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
	
	// Possible issue:
	// if the server somehow connects client,
	// then immediately disconnects it without a reason
	// it may be possible to enter a loop of immediately attempting to rejoin
	// very unlikely to actually be a problem though
	if (!ev.reason && !ev.wasClean) {
		// Possible automatic disconnect induced by browser
		// Attempt to reconnect automatically before doing anything else
		if (!hasAttemptedAutoRejoin) {
			// This is our first attempt; don't show anything
			hasAttemptedAutoRejoin = true;
			attemptAutoRejoin();
		} else {
			// Our first attempt failed, 
			_error("Connection error");
		}
	} else {
		switch (ev.code) {
			case Shared.CUSTOM_ERROR:
				return _error();
			
			case Shared.INVALID_JOIN:
				return _error("Join failed; check your code");
			
			case Shared.INVALID_AUTO_REJOIN:
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
			
			case Shared.CONNECTED_ELSEWHERE:
				return _info();
			
			default:
				if (ev.reason)
					return _info();
				else
					return _error("Unknown error")
		}
	}
});
window.addEventListener("beforeunload", () => {
	client.close();
});
document.addEventListener("dblclick", (ev) => {
	// Disable double-tap zoom on mobile browsers
	ev.preventDefault();
});
/*document.addEventListener(
	"dblclick",
	function (event) {
		event.preventDefault();
	},
	{ passive: false }
);*/

function Info(message: string) {
	return h(`div#status.info`, message);
}
function Error(message: string) {
	return h(`div#status.error`, message);
}

function Landing() {
	
	function attemptJoin() {

		if (!client.state.is(Connection.CLOSED))
			return;

		const code = Session.joinCode;
		const name = Session.playerName;

		function _error(msg: string) {
			status.put(Error, msg);
		}

		if (name.length === 0 && code.length === 0)
			return _error("You need a nickname and a room code!");
		if (name.length === 0)
			return _error("Choose a nickname!");
		if (code.length === 0)
			return _error("You need a room code!");

		if (name.length < Session.MIN_NAME_LEN)
			return _error("Name too short");
		if (name.length > Session.MAX_NAME_LEN)
			return _error("Name too long");
		if (code.length < Session.CODE_LEN)
			return _error("Invalid code (should be 5 characters)");
		if (code.length > Session.CODE_LEN)
			return _error("Invalid code (too long?? somehow???)");

		if (Session.canManualRejoin()) {
			Session.pullRejoinInfo();
			attemptManualRejoin();
		} else {
			Session.storePlayerName();
			Session.clearRejoinInfo();
			attemptInitialJoin();
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
	
	const nav = new Nav();
	
	Micron.defer(Signal.keydown.subscribe(keydown));
	function keydown(ev: KeyboardEvent) {
		if (ev.key === "Escape") {
			nav.clear();
		}
		if (nav.isEmpty() && ev.key === "Enter") {
			attemptJoin();
		}
	}
	
	function NameInput(disabled: boolean) {
		return h("input#name-input", {
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
		});
	}
	function CodeInput(disabled: boolean) {
		return h("input#code-input", {
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
		});
	}
	function JoinFlow() {
		return s(client.state, curr => {
			const disabled = (curr !== Connection.CLOSED);
			return h("div#join-flow.flow", [
				h("div.join-section", [
					h("div", "Nickname"),
					NameInput(disabled)
				]),
				h("div.join-section", [
					h("div", "Join Code"),
					CodeInput(disabled)
				]),
				h("button#join-btn", {
					attrs: { disabled },
					on: { click: attemptJoin }
				}, "Join!"),
				s(status),
			]);
		});
	}
	function HostLink() {
		const canHost = !Shared.isMobileClient;
		if (!canHost) {
			return null;
		} else {
			return h("a#footer", {
				attrs: { href: "/host" }
			}, "Hosting a game? Click here");
		}
	}
	function HelpOverlay() {
		
		return h("div#overlay",
			h("div#help-popup", [
				h("div.flow.gapped", [
					h("h2", "How to Play"),
					h("div.section", [
						h("b", "Host"), " on a PC or similar device.",
						h("br"),
						"You'll find a join code there.",
						h("div.small", [
							"(this device ",
							h("b", Shared.isMobileClient ? "cannot" : "can"),
							" be used to host)",
						]),
					]),
					h("div.section", [
						h("b", "Join"),
						" from a mobile device",
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
					{ on: { click: () => nav.clear() } },
					"Close"
				)
			])
		);
	}
	function AboutOverlay() {
		return h("div#overlay", [
			h("div#about-popup", [
				h("div.flow.gapped", [
					h("h2", "About"),
					h("div", [
						"GoblinCon is a drawing game for 3-16 players.",
						h("br"),
						"It's made & maintained by a single developer."
					]),
					h("div", ""),
					h("div", [
						"Join the ",
						h("a",
							{
								attrs: {
									href: "/social/discord",
									target: "_blank",
									rel: "noopener noreferrer",
								}
							},
							"official discord server"),
						" here!"
					]),
				]),
				h("button",
					{ on: { click: () => nav.clear() } },
					"Close"
				)
			])
		]);
	}
	
	
	return h("div#landing.scaffold", [
		//TopBar({}),
		h("div.page", [
			h("div.flow", [
				Logo(),
				JoinFlow(),
			]),
			HostLink(),
			s(nav),
		]),
		TrayRight([
			nav.IconBtn(icons.info, AboutOverlay),
			nav.IconBtn(icons.help, HelpOverlay),
		]),
		
		
		//Tray(IconBtn(helpIcon, () => overlay.toggle(HelpOverlay)))
	]);
}
function Lobby(playerCount: number | null | undefined) {
	
	const promoted = playerCount != undefined;
	const overlay = Micron.anchor();
	
	function IconSelect() {
		
		return s(rerender => {
			
			let icons: Micron.Node[] = [];
			for (let i = 0; i < playerIcons.count(); i++) {
				let color = Session.playerIcon === i ? Session.playerColor : "#ffffff";
				let src = playerIcons.get(i, color);
				icons.push(
					h("img.player-icon", {
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
					}
				));
			}
			
			return h("div#icon-select-ctr", [
				h("div", "Choose your icon:"),
				h("div#icon-select", [
					h("div.icon-row", icons.slice(0, 4)),
					h("div.icon-row", icons.slice(4))
				])
			]);
		});
	}
	
	function StartFlow() {
		
		if (!promoted) {
			return undefined;
		}
		
		const canStart = playerCount >= Shared.MIN_PLAYER_COUNT;
		const blurb = canStart ?
			`${playerCount} players` :
			`${playerCount} players (not enough)`;
		
		return h("div#start-flow.page", [
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
		]);
	}
	
	
	
	/*return h("div#lobby.page", [
		h("div.flow.gapped", [
			h("h1", "Lobby"),
			IconSelect(),
			...startInterface
		]),
		h("button#leave-btn",
			{ on: { click: () => OUT.send("leave", undefined) } },
			"Leave Game",
		)
	]);*/
	
	
	
	return h("div#lobby.scaffold", [
		/*TopBar({
			middle: h("div.title", "Lobby")
		}),*/
		h("div.primary-page", [
			h("h2", "Lobby"),
			IconSelect(),
			StartFlow(),
			s(overlay)
		]),
		/*BottomBar({
			//middle: h("button")
		}),*/
	]);
	
	
}

function attemptConnect(url: string | null) {
	if (url) client.connect(url);
}
function attemptInitialJoin() {
	attemptConnect(Session.joinUrl());
}
function attemptManualRejoin() {
	attemptConnect(Session.manualRejoinUrl());
}
function attemptAutoRejoin() {
	attemptConnect(Session.autoRejoinUrl());
}

export default function App() {
	Micron.tryDefer(
		client.use(INC, OUT),
		INC.subscribe("terminated", () => Session.clearRejoinInfo()),
		INC.subscribe("accepted", ({ playerId, token }) => Session.storeRejoinInfo(playerId, token)),
		INC.subscribe("inLobby", ({ playerCount }) => page.put(Lobby, playerCount)),
		INC.subscribe("inDrawblins", () => page.put(Drawblins.view)),
		INC.subscribe("inDating", () => page.put(Dating.view)),
	);
	
	attemptAutoRejoin();
	return s(page);
}
export const test = Micron.test("play")
	.add(Landing)
	.add(Lobby, 3)
	.nest(Drawblins.test)
	.nest(Dating.test)
	.create(() => {
		Session.playerId = 0;
	});



