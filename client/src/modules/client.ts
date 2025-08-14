
//import Client from "../modules/client"
//import Extract, { SendIndex, ReceiveIndex } from "./modules/extract"
import { State, Signal } from "./micron"
import { SendIndex, ReceiveIndex } from "./validate"

export enum Connection {
	PENDING,
	OPEN,
	CLOSED
}

const HEARTBEAT_INTERVAL_MS = 45 * 1000;

type Message = { seq?: number, type: string, data: any };
class Client {
	
	// exposed state
	state = new State(Connection.CLOSED);
	
	//pending = this.state.map(s => s === Connection.PENDING);
	
	pending = this.state.transitionTo(Connection.PENDING);
	connected = this.state.transitionTo(Connection.OPEN);
	disconnected = this.state.transitionFrom(Connection.OPEN);
	connectionFailed = this.state.transition(Connection.PENDING, Connection.CLOSED);
	
	closed = new Signal<[CloseEvent]>();
	
	// how the client is told about incoming messages
	// in practice, this is forwarded to a ReceiveIndex
	private incoming = new Signal<[Message]>();
	
	// internal state
	private ws: WebSocket | undefined;
	private ack = 0;
	private heartbeatTimeout: number | undefined;
	private readonly heartbeatCallback = () => this.send(""); // cached callback
	
	//constructor() {}
	connect(addr: string) {
		
		if (!this.state.is(Connection.CLOSED)) {
			return;
		}
		
		this.ws = new WebSocket(addr);
		this.state.set(Connection.PENDING);
		this.resetHeartbeat();
		
		this.ws.onopen = () => {
			console.info("WebSocket connection opened!");
			this.state.set(Connection.OPEN);
		};
		this.ws.onclose = (ev) => {
			console.warn("WebSocket connection closed:", ev);
			this.ws = undefined;
			this.state.set(Connection.CLOSED);
			this.closed.emit(ev);
		};
		this.ws.onerror = (ev) => {
			console.error("WebSocket error:", ev);
			//this.ws = undefined;
			//this.state.set(Connection.CLOSED);
		};
		this.ws.onmessage = (ev: MessageEvent<any>) => {
			this.resetHeartbeat();
			if (typeof ev.data != "string") {
				console.error("Non-String message received:", ev.data);
			} else {
				let raw = ev.data, message;
				try {
					message = JSON.parse(raw);
				} catch(err) {
					console.error("Error parsing message:", raw, err);
					return;
				}
				
				const { type, seq } = message;
				
				if (typeof type !== "string") {
					console.error("Invalid message type:", raw)
					return;
				}
				if (typeof seq === "number") {
					console.info("ack", message.seq);
					
					if (seq <= this.ack) {
						console.info("message already acknowledged; discarding");
						return;
					}
					if (seq > this.ack + 1) {
						console.error("message sequencing error");
						// close?
					}
					
					this.ack = seq;
					
					this.ws?.send(JSON.stringify({
						type: "ack",
						data: seq
					}))
				}
				
				this.handle(message);
			}
		};
	}
	close(code?: number, reason?: string) {
		this.ws?.close(code, reason);
	}
	resetAck() {
		this.ack = 0;
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
	
	// these methods allow the client to feed into receive/send indices and
	// have an easy escape hatch (since they all return cleanup functions)
	use(inc: ReceiveIndex<any>, out: SendIndex<any>): () => void {
		return Signal.bundle(this.useInc(inc), this.useOut(out));
	}
	useInc(idx: ReceiveIndex<any>): () => void {
		return this.incoming.subscribe(({ type, data }) => idx.handle(type, data));
	}
	useOut(idx: SendIndex<any>): () => void {
		return idx.outgoing.subscribe((data) => {
			this.send(data);
			return Signal.HANDLED;
		});
	}
}

const client = new Client();
export default client;

