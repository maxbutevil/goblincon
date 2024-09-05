

import Extract, { Extractor } from "../modules/extract"
type RejoinInfo = { code: string, playerId: number, token: number };
const REJOIN_INFO_EXTRACTOR: Extractor<RejoinInfo> = {
	code: Extract.STRING,
	playerId: Extract.NUMBER,
	token: Extract.NUMBER
};

class Globals {
	static joinCode?: string;
	static playerName = localStorage.getItem("playerName") ?? "";
	static getJoinCode() {
		
	}
	static getInitialJoinCode(): string {
		return new URLSearchParams(window.location.search).get("code") ?? "";
	}
	static getPlayerName(): string {
		return this.playerName;
	}
	static setPlayerName(newName: string) {
		try {
			localStorage.setItem("playerName", this.playerName = newName);
		} catch(e) {
			console.log(e);
		}
	}
	static setRejoinInfo(info: RejoinInfo) {
		try {
			localStorage.setItem("rejoinInfo", JSON.stringify(info));
		} catch(e) {
			console.error(e);
		}
	}
	static clearRejoinInfo() {
		localStorage.removeItem("rejoinInfo");
	}
	static getRejoinInfo(): RejoinInfo | undefined {
		let raw = localStorage.getItem("rejoinInfo");
		if (raw === null)
			return undefined;
		return Extract.get(REJOIN_INFO_EXTRACTOR, JSON.parse(raw));
	}
};

export default Globals;
/*export function useLifetime(callback: (() => undefined) | (() => () => void)) {
	const appliedRef = React.useRef(false);
	if (appliedRef.current === false) {
		appliedRef.current = true;
		const cleanup = callback();
		if (cleanup !== undefined) {
			React.useEffect(() => cleanup, []);
			React.useMemo
		}
	}
}*/

