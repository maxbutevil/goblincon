

import { wsRoot } from "../modules/shared"

class Globals {
	
	static joinCode = new URLSearchParams(window.location.search).get("code") ?? "";
	static playerName = localStorage.getItem("playerName") ?? "";
	
	static readonly MIN_NAME_LEN = 2;
	static readonly MAX_NAME_LEN = 16;
	static readonly CODE_LEN = 5;
	
	static storePlayerName() {
		try {
			localStorage.setItem("playerName", this.playerName);
		} catch(e) {
			console.log("Error saving playerName to localStorage: ", e);
		}
	}
	static setRejoinInfo(id: number, token: number) {
		try {
			localStorage.setItem("rejoinCode", this.joinCode);
			localStorage.setItem("rejoinId", id.toString());
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
			return `${wsRoot}/play/join?name=${this.playerName}&code=${this.joinCode.toUpperCase()}`;
		} else {
			return null;
		}
	}
	static getRejoinUrl(): string | null {
		let name = this.playerName;
		let code = localStorage.getItem("rejoinCode")?.toUpperCase();
		let id = localStorage.getItem("rejoinId");
		let token = localStorage.getItem("rejoinToken");
		/* Maybe length check name and code? */
		if (name && code && id && token) {
			let params = `code=${code}&name=${name}&id=${id}&token=${token}`;
			return `${wsRoot}/play/rejoin?${params}`;
		} else {
			return null;
		}
	}
	

};

export default Globals;

