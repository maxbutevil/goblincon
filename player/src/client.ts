
//import Client from "../modules/client"
import Extract, { SendIndex, ReceiveIndex } from "./modules/extract"
import State from "./modules/state"
import Signal from "./modules/signal"


export enum Connection {
	PENDING,
	OPEN,
	CLOSED
}

export enum Phase {
	NONE,
	LOBBY,
	START,
	DRAW,
	VOTE,
	SCORE,
	//IDLE
}

//const ADDR = "ws://localhost:5050";

class Client {
	
	state = new State(Connection.CLOSED);
	opened = this.state.transitionTo(Connection.OPEN);
	closed = this.state.transitionFrom(Connection.OPEN);
	connectionFailed = this.state.transition(Connection.PENDING, Connection.CLOSED);
	//error = new Signal<void>();
	
	phase = new State(Phase.NONE);
	
	inc = new ReceiveIndex({
		
		gameStarted: Extract.NONE,
		gameTerminated: Extract.NONE,
		
		drawingStarted: Extract.NONE,
		votingStarted: { choices: Extract.array(Extract.STRING) },
		scoringStarted: Extract.NONE,
		
	});
	out = new SendIndex({
		
		startGame: Extract.NONE,
		drawingSubmission: { drawing: Extract.STRING },
		voteSubmission: { forId: Extract.NUMBER },
		
	}, (data: string) => this.ws?.send(data));
	
	voteChoices: Array<string> = [];
	
	private ws: WebSocket | undefined;
	
	//listen = this.inc.listen;
	//send = this.out.send;
	
	constructor() {
		
		this.inc.listen("gameStarted", () => {
			this.phase.set(Phase.START);
		});
		this.inc.listen("drawingStarted", () => {
			this.phase.set(Phase.DRAW);
		});
		this.inc.listen("votingStarted", ({ choices }: { choices: Array<string> }) => {
			this.voteChoices = choices;
			this.phase.set(Phase.VOTE);
		});
		this.inc.listen("scoringStarted", () => {
			this.phase.set(Phase.SCORE);
		})
		this.inc.listen("gameTerminated", () => {
			//this.state.set(Connection.CLOSED);
			//this.ws.
			this.phase.set(Phase.NONE);
		});
		
	}
	connect(addr: string) {
		
		this.ws = new WebSocket(addr);
		this.state.set(Connection.PENDING);
		
		this.ws.onopen = () => {
			console.log("WebSocket connection opened!");
			this.state.set(Connection.OPEN);
			this.phase.set(Phase.LOBBY);
		};
		this.ws.onclose = () => {
			console.warn("WebSocket connection closed.");
			this.state.set(Connection.CLOSED);
		};
		this.ws.onerror = (ev) => {
			console.error("WebSocket error: ", ev);
			this.state.set(Connection.CLOSED);
		};
		this.ws.onmessage = (ev: MessageEvent<string>) => {
			if (typeof ev.data == "string") {
				this.inc.handle(ev.data);
			} else {
				console.error(`Non-String message received: ${ev.data}`);
			}
		};
		
	}
	
}

const client = new Client();
export default client;

//client.send("joinGame", { gameId: "yeah" });

