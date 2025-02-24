





use std::sync::Arc;
use dashmap::DashMap;


//use std::net::SocketAddr;


use crate::types::*;

mod strgen;
mod timeout;

mod cf;
mod room;
mod client;

use timeout::*;
use client::*;

mod lobby;
mod drawblins;
mod dating;

#[derive(Clone)]
pub struct App {
	rooms: Arc<DashMap<RoomId, room::Sender>>
}
impl App {
	
	pub fn new() -> Self {
		Self { rooms: Arc::new(DashMap::new()) }
	}
	
	fn generate_room_id(&self) -> Option<RoomId> {
		
		const ATTEMPTS: usize = 5;
		
		for _ in 0..ATTEMPTS {
			let id = RoomId::generate();
			if !self.rooms.contains_key(&id) {
				return Some(id);
			}
		}
		
		tracing::error!("failed to generate a valid room id (somehow)");
		None
	}
	pub fn find_room(&self, room_code: &str) -> Option<RoomId> {
		if let Some(room_id) = RoomId::parse(room_code) {
			//return self.rooms.get_mut(&room_id);
			if self.has_room(&room_id) {
				return Some(room_id);
			}
		}
		None
	}
	pub fn has_room(&self, room_id: &RoomId) -> bool {
		self.rooms.contains_key(room_id)
	}
	
	async fn init_room(&self, id: RoomId, host_socket: WebSocket) {
		let mut clients = ClientIndex::new(host_socket, id).await;
		
		loop {
			let (lobby, handle) = lobby::Lobby::new(&mut clients);
			self.rooms.insert(id, handle);
			let Ok(settings) = lobby.run().await else {
				break 
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
	pub async fn accept_host(&self, host_socket: WebSocket) {
		let Some(id) = self.generate_room_id() else { return };
		tracing::debug!("[{}] Opening!", id.as_str());
		self.init_room(id, host_socket).await;
		tracing::debug!("[{}] Closed", id.as_str());
	}
	pub async fn accept_player_join(&self, socket: WebSocket, room_id: RoomId, name: String, icon: PlayerIcon) {
		let Some(handle) = self.rooms.get(&room_id) else {
			ClientIndex::reject_invalid_join(socket).await;
			return;
		};
		let _ = handle.send(room::Event::PlayerJoin { socket, name, icon }).await;
	}
	pub async fn accept_player_reconnect(&self, socket: WebSocket, room_id: RoomId, player_id: PlayerId, token: PlayerToken) {
		let Some(handle) = self.rooms.get(&room_id) else {
			ClientIndex::reject_invalid_rejoin(socket).await;
			return;
		};
		let _ = handle.send(room::Event::PlayerReconnect { socket, player_id, token }).await;
	}
}


