
use crate::globals::*;
use super::cf;

use slab::Slab;
use std::ops::{Deref, DerefMut};
use tokio::sync::mpsc;
use tokio::task::JoinHandle;
use async_scoped::TokioScope;
//use axum::extract::ws::Utf8Bytes;

pub use serde::{Serialize, Deserialize};

#[derive(Clone, Copy)]
pub enum ClientId {
	Host,
	Player(PlayerId)
}

pub struct Presence {
	sender: WebSocketSender,
	handle: JoinHandle<()>
}
pub struct Host {
	pub presence: Presence,
}
pub struct Player {
	presence: Presence,
	pub token: PlayerToken,
	pub name: String,
}

impl Presence {
	pub fn new(sender: WebSocketSender, handle: JoinHandle<()>) -> Self {
		Self { sender, handle }
	}
	pub fn is_connected(&self) -> bool {
		!self.handle.is_finished()
	}
	pub async fn send_raw(&mut self, msg: Message) -> bool {
		// evil short-circuiting techniques
		self.is_connected() && send_raw(&mut self.sender, msg).await.is_ok()
	}
	pub async fn send(&mut self, msg: &impl Serialize) -> bool {
		let Ok(msg) = serialize(msg) else { return false };
		self.send_raw(Message::Text(msg.into())).await
	}
	pub async fn close(&mut self, close_frame: cf::Frame) -> bool {
		self.send_raw(Message::Close(Some(close_frame))).await
	}
}

impl Deref for Host {
	type Target = Presence;
	fn deref(&self) -> &Presence { &self.presence }
}
impl DerefMut for Host {
	fn deref_mut(&mut self) -> &mut Presence { &mut self.presence }
}
impl Deref for Player {
	type Target = Presence;
	fn deref(&self) -> &Presence { &self.presence }
}
impl DerefMut for Player {
	fn deref_mut(&mut self) -> &mut Presence { &mut self.presence }
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

#[derive(Serialize)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
enum HostMsgOut<'a> {
	Accepted { join_code: &'a str },
	PlayerDisconnected { player_id: PlayerId },
	PlayerReconnected { player_id: PlayerId },
	PlayerJoined { player_id: PlayerId, name: String, icon: PlayerIcon },
	PlayerLeft { player_id: PlayerId },
}

#[derive(Serialize)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
enum PlayerMsgOut {
	Accepted { player_id: PlayerId, token: PlayerToken }
}

type Sender = mpsc::Sender<(ClientId, ClientEvent)>;
type Receiver = mpsc::Receiver<(ClientId, ClientEvent)>;

pub enum ClientEvent {
	Disconnect,
	Message(Utf8Bytes)
}
pub struct ClientIndex {
	sender: Sender,
	receiver: Receiver,
	pub host: Host,
	pub players: Players
}
//#[allow(dead_code)]
impl ClientIndex {
	
	
	pub async fn new(host_socket: WebSocket, id: RoomId) -> Self {
		
		const EVENT_QUEUE_SIZE: usize = 2;
		let (sender, receiver) = mpsc::channel(EVENT_QUEUE_SIZE);
		
		let players = Players(Slab::with_capacity(MAX_PLAYER_COUNT));
		let mut host = {
			let presence = Self::new_presence(sender.clone(), host_socket, ClientId::Host);
			Host { presence }
		};
		
		host.send(&HostMsgOut::Accepted {
			join_code: id.as_str()
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
	
	fn generate_token() -> PlayerToken {
		rand::rng().random::<PlayerToken>()
	}
	fn new_presence(sender: Sender, socket: WebSocket, client_id: ClientId) -> Presence {
		let (tx, mut rx) = socket.split();
		let handle = tokio::spawn(async move {
			while let Some(content) = next_bytes(&mut rx).await {
				if content.is_empty() {
					/* This is an empty keep-alive msg, ignore */
					continue;
				}
				
				let event = (client_id, ClientEvent::Message(content));
				let result = sender.send(event).await;
				if result.is_err() {
					break;
				}
			}
			let event = (client_id, ClientEvent::Disconnect);
			let _ = sender.send(event).await;
		});
		Presence::new(tx, handle)
	}
	
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
	
	pub async fn recv(&mut self) -> Option<(ClientId, ClientEvent)> {
		let event = self.receiver.recv().await;
		if let Some((ClientId::Player(player_id), ClientEvent::Disconnect)) = event {
			// if a player disconnects, tell the host
			let msg = &HostMsgOut::PlayerDisconnected { player_id };
			self.host.send(msg).await;
		}
		event
	}
	
	pub async fn connect_player(&mut self, socket: WebSocket, name: String, icon: PlayerIcon) -> Result<PlayerId, ()> {
		
		if self.is_full() {
			Self::reject_socket(socket, cf::LOBBY_FULL).await;
			return Err(());
		}
		
		let name_taken = self.players.iter().any(|(_, player)| name == player.name);
		if name_taken {
			Self::reject_socket(socket, cf::NAME_TAKEN).await;
			return Err(());
		}
		
		let token = Self::generate_token();
		let player_id = self.players.vacant_key() as PlayerId;
		let client_id = ClientId::Player(player_id);
		let presence = Self::new_presence(self.sender.clone(), socket, client_id);
		let player = Player { presence, token, name: name.clone() };
		self.players.insert(Box::new(player));
		
		self.send_player_and_host(
			player_id,
			&PlayerMsgOut::Accepted { player_id, token },
			&HostMsgOut::PlayerJoined { player_id, name, icon }
		).await;
		
		Ok(player_id)
	}
	pub async fn reconnect_player(&mut self, socket: WebSocket, player_id: PlayerId, player_token: PlayerToken, manual: bool) -> Result<(), ()> {
		
		let Some(player) = self.players.get_mut(player_id as usize) else {
			tracing::debug!("game rejoin failed (no such player)");
			Self::reject_invalid_rejoin(socket, manual).await;
			return Err(());
		};
		
		if player_token != player.token {
			tracing::debug!("game rejoin failed (invalid token)");
			Self::reject_invalid_rejoin(socket, manual).await;
			return Err(());
		}
		
		if player.is_connected() {
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
			let msg = &HostMsgOut::PlayerReconnected { player_id };
			self.host.send(msg).await;
		}
		
		// replace presence with new, connected one
		let client_id = ClientId::Player(player_id);
		player.presence = Self::new_presence(self.sender.clone(), socket, client_id);
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
			Ok(Message::Close(_)) => return None,
			Ok(Message::Pong(_) | Message::Ping(_)) => {}, // Ignore these, tungstenite handles them
			Ok(Message::Binary(_)) => {
				tracing::warn!("binary websocket message received (expected text)");
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

