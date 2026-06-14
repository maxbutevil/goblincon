
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
import * as flags from "../assets/flags"

import hostDiagram from "../assets/misc/host_diagram.svg"

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
	
	accepted: { playerId: Val.NUM, token: Val.STR },
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
	
	Micron.defer(Signal.documentEvent("keydown").subscribe(keydown));
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
			
			return h("div#join-flow.section", [
				h("div.header", "Join"),
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
				}, "Join Game!"),
				/*h("div.divider", [
					h("div.line"),
					h("div.content", "OR"),
					h("div.line")
				]),*/
				//h("hr"),
				s(status),
			]);
		});
	}
	function HostFlow() {
		const canHost = !Shared.isMobileClient;
		if (!canHost) {
			return null;
		} else {
			
			const click = () => location.href = "/host";
			
			return h("div#host-flow", [
				h("h3.header", "Host"),
				h("button",
					{ on: { click } },
					"Host New Game!"
				),
			]);
		}
	}
	/*
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
							"official discord server"
						),
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
	*/
	
	function Flags() {
		return h("div#flags", [
			h("img.flag", { attrs: { src: flags.lgbt } }),
			h("img.flag", { attrs: { src: flags.trans } }),
			h("img.flag", { attrs: { src: flags.palestine } }),
		]);
	}
	function AboutCard() {
		return h("div#about-card.info-card", [
			h("div.header", "About"),
			h("div.content", [
				h("p", [
					h("b", "GoblinCon is a silly drawing game for 3-16 players!"),
					" One person hosts the game on a PC or similar device.",
					" Players may then join from their mobile devices."
				]),
				h("img.host-diagram", { attrs: { src: hostDiagram } }),
				h("p", [
					h("b", "Make sure everybody can see the host device!"),
					" You can use a chat app that allows screen sharing, or just play together in person!",
					" For a larger screen, you can connect a laptop to a TV.",
					//" You can play together in person, or use a chat app that allows screen sharing."
				]),
			]),
		]);
	}
	function ModesCard() {
		return h("div#drawing-card.info-card", [
			h("div.header", "Modes"),
			h("div.content", [
				h("p", [
					"There are currently two game modes!",
				]),
				h("p", [
					"In ",
					h("b", "Drawing Mode"),
					", a \"Goblin Name\" is randomly generated, and each player draws a creature inspired by that name.",
					" Then everyone's drawing is revealed, and you vote for your favorite!",
					
				]),
				h("div", [
					"In ",
					h("b", "Dating Mode"),
					", players draw \"bachelors\" and pair them with \"suitors\", trying to create the best (or funniest) couple they can!",
				]),
				h("div", [
					"Remember that the themes are just for inspiration! You do not have to follow them perfectly."
				]),
			]),
		])
	}
	function SocialCard() {
		return h("div#social-card.info-card", [
			h("div.header", "Social"),
			h("div.content", [
				h("p", [
					"If you have any suggestions, or want to find people to play with, feel free to join the official ",
					h("a", {
						attrs: {
							href: "/social/discord",
							target: "_blank"
						}
					}, "Discord Server"),
					"!"
				]),
			])
		]);
	}
	function UpdatesCard() {
		return h("div#updates-card.info-card", [
			h("div.header", "Updates"),
			h("div.content", [
				h("p", [
					h("b", "Touch Ups (6/14/2026):"),
					h("ul", [
						h("li", "Various gameplay tweaks"),
						h("li", "Improved landing page"),
					]),
				]),
				h("p", [
					h("b", "Coming Soon:"),
					h("ul", [
						h("li", "Choose your icon color"),
						h("li", "New game mode..?"),
					])
				])
			])
		])
	}
	
	return h("div#landing.scaffold", [
		//TopBar({}),
		h("div.page", [
			Logo(),
			h("div#primary-card", [
				HostFlow(),
				JoinFlow(),
			]),
			h("div#info-cards", [
				h("div.card-ctr", [
					AboutCard(),
					ModesCard(),
				]),
				h("div.card-ctr", [
					UpdatesCard(),
					SocialCard()
				])
			]),
			Flags()
		]),
		/*TrayRight([
			nav.IconBtn(icons.info, AboutOverlay),
			nav.IconBtn(icons.help, HelpOverlay),
		]),*/
		
		
		//Tray(IconBtn(helpIcon, () => overlay.toggle(HelpOverlay)))
	]);
}
function Lobby(playerCount: number | null | undefined) {
	
	const promoted = playerCount != undefined;
	//const overlay = Micron.anchor();
	
	function IconSelect() {
		
		return s(rerender => {
			
			let icons: Micron.Node[] = [];
			for (let i = 0; i < playerIcons.count; i++) {
				let color = Session.playerIcon === i ? Session.playerColor : "#ffffff";
				//let src = playerIcons.get(i, color);
				icons.push(
					h("span", 
						{
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
						playerIcons.View(i, color)
					)
				);
				/*icons.push(
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
				));*/
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
			h("div.flow", [
				h("h2", "Lobby"),
				IconSelect(),
				StartFlow(),
				//s(overlay)
			]),
			h("button#leave-btn",
				{ on: { click: () => OUT.send("leave", undefined) } },
				"Leave Game",
			)
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



