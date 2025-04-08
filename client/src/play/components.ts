import {
	State,
	h, s, defer,
	Shared, PlayerIcons,
	VNode, VNodeChildren, VNodeChildElement
} from "../modules/"
import Session from "./session"


type NameOverlayOptions = {
	onClose?: () => void
};
export class NameOverlay {
	
	readonly options: NameOverlayOptions;
	name?: string;
	
	constructor(options: NameOverlayOptions = {}) {
		this.options = options;
	}
	
	view(disabled = false) {
		
		const { onClose } = this.options;
		function close() {
			if (onClose) onClose();
		}
		
		return h("div#overlay", [
			h("div#name-popup.popup", [
				h("div.vflow", [
					h("h2", "Name Your Creature?"),
					h("input", {
						attrs: {
							disabled,
							maxLength: Session.MAX_SUBMISSION_NAME_LEN,
							value: (this.name ??= ""), // mildly evil
							//placeholder: "name..."
						},
						on: {
							input: (ev) => {
								const elm = ev.currentTarget as HTMLInputElement;
								this.name = elm.value;
							},
							keydown: (ev) => {
								if (ev.key === "Enter") close();
							}
						},
						hook: {
							insert: (vnode) => {
								// requestAnimationFrame fixes an issue where, if holding down another button, select may fail (at least on Firefox)
								const elm = (vnode.elm as HTMLInputElement);
								requestAnimationFrame(() => elm.select());
							}
						}
					}),
					h("button", { on: { click: close } }, "Done!")
				])
			])
		]);
	}
}
