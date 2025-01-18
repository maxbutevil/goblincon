
import "../shared.css"
import "./play.css"

import {
	Signal, State, Variant, unit, variant,
	Validate, ReceiveIndex, SendIndex,
	client, Connection,
	Shared,
	PlayerIcons,
	patchRoot, h, stateful, contained, VNode,
} from "../modules/index"

import Globals from "./globals"
import * as Drawblins from "./drawblins"

import logo from "../components/logo"
import { help as helpIcon } from "../assets/icons/index"

const INC = new ReceiveIndex({
	terminated: Validate.NONE,
	error: Validate.STRING,
	
	accepted: { playerId: Validate.NUMBER, token: Validate.NUMBER },
	inLobby: { playerCount: Validate.optional(Validate.NUMBER) }, //promoted: Validate.BOOL },
	inGame: Validate.NONE, // eventually needs to hold the settings
});
const OUT = new SendIndex({
	leave: Validate.NONE,
	startGame: Validate.NONE,
	changeIcon: { icon: Validate.NUMBER }
});

type Page = 
	Variant<"syncing"> |
	Variant<"landing"> |
	Variant<"lobby", { playerCount: number | undefined }> |
	Variant<"drawblins">;

const page = State.deep<Page>(unit("landing"));


type StatusUpdate = null | { type: "info" | "error", message: string };
const status = new State<StatusUpdate>(null);

/*const enterPressed = new Signal();
document.addEventListener("keydown", (ev) => {
	if (ev.key == "Enter") {
		enterPressed.emit();
	}
});*/

client.use(INC, OUT);
client.pending.listen(() => {
	statusInfo("Connecting...");
});
client.connectionFailed.listen(() => {
	// only show this status after a join attempt (not a rejoin)
	if (Globals.wasRejoining()) {
		statusNone();
	} else {
		statusError("Join failed; check your code");
	}
});
client.disconnected.listen(() => {
	//page.set(unit("syncing"));
	page.set(unit("landing"));
});
client.connectionFailed.listen(() => {
	//Globals.clearRejoinInfo();
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
	statusNone();
	page.set(variant("lobby", { playerCount }));
});
INC.listen("inGame", () => {
	page.set(unit("drawblins"));
});
INC.listen("error", (message) => {
	if (page.get().key === "landing" && Globals.wasRejoining())
		console.warn("Couldn't rejoin game: ", message);
	else
		statusError(message);
});

function statusMessage() {
	return stateful(status, (curr) => {
		if (curr === null)
			return h("div.status");
		else
			return h(`div.status.${curr.type}`, curr.message);
	});
}
function clearedStatusMessage() {
	//console.log("Clearing")
	statusNone();
	return statusMessage();
}
function statusNone() {
	status.set(null);
}
function statusInfo(message: string) {
	status.set({ type: "info", message });
}
function statusError(message: string) {
	status.set({ type: "error", message });
}

function syncing() {
	return h("h1", "syncing...");
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
			return statusError("Name too short");
		if (name.length > Globals.MAX_NAME_LEN)
			return statusError("Name too long");
		
		Globals.clearRejoinInfo();
		Globals.storePlayerName();
		
		if (code.length !== Globals.CODE_LEN)
			return statusError("Invalid code");
		
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
		
		return stateful(helpOpen, (curr) => {
			if (!curr) {
				return h("!");
			} else {
				return h("div.overlay",
					h("div#help-popup.popup.vflow.vsplit", [
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
							{ on: { click: () => helpOpen.set(false) } },
							"Back"
						)
					])
				);
			}
		});
	}
	function helpPopupButton() {
		return h("div.mounted-btn-vflow", [
			h("button#help-popup-button",
				{ on: { click: () => helpOpen.set(!helpOpen.get()) } },
				h("img#help-popup-button-icon", { attrs: { src: helpIcon }})
			)
		]);
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
	
	return h("div#landing.tab", [
		h("div", [
			logo(),
			stateful(client.state, curr => {
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
									change: ev => Globals.joinCode = (ev.currentTarget as HTMLInputElement).value
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
			clearedStatusMessage()
		]),
		hostLink(),
		helpPopup(),
		helpPopupButton(),
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
		
		return contained(rerender => {
			
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
	
	attemptRejoin();
	
	return stateful(page, (curr) => {
		switch(curr.key) {
			case "syncing": return syncing();
			case "landing": return landing();
			case "lobby": return lobby(curr.playerCount);
			case "drawblins": return Drawblins.view();
		}
	});
}

/* misc event handling */
//window.onbeforeunload = () => client.close();

patchRoot(app());

window.addEventListener("beforeunload", () => {
	client.close();
});
window.addEventListener("focus", (event) => {
	attemptRejoin();
});


