
use super::*;

#[derive(Deserialize)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
enum HostMsgIn {
	StartGame(Settings),
	KickPlayer { player_id: PlayerId }
}
#[derive(Serialize)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
enum HostMsgOut {
	GameStarting,
	//LobbyCreated,
	PlayerIconChanged { player_id: PlayerId, icon: PlayerIcon },
	//PlayerColorChanged { player_id: PlayerId, color: PlayerColor }
}

#[derive(Deserialize)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
enum PlayerMsgIn {
	Leave,
	StartGame,
	ChangeIcon { icon: u8 },
}
/*#[derive(Serialize, Clone)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
enum PlayerMsgOut {
	//Promoted,
	//InLobby { promoted: bool },
}*/

#[derive(Serialize, Deserialize)]
#[serde(tag = "mode", content = "settings")]
#[serde(rename_all = "camelCase")]
pub enum Settings {
	//None,
	Drawing(drawblins::Settings),
	Dating(dating::Settings),
}
enum State {
	Open { leader_id: PlayerId },
	Starting,
	Done(Result<Settings, ()>)
}

pub struct Lobby<'a> {
	pub clients: &'a mut ClientIndex,
	receiver: room::Receiver,
	state: State
}
impl<'a> Lobby<'a> {
	pub fn new(clients: &'a mut ClientIndex) -> (Self, room::Sender) {
		let (sender, receiver) = room::channel();
		let lobby = Self {
			receiver,
			//settings,
			clients,
			state: State::Open { leader_id: 0 }
			//leader_id: 0
		};
		(lobby, sender)
	}
	
	/*fn has_leader(&self) -> bool {
		let State::Open { leader_id } = self.state else { return false };
		self.has_player(leader_id)
	}*/
	
	fn new_leader_id(&self) -> Option<PlayerId> {
		for (player_id, player) in self.clients.players.iter() {
			if player.is_open() {
				return Some(player_id as PlayerId);
			}
		}
		
		None
	}
	
	/* methods for syncing the state of clients */
	async fn sync_host(&mut self, leader_id: PlayerId) {
		let msg = GlobalHostMsgOut::InLobby { leader_id };
		self.clients.host.send(&msg).await;
	}
	async fn sync_leader(&mut self, leader_id: PlayerId) {
		let player_count = Some(self.clients.player_count());
		let msg = GlobalPlayerMsgOut::InLobby { player_count };
		self.clients.players.send(leader_id, &msg).await;
	}
	async fn sync_leader_and_host(&mut self, leader_id: PlayerId) {
		self.sync_leader(leader_id).await;
		self.sync_host(leader_id).await;
	}
	async fn sync_nonleader(&mut self, player_id: PlayerId) {
		let player_count = None;
		let msg = GlobalPlayerMsgOut::InLobby { player_count };
		self.clients.players.send(player_id, &msg).await;
	}
	
	async fn open(&mut self) {
		
		let leader_id;
		match self.new_leader_id() {
			None => {
				leader_id = PlayerId::MAX;
			},
			Some(new_leader_id) => {
				leader_id = new_leader_id;
				self.sync_leader(leader_id).await;
			}
		}
		
		self.state = State::Open { leader_id };
		self.clients.send_all_except_one(
			leader_id,
			&GlobalPlayerMsgOut::InLobby { player_count: None },
			&GlobalHostMsgOut::InLobby { leader_id }
		).await;
	}
	pub async fn run(mut self) -> Result<Settings, ()> {
		
		self.open().await;
		
		loop {
			
			if let State::Done(result) = self.state {
				return result;
			}
			
			tokio::select! {
				event = self.receiver.recv() => {
					let Some(event) = event else { break Err(()); };
					match event {
						room::Event::HostReconnect { socket, token } =>
							{ self.handle_host_reconnect(socket, token).await; }
						room::Event::PlayerJoin { socket, name, icon } =>
							{ self.handle_player_join(socket, name, icon).await; },
						room::Event::PlayerReconnect { socket, player_id, token, manual } =>
							{ self.handle_player_reconnect(socket, player_id, token, manual).await; },
					}
				},
				client_event = self.clients.recv() => {
					let Some(event) = client_event else { break Err(()) };
					match event {
						ClientEvent::Close => break Err(()),
						ClientEvent::Disconnect(client_id, _) => {},
						ClientEvent::Message(client_id, msg) =>
							self.handle_client_message(client_id, msg).await
					}
				}
			}
		}
	}
	async fn handle_host_reconnect(&mut self, socket: WebSocket, token: ClientToken) {
		let _ = self.clients.reconnect_host(socket, token).await;
	}
	async fn handle_player_join(&mut self, socket: WebSocket, name: String, icon: PlayerIcon) {
		
		let State::Open { leader_id } = self.state else {
			tracing::debug!("player attempted to join lobby while not open");
			return;
		};
		
		let result = self.clients.connect_player(socket, name, icon).await;
		let Ok(player_id) = result else { return };
		
		if self.clients.has_player(leader_id) {
			self.sync_nonleader(player_id).await;
			self.sync_leader(leader_id).await; // tell leader updated player count
		} else {
			// no leader, make inc the new one
			self.state = State::Open { leader_id: player_id };
			self.sync_leader_and_host(player_id).await;
		}
		
		//self.clients.kick_player(player_id).await;
		
	}
	async fn handle_player_reconnect(&mut self, socket: WebSocket, player_id: PlayerId, token: ClientToken, manual: bool) {
		
		let result = self.clients.reconnect_player(socket, player_id, token, manual).await;
		let Ok(()) = result else { return; };
		
		let State::Open { leader_id } = self.state else {
			//tracing::debug!("player attempted to reconnect to lobby while not open");
			//ClientIndex::reject_invalid_rejoin(socket, manual);
			return;
		};
		
		if leader_id == player_id {
			self.sync_leader(player_id).await;
		} else {
			self.sync_nonleader(player_id).await;
		}
	}
	
	
	
	async fn handle_client_message(&mut self, client_id: ClientId, msg: Utf8Bytes) {
		match client_id {
			ClientId::Host => {
				/*let global_message = deserialize::<'_, GlobalHostMsgIn>(&msg);
				if let Ok(msg) = global_message {
					match msg {
						GlobalHostMsgIn::Terminate =>
							self.state = State::Done(Err(()))
					};
					return;
				}*/
				let lobby_message = deserialize::<'_, HostMsgIn>(&msg);
				if let Ok(msg) = lobby_message {
					match msg {
						HostMsgIn::StartGame(settings) =>
							self.handle_host_start_attempt(settings).await,
						HostMsgIn::KickPlayer { player_id } =>
							self.handle_host_kick_player(player_id).await
					}
					return;
				}
				
				tracing::debug!("unrecognized host message: {msg}");
				return;
			},
			ClientId::Player(player_id) => {
				let Ok(msg) = deserialize::<'_, PlayerMsgIn>(&msg) else {
					tracing::debug!("unrecognized player message [{player_id}]: {msg}");
					return;
				};
				match msg {
					PlayerMsgIn::StartGame =>
						self.handle_player_start_attempt(player_id).await,
					PlayerMsgIn::Leave =>
						self.handle_player_leave(player_id).await,
					PlayerMsgIn::ChangeIcon { icon } =>
						self.handle_player_change_icon(player_id, icon).await
				};
			}
		}
		
	
	}
	
	async fn handle_player_leave(&mut self, player_id: PlayerId) {
		let State::Open { leader_id } = self.state else {
			tracing::debug!("player left lobby while not open");
			return;
		};
		
		self.clients.remove_player(player_id).await;
		
		if self.clients.has_player(leader_id) {
			// tell leader updated player count
			self.sync_leader(leader_id).await;
		} else {
			// leader leaving, choose a new one
			match self.new_leader_id() {
				Some(leader_id) => {
					self.state = State::Open { leader_id };
					self.sync_leader_and_host(leader_id).await;
				}
				None => {
					self.state = State::Open { leader_id: PlayerId::MAX };
				}
			}
		}
	}
	
	async fn handle_host_kick_player(&mut self, player_id: PlayerId) {
		let State::Open { leader_id: _ } = self.state else {
			tracing::debug!("attempted to kick player while in invalid state");
			return;
		};
		self.clients.kick_player(player_id).await;
	}
	async fn handle_host_start_attempt(&mut self, settings: Settings) {
		let State::Starting = self.state else {
			tracing::warn!("host attempted to start game for lobby in invalid state");
			return;
		};
		self.state = State::Done(Ok(settings));
	}
	async fn handle_player_start_attempt(&mut self, player_id: PlayerId) {
		let State::Open { leader_id } = self.state else {
			tracing::debug!("attempted to start game for lobby in invalid state");
			return;
		};
		
		if player_id != leader_id {
			tracing::warn!("non-leader player attempted to start game");
			return;
		}
		
		if self.clients.players.len() < MIN_PLAYER_COUNT {
			let msg = GlobalPlayerMsgOut::Error(&"Not enough players");
			self.clients.players.send(player_id, &msg).await;
			return;
		}
		
		self.state = State::Starting;
		self.clients.host.send(&HostMsgOut::GameStarting).await;
	}
	async fn handle_player_change_icon(&mut self, player_id: PlayerId, icon: u8) {
		self.clients.host.send(&HostMsgOut::PlayerIconChanged { player_id, icon }).await;
	}
}

/*#[test]
fn test() {
	println!("{}", serialize(&Settings::Dating(dating::Settings {
		round_count: 5,
		bachelor_draw_time_factor: 1.0,
		suitor_draw_time_factor: 0.8,
		vote_time_factor: 0.6,
		score_time_factor: 0.4
	})).unwrap());
}*/

