
import "./styles.css"

import Signal from "./modules/signal"
import State from "./modules/state"
import { Variant, unit, variant } from "./modules/variant"
import Validate, { ReceiveIndex, SendIndex } from "./modules/validate"
import client, { Connection } from "./modules/client"
import * as Utils from "./modules/utils"

import Globals from "./play/globals"
import * as Drawblins from "./play/drawblins"
import { patchRoot, h, conditional, signaled, stateful } from "./modules/render"

const INC = new ReceiveIndex({
	terminated: Validate.NONE,
	error: Validate.STRING,
	
	accepted: { playerId: Validate.NUMBER, token: Validate.NUMBER },
	inLobby: { promoted: Validate.BOOL },
	inGame: Validate.NONE, // eventually needs to hold the settings
});
const OUT = new SendIndex({
	startGame: Validate.NONE
});

type Page = 
	Variant<"landing"> |
	Variant<"lobby", { promoted: boolean }> |
	Variant<"drawblins">;

const page = new State<Page>(unit("landing"));


type StatusUpdate = null | { type: "info" | "error", message: string };
const status = new State<StatusUpdate>(null);

client.use(INC, OUT);
client.pending.listen(() => {
	statusInfo("Connecting...");
});
client.connectionFailed.listen(() => {
	// only show this status after a join attempt (not a rejoin)
	if (Globals.hasJoinCode())
		statusError("Join failed; check your code");
	else
		statusNone();
});
client.disconnected.listen(() => {
	page.set(unit("landing"));
});
client.connectionFailed.listen(() => {
	Globals.clearRejoinInfo();
	//Globals.joinCode = "";
});
INC.listen("terminated", () => {
	Globals.clearRejoinInfo();
	//Globals.joinCode = "";
});
INC.listen("accepted", ({ playerId, token }) => {
	// Set rejoin info (but only if we're not rejoining)
	if (Globals.hasJoinCode())
		Globals.setRejoinInfo(playerId, token);
});
INC.listen("inLobby", ({ promoted }) => {
	statusNone();
	page.set(variant("lobby", { promoted }));
});
INC.listen("inGame", () => {
	page.set(unit("drawblins"));
});
INC.listen("error", (message) => {
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
function statusNone() {
	status.set(null);
}
function statusInfo(message: string) {
	status.set({ type: "info", message });
}
function statusError(message: string) {
	status.set({ type: "error", message });
}

function landing() {
	
	//function joinGame(code: string, name: string) {
	function joinGame() {
	
		if (!client.state.is(Connection.CLOSED))
			return;
		
		let code = Globals.joinCode;
		let name = Globals.playerName;
		
		if (name.length < Globals.MIN_NAME_LEN)
			return statusError("Name too short");
		if (name.length > Globals.MAX_NAME_LEN)
			return statusError("Name too long");
		
		Globals.storePlayerName();
		
		if (code.length !== Globals.CODE_LEN)
			return statusError("Invalid code");
		
		//console.log(name, code);
		//Globals.joinCode = code.toUpperCase();
		let url = Globals.getJoinUrl();
		if (url) client.connect(url);
	}
	
	const canHost = !Utils.isMobileClient;
	
	return stateful(client.state, (curr) => {
		const disabled = (curr !== Connection.CLOSED);
		return h("div#landing.tab", [
			h("div", [
				h("h1", "GoblinCon"),
				h("div.tab.join-input", [
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
					h("button#join-button", {
						attrs: { disabled },
						on: { click: joinGame }
					}, "Join!"),
					statusMessage()
				]),
			]),
			(!canHost) ? null :
				h("a#footer", {
					attrs: { href: "/host" }
				}, "Hosting a game? Click here")
		]);
	});
}
function lobby(promoted: boolean) {
	
	function startGame() {
		OUT.send("startGame", undefined);
	}
	
	return h("div#lobby.tab", [
		h("h1", "Lobby!!"),
		(!promoted) ? null :
			h("button#start-game-button", {
				on: { click: startGame }
			}, "Start Game")
	]);
}

function app() {
	/* Attempt rejoin */
	let rejoinUrl = Globals.getRejoinUrl();
	if (rejoinUrl) client.connect(rejoinUrl);
	
	return stateful(page, (curr) => {
		switch(curr.key) {
			case "landing": return landing();
			case "lobby": return lobby(curr.promoted);
			case "drawblins": return Drawblins.view();
		}
	});
}

window.addEventListener("DOMContentLoaded", () => patchRoot(app()));
window.onbeforeunload = () => client.close();



