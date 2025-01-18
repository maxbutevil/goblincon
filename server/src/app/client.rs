
use crate::types::*;

use slab::Slab;
use std::ops::{Deref, DerefMut};
use tokio::task::JoinHandle;
use async_scoped::TokioScope;

pub use serde::{Serialize, Deserialize};


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
		Err(_err) => {
			//tracing::error!("deserialization: {err}");
			Err(())
		}
	}
}

async fn next_string(receiver: &mut WebSocketReceiver) -> Option<String> {
	while let Some(message) = receiver.next().await {
		match message {
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
			Ok(message) => {
				tracing::warn!("invalid websocket message: {message:?}");
			},
			Err(err) => {
				tracing::error!("{err}");
				return None;
			},
		}
	}
	None
}
async fn send_raw(sender: &mut WebSocketSender, message: Message) -> Result<(), ()> {
	match sender.send(message).await {
		Ok(()) => Ok(()),
		Err(err) => {
			tracing::warn!("{err}");
			Err(())
		}
	}
}


pub struct Presence {
	sender: WebSocketSender,
	handle: JoinHandle<()>
}
impl Presence {
	pub fn new(sender: WebSocketSender, handle: JoinHandle<()>) -> Self {
		Self { sender, handle }
	}
	pub fn is_connected(&self) -> bool {
		!self.handle.is_finished()
	}
	pub async fn disconnect(&mut self) {
		if self.is_connected() {
			//self.handle.abort();
			let _ = self.sender.close().await;
		}
	}
	pub async fn send_raw(&mut self, message: Message) -> bool {
		// evil short-circuiting techniques
		self.is_connected() && send_raw(&mut self.sender, message).await.is_ok()
	}
	pub async fn send(&mut self, message: &impl Serialize) -> bool {
		let Ok(message) = serialize(message) else { return false };
		self.send_raw(Message::Text(message)).await
	}
}



pub struct Host {
	pub presence: Presence,
}
impl Host {
	/*async fn send(&mut self, message: &impl Serialize) -> bool {
		self.presence.send(message).await
		//send(&mut self.presence.sender, message).await
	}*/
}
impl Deref for Host {
	type Target = Presence;
	fn deref(&self) -> &Presence { &self.presence }
}
impl DerefMut for Host {
	fn deref_mut(&mut self) -> &mut Presence { &mut self.presence }
}

pub struct Player {
	presence: Presence,
	pub token: PlayerToken,
	//addr: SocketAddr,
	pub name: String,
	//icon: PlayerIcon,
}
impl Player {
	/*fn new(presence: Presence, token: PlayerToken, name: String) -> Self {
		Self { presence, token, name }
	}
	async fn send_raw(&mut self, message: Message) -> bool {
		self.presence.send_raw(message).await
	}
	async fn send(&mut self, message: &impl Serialize) -> bool {
		self.presence.send(message).await
	}*/
}
impl Deref for Player {
	type Target = Presence;
	fn deref(&self) -> &Presence { &self.presence }
}
impl DerefMut for Player {
	fn deref_mut(&mut self) -> &mut Presence { &mut self.presence }
}


use tokio::sync::mpsc;
type Sender = mpsc::Sender<ClientEvent>;
type Receiver = mpsc::Receiver<ClientEvent>;

pub enum ClientEvent {
	Disconnect(ClientId),
	Message(ClientId, String)
}
pub struct ClientIndex {
	sender: Sender,
	pub receiver: Receiver,
	pub host: Host,
	pub players: Slab<Box<Player>>
}

#[allow(dead_code)]
impl ClientIndex {
	
	pub fn new(host_socket: WebSocket, capacity: PlayerId) -> Self {
		let (sender, receiver) = mpsc::channel(EVENT_QUEUE_SIZE);
		let host = {
			let (tx, mut rx) = host_socket.split();
			let sender = sender.clone();
			let handle = tokio::spawn(async move {
				while let Some(content) = next_string(&mut rx).await {
					
					if content.is_empty() {
						/* This is an empty keep-alive message, ignore */
						continue;
					}
					
					let event = ClientEvent::Message(ClientId::Host, content);
					let result = sender.send(event).await;
					if result.is_err() {
						break;
					}
				}
				//tracing::debug!("host receiver closing");
				let _ = sender.send(ClientEvent::Disconnect(ClientId::Host)).await;
			});
			let presence = Presence::new(tx, handle);
			Host { presence }
		};
		
		Self {
			sender,
			receiver,
			host,
			players: Slab::with_capacity(capacity as usize)
		}
	}
	
	pub async fn reject_socket(mut socket: WebSocket, message: &impl Serialize) {
		let Ok(message) = serialize(message) else { return };
		let _ = socket.send(Message::Text(message)).await;
	}
	pub async fn reject_player(socket: WebSocket, error_message: &str) {
		let msg = GlobalPlayerMsgOut::Error(error_message);
		Self::reject_socket(socket, &msg).await
	}
	pub async fn terminate_player(socket: WebSocket) {
		let msg = GlobalPlayerMsgOut::Terminated;
		Self::reject_socket(socket, &msg).await
	}
	fn generate_token() -> PlayerToken {
		use rand::Rng;
		rand::thread_rng().gen::<PlayerToken>()
	}
	fn new_player_presence(sender: Sender, socket: WebSocket, player_id: PlayerId) -> Presence {
		let (tx, mut rx) = socket.split();
		let handle = tokio::spawn(async move {
			while let Some(content) = next_string(&mut rx).await {
				
				if content.is_empty() {
					/* This is an empty keep-alive message, ignore */
					continue;
				}
				
				let id = ClientId::Player(player_id);
				let event = ClientEvent::Message(id, content);
				let result = sender.send(event).await;
				if result.is_err() {
					break;
				}
			}
			let id = ClientId::Player(player_id);
			let event = ClientEvent::Disconnect(id);
			let _ = sender.send(event).await;
		});
		Presence::new(tx, handle)
	}
	
	pub fn player_count(&self) -> usize {
		self.players.len()
	}
	pub fn is_full(&self) -> bool {
		self.players.len() == self.players.capacity()
	}
	pub fn player_id_from_name(&self, name: &str) -> Option<PlayerId> {
		self.players.iter().find_map(|(id, presence)| {
			if presence.name == name {
				Some(id as u8)
			} else {
				None
			}
		})
	}
	
	pub async fn recv(&mut self) -> Option<ClientEvent> {
		self.receiver.recv().await
	}
	
	pub async fn connect_player(&mut self, socket: WebSocket, name: String) -> Result<(PlayerId, PlayerToken), ()> {
		
		if self.is_full() {
			Self::reject_player(socket, "Lobby is full").await;
			return Err(());
		}
		
		let name_taken = self.players.iter().any(|(_, player)| name == player.name);
		if name_taken {
			Self::reject_player(socket, "Name is taken").await;
			return Err(());
		}
		
		let player_id = self.players.vacant_key() as PlayerId;
		let token = Self::generate_token();
		
		let presence = Self::new_player_presence(self.sender.clone(), socket, player_id);
		let player = Player { presence, token, name };
		self.players.insert(Box::new(player));
		Ok((player_id, token))
	}
	pub async fn reconnect_player(&mut self, socket: WebSocket, player_id: PlayerId, player_token: PlayerToken) -> Result<(), ()> {
		
		let Some(player) = self.players.get_mut(player_id as usize) else {
			tracing::debug!("game rejoin failed (no such player)");
			Self::terminate_player(socket).await;
			return Err(());
		};
		
		if player_token != player.token {
			tracing::debug!("game rejoin failed (invalid token)");
			Self::terminate_player(socket).await;
			return Err(());
		}
		
		let presence = &mut player.presence;
		if presence.is_connected() {
			tracing::debug!("game rejoin failed (already connected elsewhere)");
			Self::reject_player(socket, "Already connected elsewhere").await;
			return Err(());
		}
		
		// replace 
		*presence = Self::new_player_presence(self.sender.clone(), socket, player_id);
		Ok(())
	}
	pub async fn disconnect_player(&mut self, player_id: PlayerId) -> bool {
		if let Some(player) = self.players.get_mut(player_id as usize) {
			if player.is_connected() {
				player.disconnect().await;
				return true;
			} else {
				tracing::debug!("attempted to disconnect player that is not connected");
			}
		}
		false
	}
	pub async fn remove_player(&mut self, player_id: PlayerId) -> bool {
		if self.players.contains(player_id as usize) {
			let mut player = self.players.remove(player_id as usize);
			player.disconnect().await;
			return true;
		} else {
			tracing::debug!("attempted to remove player that is not present");
			return false;
		}
	}
	pub fn remove_disconnected_players(&mut self) -> Vec<PlayerId> {
		//self.players.retain(|_, player| player.presence.is_connected());
		let mut removed_ids = Vec::new();
		for (id, player) in self.players.iter() {
			if !player.is_connected() {
				removed_ids.push(id as PlayerId);
			}
		}
		for &id in removed_ids.iter() {
			self.players.remove(id as usize);
		}
		removed_ids
	}
	pub async fn disconnect_all(&mut self) {
		self.host.disconnect().await;
		for (_, player) in self.players.iter_mut() {
			player.disconnect().await;
		}
	}
	pub async fn send_host(&mut self, message: &impl Serialize) -> bool {
		self.host.send(message).await
	}
	pub async fn send_player(&mut self, id: PlayerId, message: &impl Serialize) -> bool {
		if let Some(player) = self.players.get_mut(id as usize) {
			//if player.presence.is_connected() {
				player.send(message).await
			//}
		} else {
			tracing::error!("attempted to send to nonexistent player");
			false
		}
	}
	pub async fn send_all(&mut self, host_message: &impl Serialize, player_message: &impl Serialize) -> bool {
		let results = tokio::join!(
			//self.send_host(host_message),
			self.host.send(host_message),
			Self::send_players(self.players.iter_mut(), player_message)
		);
		results.0 && results.1
		//results.0.and(results.1).is_ok()
	}
	pub async fn send_all_except(&mut self, except_id: PlayerId, host_message: &impl Serialize, player_message: &impl Serialize) -> bool {
		let results = tokio::join!(
			self.host.send(host_message),
			Self::send_players_except(self.players.iter_mut(), except_id, player_message)
		);
		results.0
		//results.0.and(results.1)
	}
	pub async fn send_all_players(&mut self, message: &impl Serialize) -> bool {
		Self::send_players(self.players.iter_mut(), message).await
	}
	pub async fn send_all_players_except(&mut self, except_id: PlayerId, message: &impl Serialize) -> bool {
		Self::send_players_except(self.players.iter_mut(), except_id, message).await
	}
	async fn send_players<'a, I>(players: I, message: &impl Serialize) -> bool
	where I: Iterator<Item=(usize, &'a mut Box<Player>)> {
		let Ok(message) = serialize(message) else { return false };
		let message = Message::Text(message);
		let (_, results) = TokioScope::scope_and_block(|scope| {
			for (_, player) in players {
				scope.spawn(player.send_raw(message.clone()));
			}
		});
		
		for result in results {
			let Ok(true) = result else { return false };
		}
		
		true
	}
	async fn send_players_except<'a, I>(players: I, except_id: PlayerId, message: &impl Serialize) -> bool
	where I: Iterator<Item=(usize, &'a mut Box<Player>)> {
		let iter = players.enumerate()
			.filter(|(id, _)| *id as PlayerId != except_id)
			.map(|(_, player)| player);
		Self::send_players(iter, message).await
	}
}

