


import { Shared } from "../modules/index"

/*enum State {
	REJOIN
	CONNECTED
}*/

class Globals {
	
	static joinCode = new URLSearchParams(window.location.search).get("code") ?? "";
	static playerName = localStorage.getItem("playerName") ?? "";
	static playerIcon = parseInt(localStorage.getItem("playerIcon") ?? "2");
	static playerId = parseInt(localStorage.getItem("rejoinId") ?? "-1");
	
	static get playerColor() { return Shared.playerColor(this.playerId); }
	
	static readonly MIN_NAME_LEN = 2;
	static readonly MAX_NAME_LEN = 16;
	static readonly CODE_LEN = 5;
	
	static wasRejoining() {
		return !this.hasJoinCode();
	}
	static storePlayerName() {
		try { localStorage.setItem("playerName", this.playerName); }
		catch(e) { console.log("localStorage error: ", e); }
	}
	static storePlayerIcon() {
		try { localStorage.setItem("playerIcon", this.playerIcon.toString()); }
		catch(e) { console.log("localStorage error: ", e); }
	}
	/*static storePlayerId() {
		try { localStorage.setItem("playerId", this.playerId.toString()); }
		catch(e) { console.log("localStorage error: ", e); }
	}*/
	static storeRejoinInfo(token: number) {
		try {
			if (this.joinCode !== "") localStorage.setItem("rejoinCode", this.joinCode);
			localStorage.setItem("rejoinId", this.playerId.toString());
			localStorage.setItem("rejoinToken", token.toString());
		} catch(e) {
			console.error("Error saving rejoinInfo to localStorage: ", e);
		}
	}
	static clearRejoinInfo() {
		localStorage.removeItem("rejoinCode");
		localStorage.removeItem("rejoinId");
		localStorage.removeItem("rejoinToken");
	}
	
	static hasJoinCode(): boolean {
		return this.joinCode !== "";
	}
	static getJoinUrl(): string | null {
		if (this.playerName && this.joinCode) {
			return `${Shared.wsRoot}/play/join?code=${this.joinCode.toUpperCase()}&name=${this.playerName}&icon=${this.playerIcon}`;
		} else {
			return null;
		}
	}
	static getRejoinUrl(): string | null {
		let name = this.playerName;
		let icon = this.playerIcon;
		let code = localStorage.getItem("rejoinCode")?.toUpperCase();
		let id = localStorage.getItem("rejoinId");
		let token = localStorage.getItem("rejoinToken");
		/* Maybe length check name and code? */
		if (name && code && id && token) {
			let params = `code=${code}&name=${name}&icon=${icon}&id=${id}&token=${token}`;
			return `${Shared.wsRoot}/play/rejoin?${params}`;
		} else {
			return null;
		}
	}
};

/* strip out URL parameters */
window.addEventListener("load", () => {
	if(window.location.search.length > 0) {
		window.history.replaceState({}, document.title, window.location.pathname);
	}
});

export default Globals;

