
//import Client from "../modules/client"
//import Extract, { SendIndex, ReceiveIndex } from "./modules/extract"
import State from "./modules/state"
import Signal from "./modules/signal"
import { SendIndex, ReceiveIndex } from "./modules/extract"

export enum Connection {
	PENDING,
	OPEN,
	CLOSED
}


//const ADDR = "ws://localhost:5050";

type Message = { type: string, data: any };
class Client {
	
	//incoming = new Signal<string>();
	private incoming = new Signal<Message>();
	//private paused?: Array<Message>;
	
	state = new State(Connection.CLOSED);
	pending = this.state.transitionTo(Connection.PENDING);
	connected = this.state.transitionTo(Connection.OPEN);
	disconnected = this.state.transitionFrom(Connection.OPEN);
	connectionFailed = this.state.transition(Connection.PENDING, Connection.CLOSED);
	//error = new Signal<void>();
	
	//phase = new State(Phase.NONE);
	
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
		};
		this.ws.onclose = () => {
			console.warn("WebSocket connection closed.");
			this.ws = undefined;
			this.state.set(Connection.CLOSED);
		};
		this.ws.onerror = (ev) => {
			console.error("WebSocket error: ", ev);
		};
		this.ws.onmessage = (ev: MessageEvent<string>) => {
			if (typeof ev.data != "string") {
				console.error(`Non-String message received: ${ev.data}`);
			} else {
				try {
					let raw = ev.data;
					let message = JSON.parse(raw);
					console.log(raw);
					if (typeof message.type !== "string")
						return console.error(`Unrecognized message: ${raw}`);
					
					//if (this.paused === undefined)
						this.handle(message);
					//else
					//	this.paused.push(message);
					
				} catch(err) {
					console.error(err);
				}
			}
		};
		
	}
	protected handle(message: Message) {
		let handled = this.incoming.handle(message);
		if (!handled)
			console.warn(`Unhandled message: ${JSON.stringify(message)}`);
	}
	send(data: string) {
		this.ws?.send(data);
	}
	/*pause() {
		if (this.paused === undefined)
			this.paused = [];
	}
	unpause() {
		if (this.paused === undefined)
			return;
		
		let messages = this.paused;
		this.paused = undefined;
		for (const message of messages) {
			if (this.paused !== undefined)
				break;
			this.handle(message);
		}
	}*/
	/*subscribe() {
		this.unpause();
		return () => this.pause();
	}*/
	use(inc: ReceiveIndex<any>, out: SendIndex<any>): () => void {
		//this.unpause();
		return Signal.group(
			this.incoming.subscribe(({ type, data }) => inc.handle(type, data)),
			out.outgoing.subscribe((data) => this.send(data)),
			//() => this.pause()
		);
	}
}

const client = new Client();
export default client;

//client.send("joinGame", { gameId: "yeah" });

