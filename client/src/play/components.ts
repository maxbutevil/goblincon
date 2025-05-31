import {
	State,
	h, s, Micron,
	Shared, playerIcons,
	//Node, Child, Children
} from "../modules/"
import Session from "./session"

type NameOverlayOptions = {
	onClose?: () => void
};
export class NameOverlay {
	
	readonly options: NameOverlayOptions;
	name?: string; // undefined if the overlay has never been opened
	
	constructor(options: NameOverlayOptions = {}) {
		this.options = options;
	}
	
	View(disabled = false) {
		
		const { onClose } = this.options;
		function close() {
			if (onClose) onClose();
		}
		
		return h("div#overlay", [
			h("div#name-popup.popup", [
				h("div.vflow", [
					h("h2", "Name Your Creation?"),
					h("input", {
						attrs: {
							disabled,
							maxLength: Session.MAX_SUBMISSION_NAME_LEN,
							value: (this.name ??= ""), // mildly evil
							//placeholder: "name..."
						},
						on: {
							input: (ev: Event) => {
								const elm = ev.currentTarget as HTMLInputElement;
								this.name = elm.value;
							},
							keydown: (ev: KeyboardEvent) => {
								if (ev.key === "Enter") close();
							}
						},
						hook: {
							insert: (node: Micron.Node) => {
								// requestAnimationFrame fixes an issue where, if holding down another button, select may fail (at least on Firefox)
								const elm = (node.elm as HTMLInputElement);
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
