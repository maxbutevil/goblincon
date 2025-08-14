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
			h("div#name-popup", [
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

const tips = [
	//"Click on a tip to show a new one (try it on this one!)",
	//"Join the discord!",
	
	// Creative
	"The main goal of GoblinCon is to draw silly creatures",
	"Don't worry if you're not happy with your drawing. It's the concept that counts!",
	"Prompts are there for inspiration; don't worry about sticking to them perfectly",
	
	// Technical
	"If you're ever confused, try the help button at the bottom left",
	
	// Hosting
	"You can use an HDMI cable and a TV to host on a larger device",
	//"You can play remotely if you use a Discord voice channel to stream from the host device",
	
	// Drawpad
	"You can use two fingers to \"pinch zoom\" on your mobile device",
	"Use the arrow buttons at the bottom of the drawing pad to undo and redo",
	"Use the circular button at the bottom of the drawing pad to change your pen size",
	"Use the large pen for backgrounds - it draws behind what you already have!",
];

export function Tip() {
	const tip = tips[Math.floor(Math.random() * tips.length)];
	return h("div.tip", `Tip: ${tip}`);
}
