
//import Client from "../modules/client"
import Extract, { SendIndex, ReceiveIndex } from "./modules/extract"
import State from "./modules/state"
import Signal from "./modules/signal"


export enum Connection {
	PENDING,
	OPEN,
	CLOSED
}


//const ADDR = "ws://localhost:5050";

class Client {
	
	state = new State(Connection.CLOSED);
	pending = this.state.transitionTo(Connection.PENDING);
	connected = this.state.transitionTo(Connection.OPEN);
	disconnected = this.state.transitionFrom(Connection.OPEN);
	connectionFailed = this.state.transition(Connection.PENDING, Connection.CLOSED);
	//error = new Signal<void>();
	
	//phase = new State(Phase.NONE);
	
	inc = new ReceiveIndex({
		
		statusUpdate: { kind: Extract.choice("error"), message: Extract.STRING },
		
		lobbyJoined: { promoted: Extract.BOOL },
		promoted: Extract.NONE,
		
		gameStarted: Extract.NONE,
		gameTerminated: Extract.NONE,
		
		drawingStarted: Extract.NONE,
		votingStarted: { choices: Extract.array(Extract.STRING) },
		scoringStarted: Extract.NONE,
		
	});
	out = new SendIndex({
		
		startGame: Extract.NONE,
		drawingSubmission: { drawing: Extract.STRING },
		//voteSubmission: { forId: Extract.NUMBER },
		voteSubmission: { forName: Extract.STRING },
		
	}, (data: string) => this.ws?.send(data));
	
	//voteChoices: Array<string> = [];
	
	private ws: WebSocket | undefined;
	
	//listen = this.inc.listen;
	//send = this.out.send;
	
	constructor() {
		
		/*this.inc.listen("promoted", () => {
			this.promoted.emit();
		});*/
		
		
	}
	connect(addr: string) {
		
		this.ws = new WebSocket(addr);
		this.state.set(Connection.PENDING);
		
		this.ws.onopen = () => {
			console.log("WebSocket connection opened!");
			this.state.set(Connection.OPEN);
			//this.phase.set(Phase.LOBBY);
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

