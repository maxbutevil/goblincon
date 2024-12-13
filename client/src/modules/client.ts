
//import Client from "../modules/client"
//import Extract, { SendIndex, ReceiveIndex } from "./modules/extract"
import State from "./state"
import Signal from "./signal"
import { SendIndex, ReceiveIndex } from "./validate"

export enum Connection {
	PENDING,
	OPEN,
	CLOSED
}


//const ADDR = "ws://localhost:5050";

const HEARTBEAT_INTERVAL_MS = 45 * 1000;

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
	
	private ws: WebSocket | undefined;
	private heartbeatTimeout: NodeJS.Timeout | undefined;
	private heartbeatCallback = () => this.send(""); // for callback caching
	
	//constructor() {}
	connect(addr: string) {
		
		this.ws = new WebSocket(addr);
		this.state.set(Connection.PENDING);
		this.resetHeartbeat();
		
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
			this.state.set(Connection.CLOSED);
		};
		this.ws.onmessage = (ev: MessageEvent<any>) => {
			this.resetHeartbeat();
			if (typeof ev.data != "string") {
				console.error(`Non-String message received: ${ev.data}`);
			} else {
				try {
					let raw = ev.data;
					console.log(raw);
					let message = JSON.parse(raw);
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
		
		//setTimeout(() => this.close(), 3000);
		//this.close();
		//this.state.set(Connection.CLOSED);
		
	}
	close() {
		this.ws?.close();
	}
	protected handle(message: Message) {
		let handled = this.incoming.handle(message);
		if (!handled)
			console.warn(`Unhandled message: ${JSON.stringify(message)}`);
	}
	protected resetHeartbeat() {
		clearTimeout(this.heartbeatTimeout);
		this.heartbeatTimeout = setTimeout(this.heartbeatCallback, HEARTBEAT_INTERVAL_MS);
	}
	
	send(data: string) {
		this.resetHeartbeat();
		this.ws?.send(data);
	}
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

