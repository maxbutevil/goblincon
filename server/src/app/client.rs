
use crate::globals::*;
use timeout::Timeout;
use super::cf;

use std::ops::{Deref, DerefMut};
use std::collections::VecDeque;

use slab::Slab;
use tokio::sync::mpsc;
use tokio::task::JoinHandle;
use async_scoped::TokioScope;
//use axum::extract::ws::Utf8Bytes;

pub use serde::{Serialize, Deserialize};


#[derive(Deserialize, Debug)]
#[serde(tag="type", content="data")]
#[serde(rename_all="camelCase")]
enum HostMsgIn {
	Ack(usize),
	Close
}

#[derive(Serialize, Debug)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
enum HostMsgOut {
	Accepted { join_code: RoomToken, token: ClientToken },
	
	//PlayerDisconnected { player_id: PlayerId },
	//PlayerReconnected { player_id: PlayerId },
	PlayerJoined { player_id: PlayerId, name: String, icon: PlayerIcon },
	PlayerLeft { player_id: PlayerId },
}

#[derive(Serialize, Debug)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
enum PlayerMsgOut<'a> {
	Accepted { player_id: PlayerId, token: &'a str }
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct TaggedMsg<'a, T: Serialize> {
	seq: usize,
	#[serde(flatten)]
	msg: &'a T
}

#[derive(Clone, Copy)]
pub enum ClientId {
	Host,
	Player(PlayerId)
}

pub enum ClientEvent {
	Close,
	Disconnect(ClientId),
	Message(ClientId, Utf8Bytes)
}

pub struct Presence {
	sender: WebSocketSender,
	handle: JoinHandle<()>
}
pub struct Player {
	presence: Presence,
	pub token: ClientToken,
	pub name: String,
}
pub struct Host {
	presence: Presence,
	buffer: HostBuffer,
	timeout: Timeout,
	pub token: ClientToken,
}
struct HostBuffer {
	msgs: VecDeque<Utf8Bytes>,
	msg_idx: usize, // index of last sent message
	ack_idx: usize, // index of last acknowledged message
}


impl Presence {
	pub fn new(sender: WebSocketSender, handle: JoinHandle<()>) -> Self {
		Self { sender, handle }
	}
	pub fn create(sender: Sender, socket: WebSocket, client_id: ClientId) -> Presence {
		let (tx, mut rx) = socket.split();
		let handle = tokio::spawn(async move {
			while let Some(content) = next_bytes(&mut rx).await {
				if content.is_empty() {
					/* This is an empty keep-alive msg, ignore */
					continue;
				}
				
				let event = ClientEvent::Message(client_id, content);
				let result = sender.send(event).await;
				if result.is_err() {
					break;
				}
			}
			
			let event = ClientEvent::Disconnect(client_id);
			let _ = sender.send(event).await;
		});
		Presence::new(tx, handle)
	}
	pub fn is_open(&self) -> bool {
		!self.handle.is_finished()
	}
	pub fn abort(&mut self) {
		self.handle.abort()
	}
	pub async fn close(&mut self, close_frame: cf::Frame) -> bool {
		self.send_raw(Message::Close(Some(close_frame))).await
	}
	
	async fn send_raw(&mut self, msg: Message) -> bool {
		// evil short-circuiting techniques
		self.is_open() && send_raw(&mut self.sender, msg).await.is_ok()
	}
	async fn send_bytes(&mut self, bytes: Utf8Bytes) -> bool {
		self.send_raw(Message::Text(bytes)).await
	}
	pub async fn send(&mut self, msg: &impl Serialize) -> bool {
		let Ok(msg) = serialize_bytes(msg) else { return false };
		self.send_bytes(msg).await
	}
	pub async fn ping(&mut self) -> bool {
		use axum::body::Bytes;
		self.send_raw(Message::Ping(Bytes::new())).await
	}
}

impl Deref for Player {
	type Target = Presence;
	fn deref(&self) -> &Presence { &self.presence }
}
impl DerefMut for Player {
	fn deref_mut(&mut self) -> &mut Presence { &mut self.presence }
}
impl Deref for Host {
	type Target = Presence;
	fn deref(&self) -> &Presence { &self.presence }
}
impl DerefMut for Host {
	fn deref_mut(&mut self) -> &mut Presence { &mut self.presence }
}

type Sender = mpsc::Sender<ClientEvent>;
type Receiver = mpsc::Receiver<ClientEvent>;

impl Host {
	
	const TIMEOUT_SHORT_DURATION: Duration = Duration::from_secs(30);
	const TIMEOUT_LONG_DURATION: Duration = Duration::from_secs(480);
	
	fn new(presence: Presence) -> Self {
		Self {
			presence,
			buffer: HostBuffer::new(),
			timeout: Timeout::new(Self::TIMEOUT_LONG_DURATION),
			token: ClientToken::generate(),
		}
	}
	pub async fn send(&mut self, msg: &impl Serialize) -> bool {
		
		let msg = self.buffer.handle_send(&msg);
		let Ok(msg) = msg else {
			self.timeout.reset(Duration::ZERO);
			return false;
		};
		
		self.presence.send_bytes(msg).await
	}
	fn acknowledge(&mut self, idx: usize) {
		let result = self.buffer.handle_acknowledge(idx);
		if result.is_ok() {
			self.reset_timeout();
		}
	}
	fn reset_timeout(&mut self) {
		/*if self.buffer.is_full() {
			self.timeout.reset(Duration::ZERO);
		} else */
		if self.buffer.is_empty() {
			self.timeout.reset(Self::TIMEOUT_LONG_DURATION);
		} else {
			self.timeout.reset(Self::TIMEOUT_SHORT_DURATION);
		}
	}
	async fn resend_buffer(&mut self) -> bool {
		let msgs = self.buffer.msgs.iter().cloned();
		for msg in msgs {
			let ok = self.presence.send_bytes(msg).await;
			if !ok { return false }
		}
		true
	}
}
impl HostBuffer {
	
	const CAPACITY: usize = 32;
	
	fn new() -> Self {
		Self {
			msgs: VecDeque::new(),
			msg_idx: 1, // must start 1 higher than ack_idx
			ack_idx: 0,
		}
	}
	fn is_full(&self) -> bool {
		self.msgs.len() >= Self::CAPACITY
	}
	fn is_empty(&self) -> bool {
		self.msgs.is_empty()
	}
	fn handle_send(&mut self, msg: &impl Serialize) -> Result<Utf8Bytes, ()> {
		
		if self.is_full() {
			return Err(());
		}
		
		let seq = self.msg_idx;
		let msg = TaggedMsg { seq, msg };
		let msg = serialize_bytes(&msg);
		let Ok(msg) = msg else {
			return Err(());
		};
		
		self.msg_idx += 1;
		self.msgs.push_back(msg.clone());
		Ok(msg)
	}
	fn handle_acknowledge(&mut self, idx: usize) -> Result<(), ()> {
		if idx <= self.ack_idx {
			tracing::error!("ack error");
			return Err(());
		}
		if idx >= self.msg_idx {
			tracing::error!("ack error");
			return Err(());
		}
		
		let diff = idx - self.ack_idx;
		self.ack_idx = idx;
		self.msgs.drain(0..diff);
		Ok(())
	}
}


pub struct Players(Slab<Box<Player>>);
impl Deref for Players {
	type Target = Slab<Box<Player>>;
	fn deref(&self) -> &Slab<Box<Player>> { &self.0 }
}
impl DerefMut for Players {
	fn deref_mut(&mut self) -> &mut Slab<Box<Player>> { &mut self.0 }
}
impl Players {
	
	pub fn ids<'a>(&'a self) -> impl Iterator<Item=PlayerId> + 'a {
		self.iter().map(|(id, _)| id as PlayerId)
	}
	pub fn id_from_name(&self, name: &str) -> Option<PlayerId> {
		self.iter().find_map(|(id, presence)| {
			if presence.name == name {
				Some(id as u8)
			} else {
				None
			}
		})
	}
	
	/*async fn for_each<'a, I, F>(&mut self, players: I, f: F)
	where
		I: Iterator<Item=(usize, &'a mut Box<Player>)>,
		F: FnOnce(&(usize, &mut Box<Player>)) -> bool
	{
		let (_, results) = TokioScope::scope_and_block(|scope| {
			for (_, player) in players {
				scope.spawn(player.send_raw(msg.clone()));
			}
		});
		
		results
			.iter()
			.all(|result| matches!(result, Ok(true)))
	}*/
	async fn send_players<'a, I>(players: I, msg: &impl Serialize) -> bool
	where I: Iterator<Item=(usize, &'a mut Box<Player>)> {
		let Ok(msg) = serialize(msg) else { return false };
		let msg = Message::Text(msg.into());
		Self::send_players_raw(players, msg).await
	}
	async fn send_players_raw<'a, I>(players: I, msg: Message) -> bool
	where I: Iterator<Item=(usize, &'a mut Box<Player>)> {
		let (_, results) = TokioScope::scope_and_block(|scope| {
			for (_, player) in players {
				scope.spawn(player.send_raw(msg.clone()));
			}
		});
		
		results
			.iter()
			.all(|result| matches!(result, Ok(true)))
	}
	/*async fn send_mapped<'a, I>(players: I, msg_decider: M) -> bool
	where I: Iterator<Item=(usize, &'a mut Box<Player>)>, M: Fn() {
		
	}*/
	/*async fn for_each(players: I) -> bool
	where I: Iterator<Item=(usize, &'a mut Box<Player>)> {
		let (_, results) = TokioScope::scope_and_block(|scope| {
			for (_, player) in players {
				scope.spawn(player.send_raw(msg.clone()));
			}
		});
	}*/
	
	pub async fn send(&mut self, player_id: PlayerId, msg: &impl Serialize) -> bool {
		if let Some(player) = self.get_mut(player_id as usize) {
			player.send(msg).await
		} else {
			tracing::error!("attempted to send to nonexistent player");
			false
		}
	}
	pub async fn send_all(&mut self, msg: &impl Serialize) -> bool {
		Self::send_players(self.iter_mut(), msg).await
	}
	pub async fn send_all_except<P>(&mut self, predicate: P, msg: &impl Serialize) -> bool
	where P: FnMut(&(usize, &mut Box<Player>)) -> bool {
		Self::send_players(self.iter_mut().filter(predicate), msg).await
	}
	pub async fn send_all_except_one(&mut self, except_id: PlayerId, msg: &impl Serialize) -> bool {
		self.send_all_except(|&(id, _)| id as PlayerId != except_id, msg).await
	}
}




pub struct ClientIndex {
	sender: Sender,
	receiver: Receiver,
	pub host: Host,
	pub players: Players
}
//#[allow(dead_code)]
impl ClientIndex {
	
	
	pub async fn new(host_socket: WebSocket, room_token: RoomToken) -> Self {
		
		const EVENT_QUEUE_SIZE: usize = 2;
		let (sender, receiver) = mpsc::channel(EVENT_QUEUE_SIZE);
		
		let players = Players(Slab::with_capacity(MAX_PLAYER_COUNT));
		let mut host = {
			let presence = Presence::create(sender.clone(), host_socket, ClientId::Host);
			Host::new(presence)
		};
		
		host.send(&HostMsgOut::Accepted {
			join_code: room_token,
			token: host.token
		}).await;
		
		Self {
			sender,
			receiver,
			host,
			players
		}
	}
	
	pub async fn reject_socket(mut socket: WebSocket, close_frame: cf::Frame) {
		let msg = Message::Close(Some(close_frame));
		let _ = socket.send(msg).await;
	}
	
	pub async fn reject_invalid_join(socket: WebSocket) {
		Self::reject_socket(socket, cf::INVALID_JOIN).await;
	}
	pub async fn reject_invalid_rejoin(socket: WebSocket, manual: bool) {
		
		let frame = if manual {
			cf::INVALID_MANUAL_REJOIN
		} else {
			cf::INVALID_AUTO_REJOIN
		};
		
		Self::reject_socket(socket, frame).await;
	}
	pub async fn reject_invalid_host_reconnect(socket: WebSocket) {
		Self::reject_socket(socket, cf::INVALID_HOST_RECONNECT).await;
	}
	/*fn create_presence(&self, socket: WebSocket, client_id: ClientId) -> Presence {
		Presence::create(self.sender.clone(), socket, client_id)
	}*/
	
	pub fn is_full(&self) -> bool {
		self.players.len() == self.players.capacity()
	}
	pub fn player_count(&self) -> usize {
		self.players.len()
	}
	
	pub fn has_player(&self, player_id: PlayerId) -> bool {
		self.players.contains(player_id as usize)
	}
	/*pub fn has_connected_player(&self, player_id: PlayerId) -> bool {
		let player = self.players.get(player_id as usize);
		let Some(player) = player else { return false };
		player.is_connected()
	}*/
	pub fn player<'a>(&'a self, id: PlayerId) -> Option<&'a Player> {
		self.players.get(id as usize).map(|player| player.as_ref())
	}
	/*pub fn player_mut<'a>(&'a mut self, id: PlayerId) -> Option<&'a mut Player> {
		self.players.get_mut(id as usize).map(|player| player.as_mut())
	}*/
	
	pub async fn recv(&mut self) -> Option<ClientEvent> {
		
		loop {
			tokio::select! {
				_ = &mut *self.host.timeout => {
					tracing::debug!("host connection timed out");
					return Some(ClientEvent::Close);
				},
				event = self.receiver.recv() => {
					/* Handle Ack from host */
					if let Some(ClientEvent::Message(ClientId::Host, ref msg)) = event {
						if let Ok(msg) = deserialize::<HostMsgIn>(&msg) {
							match msg {
								HostMsgIn::Close => {
									return Some(ClientEvent::Close);
								},
								HostMsgIn::Ack(idx) => {
									self.host.acknowledge(idx);
									continue; // Ack messages are NOT passed on - wait for the next event
								}
							}
						}
					}
					
					return event;
				}
			}
			
			/*/* If a player disconnects, let the host know */
			if let (ClientId::Player(player_id), ClientEvent::Disconnect) = event {
				let msg = &HostMsgOut::PlayerDisconnected { player_id };
				self.host.send(msg).await;
			}*/
		}
	}
	
	pub async fn reconnect_host(&mut self, socket: WebSocket, token: ClientToken) -> Result<(), ()> {
		
		let host = &mut self.host;
		
		if token != host.token {
			tracing::debug!("host reconnect failed (invalid token)");
			Self::reject_invalid_host_reconnect(socket).await;
			return Err(())
		}
		
		host.close(cf::CONNECTED_ELSEWHERE).await; // this should never really happen
		host.presence = Presence::create(self.sender.clone(), socket, ClientId::Host);
		host.resend_buffer().await;
		Ok(())
	}
	pub async fn connect_player(&mut self, socket: WebSocket, name: String, icon: PlayerIcon) -> Result<PlayerId, ()> {
		
		if self.is_full() {
			Self::reject_socket(socket, cf::LOBBY_FULL).await;
			return Err(());
		}
		
		if name.len() < MIN_PLAYER_NAME_LEN {
			Self::reject_socket(socket, cf::NAME_TOO_LONG).await;
			return Err(());
		}
		if name.len() > MAX_PLAYER_NAME_LEN {
			Self::reject_socket(socket, cf::NAME_TOO_SHORT).await;
			return Err(());
		}
		
		let name_taken = self.players
			.iter()
			.any(|(_, player)| name == player.name);
		if name_taken {
			Self::reject_socket(socket, cf::NAME_TAKEN).await;
			return Err(());
		}
		
		let player_id = self.players.vacant_key() as PlayerId;
		let client_id = ClientId::Player(player_id);
		let presence = Presence::create(self.sender.clone(), socket, client_id);
	
		let token = ClientToken::generate();
		let player = Player { presence, token, name: name.clone() };
		self.players.insert(Box::new(player));
		
		self.send_player_and_host(
			player_id,
			&PlayerMsgOut::Accepted { player_id, token: token.as_str() },
			&HostMsgOut::PlayerJoined { player_id, name, icon }
		).await;
		
		Ok(player_id)
	}
	pub async fn reconnect_player(&mut self, socket: WebSocket, player_id: PlayerId, token: ClientToken, manual: bool) -> Result<(), ()> {
		
		let Some(player) = self.players.get_mut(player_id as usize) else {
			tracing::debug!("game rejoin failed (no such player)");
			Self::reject_invalid_rejoin(socket, manual).await;
			return Err(());
		};
		
		if token != player.token {
			tracing::debug!("game rejoin failed (invalid token)");
			Self::reject_invalid_rejoin(socket, manual).await;
			return Err(());
		}
		
		if player.is_open() {
			if manual {
				/* Manual rejoins override the current connection */
				player.presence.close(cf::CONNECTED_ELSEWHERE).await;
			} else {
				/* Automatic rejoins do not override the current connection */
				tracing::debug!("game rejoin failed (already connected on this device)");
				Self::reject_socket(socket, cf::ALREADY_CONNECTED).await;
				return Err(());
			}
		} else {
			//let msg = &HostMsgOut::PlayerReconnected { player_id };
			//self.host.send(msg).await;
		}
		
		// replace presence with new, connected one
		// can't use self.create_presence due to multi-borrowing issue
		let client_id = ClientId::Player(player_id);
		let presence = Presence::create(self.sender.clone(), socket, client_id);
		player.presence = presence;
		Ok(())
	}
	async fn drop_player(&mut self, player_id: PlayerId, close_frame: cf::Frame) -> bool {
		let Some(mut player) = self.players.try_remove(player_id as usize) else {
			tracing::debug!("attempted to remove player that is not present");
			return false;
		};
		
		player.close(close_frame).await;
		self.host.send(&HostMsgOut::PlayerLeft { player_id }).await;
		true
	}
	pub async fn remove_player(&mut self, player_id: PlayerId) {
		self.drop_player(player_id, cf::PLAYER_LEFT).await;
	}
	pub async fn kick_player(&mut self, player_id: PlayerId) {
		self.drop_player(player_id, cf::PLAYER_KICKED).await;
	}
	/*pub async fn remove_disconnected_players(&mut self, close_frame: cf::Frame) -> Box<[PlayerId]> {
		//self.players.retain(|_, player| player.presence.is_connected());
		
		let removed_ids =	self.players
			.iter()
			.filter(|(_, player)| !player.is_connected())
			.map(|(id, _)| id as PlayerId)
			.collect::<Box<_>>();
		
		for &player_id in removed_ids.iter() {
			let player_id = player_id as usize;
			self.players.remove(player_id);
		}
		for &player_id in removed_ids.iter() {
			self.host.send(&HostMsgOut::PlayerLeft { player_id }).await;
		}
		removed_ids
	}*/
	pub async fn close(&mut self) {
		self.host.close(cf::ROOM_CLOSED).await;
		for (_, player) in self.players.iter_mut() {
			player.close(cf::ROOM_CLOSED).await;
		}
	}
	
	pub async fn send_player_and_host(&mut self, player_id: PlayerId, player_msg: &impl Serialize, host_msg: &impl Serialize) -> bool {
		let results = tokio::join!(
			self.players.send(player_id, player_msg),
			self.host.send(host_msg)
		);
		results.0 && results.1
	}
	pub async fn send_all(&mut self, player_msg: &impl Serialize, host_msg: &impl Serialize) -> bool {
		let results = tokio::join!(
			self.players.send_all(player_msg),
			self.host.send(host_msg)
		);
		results.0 && results.1
	}
	pub async fn send_all_except<P>(&mut self, predicate: P, player_msg: &impl Serialize, host_msg: &impl Serialize) -> bool
	where P: FnMut(&(usize, &mut Box<Player>)) -> bool {
		let results = tokio::join!(
			self.players.send_all_except(predicate, player_msg),
			self.host.send(host_msg)
		);
		results.0 && results.1
	}
	pub async fn send_all_except_one(&mut self, except_id: PlayerId, player_msg: &impl Serialize, host_msg: &impl Serialize) -> bool {
		let results = tokio::join!(
			self.players.send_all_except_one(except_id, player_msg),
			self.host.send(host_msg)
		);
		results.0 && results.1
	}
	
}

pub fn serialize(value: &impl Serialize) -> Result<String, ()> {
	match serde_json::to_string(value) {
		Ok(string) => Ok(string),
		Err(err) =>	{
			tracing::error!("serialization: {err}");
			Err(())
		}
	}
}
pub fn serialize_bytes(value: &impl Serialize) -> Result<Utf8Bytes, ()> {
	serialize(value).map(|s| s.into())
}
pub fn deserialize<'a, T: Deserialize<'a>>(str: &'a str) -> Result<T, ()> {
	match serde_json::from_str::<T>(str) {
		Ok(value) => Ok(value),
		Err(_err) => Err(())
	}
}
async fn next_bytes<'a>(receiver: &'a mut WebSocketReceiver) -> Option<Utf8Bytes> {
	while let Some(msg) = receiver.next().await {
		match msg {
			Ok(Message::Text(content)) => return Some(content),
			Ok(Message::Close(_)) => {
				tracing::debug!("websocket closed");
				// DON'T return None here - we need to keep polling to finish the closing handshake properly
			},
			Ok(Message::Pong(_) | Message::Ping(_)) => {}, // Ignore these, tungstenite handles them
			Ok(Message::Binary(_)) => {
				tracing::debug!("binary websocket message received (expected text)");
			},
			Err(err) => {
				tracing::debug!("websocket receive: {err}");
				return None;
			},
		}
	}
	None
}
async fn send_raw(sender: &mut WebSocketSender, msg: Message) -> Result<(), ()> {
	match sender.send(msg).await {
		Ok(()) => Ok(()),
		Err(err) => {
			tracing::warn!("websocket send error: {err}");
			Err(())
		}
	}
}

#[test]
fn serialize_tagged_msg() {
	//println!("{")
	let inner = HostMsgOut::Accepted {
		join_code: RoomToken::generate(),
		token: ClientToken::generate()
	};
	let outer = TaggedMsg::<HostMsgOut> {
		seq: 100,
		msg: &inner
	};
	
	println!("{:?}", serialize(&outer));
}
