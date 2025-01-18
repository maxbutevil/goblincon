

import { State, h, stateful, cleaned, VNodeChildren } from "../modules/index"

function vflowPopup(children: VNodeChildren) {
	return h("div.overlay",
		h("div.popup.vflow", children)
	);
}


