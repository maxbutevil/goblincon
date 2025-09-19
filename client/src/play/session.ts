


import { Shared } from "../modules/"

function stripUrlParams() {
	if (window.location.search.length > 0) {
		window.history.replaceState({}, document.title, window.location.pathname);
	}
}

export default class Session {
	
	static readonly MIN_NAME_LEN = 2;
	static readonly MAX_NAME_LEN = 16;
	static readonly CODE_LEN = 5;
	static readonly MAX_SUBMISSION_NAME_LEN = 64;
	static readonly DEFAULT_ID = -1;
	static readonly DEFAULT_ICON = 0;
	
	/*static joinCode = new URLSearchParams(window.location.search).get("code") ?? "";
	static playerName = localStorage.getItem("playerName") ?? "";
	static playerIcon = parseInt(localStorage.getItem("playerIcon") ?? "2");
	static playerId = parseInt(localStorage.getItem("rejoinId") ?? "-1");*/
	static joinCode = "";
	static playerId = this.DEFAULT_ID;
	static playerIcon = this.DEFAULT_ICON;
	static playerName = "";
	static get playerColor() {
		return Shared.playerColor(this.playerId);
	}
	
	static load() {
		try {
			this.playerId = parseInt(localStorage.getItem("rejoinId") ?? this.DEFAULT_ID.toString());
			this.playerIcon = parseInt(localStorage.getItem("playerIcon") ?? this.DEFAULT_ICON.toString());
			this.playerName = localStorage.getItem("playerName") ?? "";
			this.joinCode = new URLSearchParams(window.location.search).get("code") ?? (localStorage.getItem("rejoinCode") ?? "");
		} catch(err) {
			console.error("error retrieving rejoin info:", err)
		} finally {
			stripUrlParams();
		}
	}
	
	static storePlayerName() {
		try {
			localStorage.setItem("playerName", this.playerName);
		} catch(err) {
			console.warn("localStorage error:", err);
		}
	}
	static setPlayerIcon(newIcon: number) {
		try {
			localStorage.setItem("playerIcon", (this.playerIcon = newIcon).toString());
		} catch(err) {
			console.warn("localStorage error:", err);
		}
	}
	static storeRejoinInfo(id: number, token: string) {
		this.playerId = id;
		try {
			if (this.joinCode !== "") localStorage.setItem("rejoinCode", this.joinCode);
			localStorage.setItem("rejoinName", this.playerName);
			localStorage.setItem("rejoinId", this.playerId.toString());
			localStorage.setItem("rejoinToken", token);
		} catch(e) {
			console.error("error saving rejoinInfo to localStorage:", e);
		}
	}
	static pullRejoinInfo() {
		this.playerId = parseInt(localStorage.getItem("rejoinId") ?? "-1");
	}
	static clearRejoinInfo() {
		localStorage.removeItem("rejoinName");
		localStorage.removeItem("rejoinCode");
		localStorage.removeItem("rejoinId");
		localStorage.removeItem("rejoinToken");
	}
	
	static setupManualRejoin() {
		if (!this.joinCode) {
			this.playerName = localStorage.getItem("rejoinName") ?? this.playerName; // not sure about this one
			this.joinCode = localStorage.getItem("rejoinCode") ?? "";
		}
	}
	static canManualRejoin(): boolean {
		const rejoinName = localStorage.getItem("rejoinName");
		const rejoinCode = localStorage.getItem("rejoinCode");
		return this.playerName === rejoinName && this.joinCode === rejoinCode;
	}
	
	static joinUrl(): string | null {
		if (this.playerName && this.joinCode) {
			const code = this.joinCode.toUpperCase();
			const name = this.playerName;
			const icon = this.playerIcon;
			return `${Shared.wsRoot}/play/join?code=${code}&name=${name}&icon=${icon}`;
		} else {
			return null;
		}
	}
	private static baseRejoinUrl(): string | null {
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
	static autoRejoinUrl(): string | null {
		return this.baseRejoinUrl();
	}
	static manualRejoinUrl(): string | null {
		const baseUrl = this.baseRejoinUrl();
		return !baseUrl ? null : `${baseUrl}&manual=true`;
	}
}


//window.addEventListener("load", stripUrlParams);

Session.load();

/*function store(key: string, value: string) {
	try { localStorage.setItem("playerName", playerName); }
	catch(e) { console.log("localStorage error:", e); }
}*/


