
import {
	State,
	h, s, c, defer,
	VNode, VNodeChildElement,
	//Shared, PlayerIcons,
} from "../modules/"
import * as Room from "./room"
import { Player } from "./room"

export function submission(player: number | Player, drawing: string, { name, voteIds }: { name?: string, voteIds?: number[] } = {}) {
	
	return h(
		"div.submission",
		[
			c(name && h("div.name", name)),
			h("img", { attrs: { src: drawing }}, ),
			typeof player === "number" ? Room.playerView(player) : Player.view(player), //Room.playerView(playerId),
			(!voteIds || voteIds.length === 0) ? null : h("div.vote-ctr", voteIds.map(Room.iconView))
		]
	);
	
	
}
export function submissionGrid(submissions: VNode[]): VNode {
	/* This is a nightmare, but so are 2D flexbox layouts */
	/* And it works! */
	let aspectRatio = window.innerWidth / window.innerHeight;
	let rowWidth = submissions.length;
	let rowCount = 1;
	if (submissions.length >= aspectRatio * 1.84) {
		for (let i = 2; i < submissions.length; i++) {
			rowCount = i;
			rowWidth = Math.ceil(submissions.length/i);
			if ((rowWidth / i) <= aspectRatio * 1.11)
				break;
		}
	}
	
	let rows: VNode[][] = [];
	for (let i = 0; i < rowCount; i++)
		rows.push([]);
	
	for (let i = 0; i < submissions.length; i++) {
		let row = Math.floor(i/rowWidth);
		rows[row].push(submissions[i]);
	}
	
	return h(
		"div.submission-ctr",
		rows.map(row => h("div.submission-row", row))
	);
}
/*export function anonymousSubmission(drawing: string) {
	
}*/


