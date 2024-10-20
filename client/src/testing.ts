import './styles.css'
import State from './modules/state'
import { h, patch, patchRoot, stateful, cleaned, fragment, VNode } from './modules/render';

import * as icons from "./assets/drawpad/index"

const count = new State([1, 1]);

function submission(): VNode {
	
	const playerName = "joe";
	const drawing = icons.erase;
	//const drawing = currentRound().drawings[playerId];
	
	//if (playerName === undefined || drawing === undefined)
	//	return null;
	
	/*let voteIcons = [];
	for (let i = 0; i < voteCount; i++)
		voteIcons.push(<VoteIcon key={i} index={i} />)*/
	
	return h(
		"div.submission",
		[
			h("img", { attrs: { src: drawing }}),
			h("div.player-name", playerName),
			/* vote icons here */
		]
	);
}

window.addEventListener("DOMContentLoaded", () => {
	
	
	
	patchRoot(
		h(
			"div.tab",
			[
				h("div", `Vote for your favorite Burger!`),
				stateful(count, (curr) => {
					
					let [submissionCount, _rowCount] = curr;
					
					/*let aspectRatio = window.innerWidth / window.innerHeight;
					
					let rowCount = 1;
					let thresholds = [0, 3, 6, 10];
					for (let i = thresholds.length - 1; i >= 0; i--) {
						if (curr > thresholds[i]) {
							rowCount = i + 1;
							break;
						}
					}
					
					console.log(rowCount);*/
					
					let aspectRatio = window.innerWidth / window.innerHeight;
					let rowWidth = submissionCount;
					let rowCount = 1;
					if (submissionCount >= aspectRatio * 2.4) {
						for (let i = 2; i < submissionCount; i++) {
							rowCount = i;
							rowWidth = Math.ceil(submissionCount/i);
							if ((rowWidth / i) <= aspectRatio * 1.2) {
								break;
							}
						}
					}
					
					//console.log(rowCount, rowWidth);
					
					
					//let rowCount = Math.ceil(curr/4);
					//let rowWidth = Math.ceil(submissionCount/rowCount);
					let rows: VNode[][] = [];
					for (let i = 0; i < rowCount; i++) {
						rows.push([]);
					}
					
					//let submissions: (VNode | null)[] = [];
					for (let i = 0; i < submissionCount; i++) {
						let row = Math.floor(i/rowWidth);
						rows[row].push(submission());
					}
					
					/*let submissions: VNode[] = [];
					for (let i = 0; i < curr; i++)
						submissions.push(submission());*/
					
					let selector = rowCount <= 1 ? "div.submission-ctr.single-row" : "div.submission-ctr";
					
					return h(
						selector,
						/*{
							hook: {
								insert: vnode => {
									let elm = vnode.elm as HTMLElement;
									elm.scrollTo({ top: elm.scrollHeight, behavior: "smooth" });
								}
							}
						},*/
						//submissions
						rows.map(row => h("div.submission-row", row))
					);
				})
			]
		)
	);
	
});
window.addEventListener("mousedown", ev => {
	let curr = count.get();
	if (ev.button === 0)
		count.set([curr[0] + 1, curr[1]]);
	else
		count.set([curr[0], curr[1] + 1]);
});


