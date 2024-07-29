
import Signal from "./signal"
import State from "./state"
import React from "react"

export function useForceRerender(): () => void {
	var [, rerender] = React.useState({});
	//return React.useCallback(() => rerender({}), []);
	return () => rerender({});
}
export function useSignal<V>(signal: Signal<any>) {
	React.useEffect(() => {
		return signal.subscribe(useForceRerender())
	}, []);
}
/*export function useExternal<T>(state: State<T>) {
	useSignal(state.changed);
}*/
export function useExternal(state: State<any>) {
	var [, rerender] = React.useState({});
	React.useEffect(() => {
		return state.changed.subscribe(() => rerender({}))
	}, []);
}

function wrap() {
	
}

