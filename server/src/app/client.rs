
use crate::types::*;
use super::cf;

use slab::Slab;
use std::ops::{Deref, DerefMut};
use tokio::sync::mpsc;
use tokio::task::JoinHandle;
use async_scoped::TokioScope;

pub use serde::{Serialize, Deserialize};

pub enum ClientId {
	Host,
	Player(PlayerId)
}

/*trait MsgDest {
	//async fn send_raw(&mut self, msg: Message) -> bool;
	async fn send_raw(&mut self, msg: Message) -> bool;
	async fn send(&mut self, msg: &impl Serialize) -> bool {
		let Ok(msg) = serialize(msg) else { return false };
		self.send_raw(Message::Text(msg)).await
	}
	async fn close(&mut self, close_frame: cf::Frame) -> bool {
		self.send_raw(Message::Close(Some(close_frame))).await
	}
}*/
/*impl MsgDest for (usize, &mut Presence) {
	async fn send_raw(&mut self, msg: Message) -> bool {
		self.1.send_raw(msg).await
	}
}
impl<'a> MsgDest for (usize, &'a mut Box<Player>) {
	async fn send_raw(&mut self, msg: Message) -> bool {
		self.1.send_raw(msg).await
	}
}*/

/*
this code has been lost to the Obscure Rust Compiler Bug abyss
pub trait MsgDestIterator : Sized {
	async fn send_raw(self, msg: Message) -> bool;
	async fn send(self, msg: &impl Serialize) -> bool {
		let Ok(msg) = serialize(msg) else { return false };
		self.send_raw(Message::Text(msg)).await
	}
	async fn close(self, close_frame: cf::Frame) -> bool {
		self.send_raw(Message::Close(Some(close_frame))).await
	}
}
impl<T, I> MsgDestIterator for I
where
	T: MsgDest,
	I: Iterator<Item=T>
{
	async fn send_raw(self, msg: Message) -> bool {
		let mut ok = true;
		for mut dest in self {
			ok = ok && dest.send_raw(msg.clone()).await;
		}
		ok
	}
}*/



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
		self.send_raw(Message::Text(msg)).await
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
		let msg = Message::Text(msg);
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
	Message(String)
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
			let (tx, mut rx) = host_socket.split();
			let sender = sender.clone();
			let handle = tokio::spawn(async move {
				while let Some(content) = next_string(&mut rx).await {
					
					if content.is_empty() {
						/* This is an empty keep-alive message, ignore */
						continue;
					}
					
					let event = (ClientId::Host, ClientEvent::Message(content));
					let result = sender.send(event).await;
					if result.is_err() {
						break;
					}
				}
				//tracing::debug!("host receiver closing");
				let _ = sender.send((ClientId::Host, ClientEvent::Disconnect)).await;
			});
			let presence = Presence::new(tx, handle);
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
	
	async fn reject_socket(mut socket: WebSocket, close_frame: cf::Frame) {
		let msg = Message::Close(Some(close_frame));
		let _ = socket.send(msg).await;
	}
	pub async fn reject_invalid_join(socket: WebSocket) {
		Self::reject_socket(socket, cf::INVALID_JOIN).await;
	}
	pub async fn reject_invalid_rejoin(socket: WebSocket) {
		Self::reject_socket(socket, cf::INVALID_REJOIN).await;
	}
	
	fn generate_token() -> PlayerToken {
		rand::thread_rng().gen::<PlayerToken>()
	}
	fn new_player_presence(sender: Sender, socket: WebSocket, player_id: PlayerId) -> Presence {
		let (tx, mut rx) = socket.split();
		let handle = tokio::spawn(async move {
			while let Some(content) = next_string(&mut rx).await {
				if content.is_empty() {
					/* This is an empty keep-alive msg, ignore */
					continue;
				}
				
				let id = ClientId::Player(player_id);
				let event = ClientEvent::Message(content);
				let result = sender.send((id, event)).await;
				if result.is_err() {
					break;
				}
			}
			let id = ClientId::Player(player_id);
			let event = (id, ClientEvent::Disconnect);
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
	
	pub fn player<'a>(&'a self, id: PlayerId) -> Option<&'a Player> {
		self.players.get(id as usize).map(|player| player.as_ref())
	}
	pub fn player_mut<'a>(&'a mut self, id: PlayerId) -> Option<&'a mut Player> {
		self.players.get_mut(id as usize).map(|player| player.as_mut())
	}
	
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
		
		let player_id = self.players.vacant_key() as PlayerId;
		let token = Self::generate_token();
		
		let presence = Self::new_player_presence(self.sender.clone(), socket, player_id);
		let player = Player { presence, token, name: name.clone() };
		self.players.insert(Box::new(player));
		
		self.send_player_and_host(
			player_id,
			&PlayerMsgOut::Accepted { player_id, token },
			&HostMsgOut::PlayerJoined { player_id, name, icon }
		).await;
		
		Ok(player_id)
	}
	pub async fn reconnect_player(&mut self, socket: WebSocket, player_id: PlayerId, player_token: PlayerToken) -> Result<(), ()> {
		
		let Some(player) = self.players.get_mut(player_id as usize) else {
			tracing::debug!("game rejoin failed (no such player)");
			Self::reject_socket(socket, cf::INVALID_REJOIN).await;
			return Err(());
		};
		
		if player_token != player.token {
			tracing::debug!("game rejoin failed (invalid token)");
			Self::reject_socket(socket, cf::INVALID_REJOIN).await;
			return Err(());
		}
		
		if player.is_connected() {
			tracing::debug!("game rejoin failed (already connected on this device)");
			Self::reject_socket(socket, cf::ALREADY_CONNECTED).await;
			return Err(());
		}
		
		// replace presence with new, connected one
		player.presence = Self::new_player_presence(self.sender.clone(), socket, player_id);
		
		let msg = &HostMsgOut::PlayerReconnected { player_id };
		self.host.send(msg).await;
		
		Ok(())
	}
	/*pub async fn disconnect_player(&mut self, player_id: PlayerId) -> bool {
		if let Some(player) = self.players.get_mut(player_id as usize) {
			if player.is_connected() {
				player.disconnect().await;
				return true;
			} else {
				tracing::debug!("attempted to disconnect player that is not connected");
			}
		}
		false
	}*/
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
		//self.host.close(close_frame).await;
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
async fn next_string(receiver: &mut WebSocketReceiver) -> Option<String> {
	while let Some(msg) = receiver.next().await {
		match msg {
			Ok(Message::Text(content)) => {
				return Some(content);
			},
			Ok(Message::Ping(_)) => {
				/* Ignore these, tungstenite handles them */
			},
			Ok(Message::Close(_)) => {
				//tracing::debug!("websocket connection closed");
				return None;
			},
			Ok(msg) => {
				tracing::warn!("invalid websocket msg: {msg:?}");
			},
			Err(err) => {
				tracing::error!("{err}");
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
			tracing::warn!("{err}");
			Err(())
		}
	}
}

