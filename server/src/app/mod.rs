





use std::sync::Arc;
use dashmap::DashMap;


//use std::net::SocketAddr;


use crate::globals::*;

mod strgen;

mod cf;
mod room;
mod client;

use client::*;

mod lobby;
mod drawblins;
mod dating;

#[derive(Clone)]
pub struct App {
	rooms: Arc<DashMap<RoomToken, room::Sender>>
}
impl App {
	
	pub fn new() -> Self {
		Self { rooms: Arc::new(DashMap::new()) }
	}
	
	fn generate_room_token(&self) -> Option<RoomToken> {
		
		const ATTEMPTS: usize = 5;
		
		for _ in 0..ATTEMPTS {
			//let id = RoomToken::generate();
			let token = RoomToken::generate();
			if !self.rooms.contains_key(&token) {
				return Some(token);
			}
		}
		
		tracing::error!("failed to generate a valid room id (somehow)");
		None
	}
	/*pub fn find_room(&self, room_code: &str) -> Option<RoomToken> {
		if let Some(room_id) = RoomToken::from_str(room_code) {
			//return self.rooms.get_mut(&room_id);
			if self.has_room(&room_id) {
				return Some(room_id);
			}
		}
		None
	}*/
	pub fn has_room(&self, room_id: &RoomToken) -> bool {
		self.rooms.contains_key(room_id)
	}
	
	async fn init_room(&self, id: RoomToken, host_socket: WebSocket) {
		let mut clients = ClientIndex::new(host_socket, id).await;
		
		loop {
			let (lobby, handle) = lobby::Lobby::new(&mut clients);
			self.rooms.insert(id, handle);
			let Ok(settings) = lobby.run().await else {
				break;
			};
			
			let result = match settings {
				lobby::Settings::Drawblins(settings) => {
					let (game, handle) = drawblins::Game::new(&mut clients, settings);
					self.rooms.insert(id, handle);
					game.run().await
				},
				lobby::Settings::Dating(settings) => {
					let (game, handle) = dating::Game::new(&mut clients, settings);
					self.rooms.insert(id, handle);
					game.run().await
				}
			};
			
			if let Err(()) = result {
				break;
			}
		}
		
		self.rooms.remove(&id);
		clients.close().await;
	}
	pub async fn accept_host_connect(&self, socket: WebSocket) {
		let Some(token) = self.generate_room_token() else { return };
		// may want to become debug, rather than info
		tracing::info!("[{}] Opening!", token.as_str());
		self.init_room(token, socket).await;
		tracing::info!("[{}] Closed", token.as_str());
	}
	pub async fn accept_host_reconnect(&self, socket: WebSocket, room: RoomToken, token: ClientToken) {
		let Some(handle) = self.rooms.get(&room) else {
			tracing::debug!("host reconnect failed (no such room)");
			ClientIndex::reject_invalid_host_reconnect(socket).await;
			return;
		};
		let _ = handle.send(room::Event::HostReconnect {
			socket,
			token
		}).await;
	}
	pub async fn accept_player_join(&self, socket: WebSocket, room: RoomToken, name: String, icon: PlayerIcon) {
		let Some(handle) = self.rooms.get(&room) else {
			ClientIndex::reject_invalid_join(socket).await;
			return;
		};
		let _ = handle.send(room::Event::PlayerJoin {
			socket,
			name,
			icon
		}).await;
	}
	pub async fn accept_player_reconnect(&self, socket: WebSocket, room: RoomToken, player_id: PlayerId, token: ClientToken, manual: bool) {
		let Some(handle) = self.rooms.get(&room) else {
			ClientIndex::reject_invalid_rejoin(socket, manual).await;
			return;
		};
		let _ = handle.send(room::Event::PlayerReconnect {
			socket,
			player_id,
			token,
			manual
		}).await;
	}
}


