
import {
	State,
	h, s, defer,
	VNode, VNodeChildElement,
	//Shared, PlayerIcons,
} from "../modules/index"
import * as Room from "./room"
//import { Player } from "./room"

/*export function submissionBase(drawing: string, children: VNodeChildElement[]) {
	return h(
		"div.submission",
		[
			h("img", { attrs: { src: drawing }}),
			...children
			//Room.playerView(playerId),
			//voteIds.length === 0 ? null : h("div.vote-ctr", voteIds.map(Room.iconView))
		]
	);
}*/
export function submission(playerId: number, drawing: string, voteIds: number[] = []) {
	//const player = Room.player(playerId)
	/*return submissionBase(drawing, [
		Room.playerView(playerId),
		voteIds.length === 0 ? null : h("div.vote-ctr", voteIds.map(Room.iconView))
	]);*/
	return h(
		"div.submission",
		[
			h("img", { attrs: { src: drawing }}),
			Room.playerView(playerId),
			voteIds.length === 0 ? null : h("div.vote-ctr", voteIds.map(Room.iconView))
		]
	);
}
/*export function anonymousSubmission(drawing: string) {
	
}*/


