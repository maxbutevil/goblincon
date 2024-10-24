
import { Shared, PlayerIcons, h, fragment } from "../modules/index"

export default function() {
	return h("div", [
		h("h1", "GoblinCon"),
		h(
			"div#icon-row",
			([0, 1, 2, 3, 4, 5, 6]).map(i =>
				PlayerIcons.view(i, Shared.PLAYER_COLORS[i]))
		)
	]);
}