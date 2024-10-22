
import "./shared.css"
import "./play.css"

import {
	State, Variant, unit, variant,
	Validate, ReceiveIndex, SendIndex,
	client, Connection,
	Shared,
	PlayerIcons,
	patchRoot, h, fragment, stateful, contained, VNode,
} from "./modules/index"

import Globals from "./play/globals"
import * as Drawblins from "./play/drawblins"

const INC = new ReceiveIndex({
	terminated: Validate.NONE,
	error: Validate.STRING,
	
	accepted: { playerId: Validate.NUMBER, token: Validate.NUMBER },
	inLobby: { promoted: Validate.BOOL },
	inGame: Validate.NONE, // eventually needs to hold the settings
});
const OUT = new SendIndex({
	startGame: Validate.NONE,
	changeIcon: { icon: Validate.NUMBER }
});

type Page = 
	Variant<"landing"> |
	Variant<"lobby", { promoted: boolean }> |
	Variant<"drawblins">;

const page = State.deep<Page>(unit("landing"));


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
});
INC.listen("terminated", () => {
	Globals.clearRejoinInfo();
});
INC.listen("accepted", ({ playerId, token }) => {
	Globals.playerId = playerId;
	Globals.storeRejoinInfo(token);
});
INC.listen("inLobby", ({ promoted }) => {
	statusNone();
	page.set(variant("lobby", { promoted }));
});
INC.listen("inGame", () => {
	page.set(unit("drawblins"));
});
INC.listen("error", (message) => {
	if (Globals.hasJoinCode())
		statusError(message);
	else
		console.warn("Couldn't rejoin game: ", message);
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
	
	const canHost = !Shared.isMobileClient;
	
	const rowIcons = ([0, 1, 2, 3, 4, 5, 6]).map(i => PlayerIcons.view(i, Shared.PLAYER_COLORS[i]));
	
	return h("div#landing.tab", [
		h("div", [
			h("h1", "GoblinCon"),
			h("icon-row", rowIcons),
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
						h("button#join-button", {
							attrs: { disabled },
							on: { click: joinGame }
						}, "Join!"),
					]
				);	
			}),
			clearedStatusMessage()
		]),
		(!canHost) ? null :
			h("a#footer", {
				attrs: { href: "/host" }
			}, "Hosting a game? Click here")
	]);
}
function lobby(promoted: boolean) {
	
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
								Globals.playerIcon = i;
								Globals.storePlayerIcon();
								OUT.send("changeIcon", { icon: i });
								rerender();
							}
						}
					},
				));
			}
			
			return h("div.icon-select", icons);
		});
		
		
	}
	
	return h("div#lobby.tab", [
		h("h1", "Lobby!!"),
		iconSelect(),
		(!promoted) ? null :
			fragment([
				h(
					"button#start-game-button",
					{	on: { click: startGame } },
					"Start Game"
				),
				clearedStatusMessage() /* to say "Not Enough Players" */
			])
	]);
}

patchRoot(app());
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


window.onbeforeunload = () => client.close();



