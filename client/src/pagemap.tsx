/*
//type PageIndex = { [k: string]: }
type PageMethod<I> = (input: I) => JSX.Element;
type PageInput<M> = M extends PageMethod<infer I> ? I : never;
type PageOf<M> = M extends PageMap<infer P> ? P : never;
type PageIndex = { [k: string]: (() => JSX.Element) };
class PageMap<P> {
	
	state: keyof P;
	readonly map: P;
	
	constructor(map: P) {
		this.map = map;
	}
	function getPage() {
		
	}
	
	
}

const TestMap = new PageMap({
	"home": () => <div></div>
});

function a(a: number, b: string) {
	
}
type A = Parameters<typeof a>;
*/








