
import React from "react"


export default function Countdown({ endTime, onFinish }: { endTime: number, onFinish?: () => void }) {
	
	/* A lot more complicated than I expected... */
	
	const delta = endTime - Date.now();
	const [seconds, setSeconds] = React.useState(Math.ceil((delta - 50)/1000));
	
	React.useEffect(() => {
		
		let interval: NodeJS.Timeout;
		let nextSecondDelta = delta % 1000; // Deal with fractional seconds neatly
		
		setTimeout(() => {
			
			const tick = () => {
				
				let delta = endTime - Date.now() - 50; // The 50 accounts for undershooting
				
				let newSeconds = Math.ceil(delta/1000);
				
				if (newSeconds <= 0) {
					if (onFinish != undefined)
						onFinish();
					
					setSeconds(0);
					clearInterval(interval);
				}
				else {
					setSeconds(newSeconds);
				}
			};
			
			tick();
			interval = setInterval(tick, 1000);
		}, nextSecondDelta);
		
		return () => {
			if (interval)
				clearInterval(interval);
		}
		
	}, []);
	
	const style = seconds <= 3 ? { color: "red" } : {};
	
	return (
		<div className="countdown" style={style}>{seconds}</div>
	);
	
	
}