import {
	State,
	h, s, Micron,
	Shared, playerIcons,
	//Node, Child, Children
} from "../modules/"
import Session from "./session"



type BarOptions = {
	middle?: Micron.Children,
	left?: Micron.Children,
	right?: Micron.Children
};
/*type TopBarOptions = {
	title?: string,
	left?: Micron.Children,
	right?: Micron.Children,
};
type BottomBarOptions = {
	countdown?: Countdown,
	left?: Micron.Children,
	right?: Micron.Children
};*/
export function TopBar({ middle, left, right }: BarOptions) {
	return h("div#top-bar", [
		h("div.left", left),
		h("div.middle", middle),
		//h("div.middle", h("div.title", title)),
		h("div.right", right),
	]);
}
export function BottomBar({ middle, left, right }: BarOptions) {
	return h("div#bottom-bar", [
		h("div.left", left),
		h("div.middle", middle),
		//h("div.middle", countdown?.View()),
		h("div.right", right)
	]);
}
export function IdlePage(title: string, subtitle?: string) {
	return h("div.scaffold", [
		TopBar({
			middle: h("div.title", title)
		}),
		subtitle && h("div.primary-page", [
			h("div.idle-subtitle",
				{ style: { fontSize: "1.3em" } },
				subtitle
			)
		])
	]);
}
export class Nav extends Micron.Anchor {

	static create<A extends any[] = []>(initial?: Micron.Builder<A>, ...initialArgs: A): Nav {
		return new Nav(!initial ? undefined : [initial, initialArgs]);
	}
	Btn(children: Micron.Children, builder: Micron.Builder) {
		return s(this.changed, curr => {
			const click = () => this.toggle(builder);
			const selected = this.is(builder);
			return h("div.btn",
				{ class: { selected }, on: { click } },
				children
			);
		});
	}
	IconBtn(src: string, builder: Micron.Builder) {
		const icon = h("img", { attrs: { src } });
		return this.Btn(icon, builder);
	}
}



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
