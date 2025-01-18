





use std::sync::Arc;
use dashmap::DashMap;

use tokio::sync::mpsc;


//use std::net::SocketAddr;


use crate::types::*;

mod goblin_names;
mod timeout;
mod client;

use timeout::*;
use client::*;

//use tokio_tungstenite::WebSocketStream;
//use tokio_tungstenite::tungstenite::Message;








/*async fn send(sender: &mut WebSocketSender, message: impl Serialize) -> Result<(), ()> {
	send_raw(sender, Message::Text(serialize(&message)?)).await
}*/
/*async fn reject_player(mut socket: WebSocket, message: &str) {
	let Ok(message) = serialize(&GlobalPlayerMsgOut::Error(message)) else { return };
	let _ = socket.send(Message::Text(message)).await;
}*/

mod room {
	
	use super::*;
	
	pub type Sender = mpsc::Sender<Event>;
	pub type Receiver = mpsc::Receiver<Event>;
	pub enum Event {
		PlayerJoin { socket: WebSocket, name: String, icon: PlayerIcon },
		PlayerRejoin { socket: WebSocket, player_id: PlayerId, token: PlayerToken }
	}
	
}

mod lobby {
	
	use super::*;
	
	const EVENT_QUEUE_SIZE: usize = 2;
	
	//pub type Sender = mpsc::Sender<Event>;
	//type Receiver = mpsc::Receiver<Event>;
	
	#[derive(Deserialize)]
	#[serde(tag = "type", content = "data")]
	#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
	enum HostMsgIn {
		//UpdateSettings(game::Settings)
		StartGame(Settings),
		KickPlayer { player_id: PlayerId }
	}
	#[derive(Serialize)]
	#[serde(tag = "type", content = "data")]
	#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
	enum HostMsgOut {
		
		InLobby { leader_id: PlayerId },
		GameStarting,
		//LobbyCreated,
		PlayerJoined { player_id: PlayerId, name: String, icon: PlayerIcon },
		PlayerLeft { player_id: PlayerId },
		PlayerIconChanged { player_id: PlayerId, icon: PlayerIcon },
		
	}
	
	#[derive(Deserialize)]
	#[serde(tag = "type", content = "data")]
	#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
	enum PlayerMsgIn {
		Leave,
		StartGame,
		ChangeIcon { icon: u8 },
	}
	#[derive(Serialize, Clone)]
	#[serde(tag = "type", content = "data")]
	#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
	enum PlayerMsgOut {
		Accepted { player_id: PlayerId, token: PlayerToken },
		//Promoted,
		//InLobby { promoted: bool },
		
		
		InLobby {
			/* player_count sent to the leader so they know if they can start the game */
			#[serde(skip_serializing_if = "Option::is_none")]
			player_count: Option<usize>
		}
	}
	
	#[derive(Serialize, Deserialize)]
	#[serde(tag = "mode", content = "settings")]
	#[serde(rename_all = "camelCase")]
	pub enum Settings {
		//None,
		Drawblins(drawblins::Settings)
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
			let (sender, receiver) = mpsc::channel(EVENT_QUEUE_SIZE);
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
		fn has_player(&self, player_id: PlayerId) -> bool {
			self.clients.players.contains(player_id as usize)
		}
		fn has_connected_player(&self, player_id: PlayerId) -> bool {
			let player = self.clients.players.get(player_id as usize);
			let Some(player) = player else { return false };
			player.is_connected()
		}
		fn new_leader_id(&self) -> Option<PlayerId> {
			for (player_id, player) in self.clients.players.iter() {
				if player.is_connected() {
					return Some(player_id as PlayerId);
				}
			}
			
			None
		}
		
		/* methods for syncing the state of clients */
		async fn sync_host(&mut self, leader_id: PlayerId) {
			self.clients.send_host(&HostMsgOut::InLobby { leader_id }).await;
		}
		async fn sync_leader(&mut self, leader_id: PlayerId) {
			self.clients.send_player(
				leader_id,
				&PlayerMsgOut::InLobby { player_count: Some(self.clients.player_count()) }
			).await;
		}
		async fn sync_leader_and_host(&mut self, leader_id: PlayerId) {
			self.sync_leader(leader_id).await;
			self.sync_host(leader_id).await;
		}
		async fn sync_nonleader(&mut self, player_id: PlayerId) {
			self.clients.send_player(
				player_id,
				&PlayerMsgOut::InLobby { player_count: None }
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
							room::Event::PlayerJoin { socket, name, icon } =>
								{ self.handle_join(socket, name, icon).await; },
							room::Event::PlayerRejoin { socket, player_id, token } =>
								{ self.handle_rejoin(socket, player_id, token).await; },
						}
					},
					client_event = self.clients.recv() => {
						let Some(event) = client_event else { break Err(()) };
						match event {
							ClientEvent::Disconnect(client_id) => {
								match client_id {
									ClientId::Host =>
										break Err(()),
									ClientId::Player(player_id) =>
										self.handle_player_disconnect(player_id).await
								}
							},
							ClientEvent::Message(client_id, message) =>
								self.handle_client_message(client_id, message).await
						}
					}
				}
			}
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
			self.clients.send_all_except(
				leader_id,
				&HostMsgOut::InLobby { leader_id },
				&PlayerMsgOut::InLobby { player_count: None }
			).await;
		}
		
		
		async fn handle_client_message(&mut self, client_id: ClientId, message: String) {
			match client_id {
				ClientId::Host => {
					let global_message = deserialize::<'_, GlobalHostMsgIn>(&message);
					if let Ok(message) = global_message {
						match message {
							GlobalHostMsgIn::Terminate =>
								self.state = State::Done(Err(()))
						};
						return;
					}
					
					let lobby_message = deserialize::<'_, HostMsgIn>(&message);
					if let Ok(message) = lobby_message {
						match message {
							HostMsgIn::StartGame(settings) =>
								self.handle_host_start_attempt(settings).await,
							HostMsgIn::KickPlayer { player_id } =>
								self.handle_host_kick_player(player_id).await
						}
						return;
					}
					
					tracing::debug!("[lobby] unrecognized host message: {message}");
					return;
				},
				ClientId::Player(player_id) => {
					let Ok(message) = deserialize::<'_, PlayerMsgIn>(&message) else {
						tracing::debug!("[lobby] unrecognized player message [{player_id}]: {message}");
						return;
					};
					match message {
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
		async fn handle_join(&mut self, socket: WebSocket, name: String, icon: PlayerIcon) {
			
			let State::Open { leader_id } = self.state else {
				tracing::debug!("[lobby] player attempted to join lobby while not open");
				return;
			};
			
			let result = self.clients.connect_player(socket, name.clone()).await;
			let Ok((player_id, token)) = result else { return };
			
			self.clients.send_host(&HostMsgOut::PlayerJoined {
				player_id,
				name,
				icon
			}).await;
			self.clients.send_player(player_id, &PlayerMsgOut::Accepted {
				player_id,
				token
			}).await;
			
			if self.has_player(leader_id) {
				self.sync_nonleader(player_id).await;
				self.sync_leader(leader_id).await; // tell leader updated player count
			} else {
				// no leader, make inc the new one
				self.state = State::Open { leader_id: player_id };
				self.sync_leader_and_host(player_id).await;
			}
		}
		async fn handle_rejoin(&mut self, socket: WebSocket, player_id: PlayerId, token: PlayerToken) {
			let State::Open { leader_id } = self.state else {
				tracing::warn!("[lobby] player attempted to rejoin lobby while not open");
				return;
			};
			
			let result = self.clients.reconnect_player(socket, player_id, token).await;
			let Ok(_) = result else { return; };
			
			let msg = &GlobalHostMsgOut::PlayerReconnected { player_id };
			self.clients.send_host(msg).await;
			
			if leader_id == player_id {
				self.sync_leader(player_id).await;
			} else {
				self.sync_nonleader(player_id).await;
			}
		}
		async fn handle_player_leave(&mut self, player_id: PlayerId) {
			let State::Open { leader_id } = self.state else {
				tracing::debug!("[lobby] player left lobby while not open");
				return;
			};
			
			self.clients.remove_player(player_id).await;
			self.clients.send_host(&HostMsgOut::PlayerLeft { player_id }).await;
			
			if self.has_player(leader_id) {
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
		async fn handle_player_disconnect(&mut self, player_id: PlayerId) {
			let msg = &GlobalHostMsgOut::PlayerDisconnected { player_id };
			self.clients.send_host(msg).await;
		}
		
		async fn handle_host_kick_player(&mut self, player_id: PlayerId) {
			let State::Open { leader_id: _ } = self.state else {
				return; //tracing::debug!("attempted to kick player while in invalid state");
			};
			self.clients.remove_player(player_id).await;
		}
		async fn handle_host_start_attempt(&mut self, settings: Settings) {
			let State::Starting = self.state else {
				tracing::warn!("[lobby] host attempted to start game for lobby in invalid state");
				return;
			};
			self.state = State::Done(Ok(settings));
		}
		async fn handle_player_start_attempt(&mut self, player_id: PlayerId) {
			let State::Open { leader_id } = self.state else {
				tracing::debug!("[lobby] attempted to start game for lobby in invalid state");
				return;
			};
			
			if player_id != leader_id {
				tracing::warn!("[lobby] non-leader player attempted to start game");
				return;
			}
			
			if self.clients.players.len() < MIN_PLAYER_COUNT {
				let msg = GlobalPlayerMsgOut::Error(&"Not enough players");
				self.clients.send_player(player_id, &msg).await;
				return;
			}
			
			self.state = State::Starting;
			self.clients.send_host(&HostMsgOut::GameStarting).await;
		}
		async fn handle_player_change_icon(&mut self, player_id: PlayerId, icon: u8) {
			self.clients.send_host(&HostMsgOut::PlayerIconChanged { player_id, icon }).await;
		}
	}
}

mod drawblins {
	
	use super::*;
	
	const MAX_PLAYER_COUNT: usize = 16;
	const START_DURATION: Duration = Duration::from_secs(3);
	const DRAW_DURATION: Duration = Duration::from_secs(120);
	const VOTE_DURATION: DynamicDuration = DynamicDuration::from_secs(12, 2);
	const RESULTS_DURATION: DynamicDuration = DynamicDuration::from_secs(6, 1);
	const SCORE_DURATION: DynamicDuration = DynamicDuration::from_secs(3, 1);
	
	#[derive(Serialize, Deserialize)]
	#[serde(rename_all = "camelCase")]
	pub struct Settings {
		// final round bonus?
		pub round_count: usize,
		pub draw_time_factor: f32,
		pub vote_time_factor: f32,
		pub score_time_factor: f32
	}
	
	#[derive(Deserialize)]
	#[serde(tag = "type", content = "data")]
	#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
	enum HostMsgIn {
		Terminate
	}
	#[derive(Serialize)]
	#[serde(tag = "type", content = "data")]
	#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
	enum HostMsgOut<'a> {
		//PlayerDisconnected { player_id: PlayerId }
		//PlayerReconnected { player_id: PlayerId, player_name: String },
		GameStarted,
		
		Drawing { goblin_name: &'a str },
		Voting,
		Results,
		Scoring,
		
		DrawingSubmitted { player_id: PlayerId, drawing: &'a str },
		VoteSubmitted { player_id: PlayerId, for_id: PlayerId }
	}
	
	#[derive(Deserialize)]
	#[serde(tag = "type", content = "data")]
	#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
	enum PlayerMsgIn {
		DrawingSubmission { drawing: String },
		VoteSubmission { for_name: String },
	}
	
	#[derive(Serialize, Clone)]
	#[serde(tag = "type", content = "data")]
	#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
	enum PlayerMsgOut<'a> {
		InGame,
		Waiting(WaitingKind),
		Drawing { goblin_name: &'a str, secs_left: f32 },
		Voting { choices: &'a [String], secs_left: f32 },
	}
	
	#[derive(Serialize, Clone)]
	#[serde(rename_all = "camelCase")]
	enum WaitingKind {
		Start,
		Draw,
		Vote,
		Results,
		//Score
	}
	
	enum State {
		Start,
		Draw { submitted: [bool; MAX_PLAYER_COUNT] },
		Vote { eligible: [bool; MAX_PLAYER_COUNT], choices: Box<[String]>, votes: [Option<PlayerId>; MAX_PLAYER_COUNT] },
		Results,
		Score,
		Done(Result<(), ()>)
	}
	pub struct Game<'a> {
		
		clients: &'a mut ClientIndex,
		receiver: room::Receiver,
		settings: Settings,
		
		timeout: Timeout,
		state: State,
		round: usize,
		names: Box<[String]>,
		
	}
	impl<'a> Game<'a> {
		
		pub fn new(clients: &'a mut ClientIndex, settings: Settings) -> (Self, room::Sender) {
			let (sender, receiver) = mpsc::channel(EVENT_QUEUE_SIZE);
			let round_count = settings.round_count;
			let game = Self {
				receiver,
				clients,
				settings,
				
				timeout: Timeout::new(START_DURATION),
				state: State::Start,
				round: 0,
				names: goblin_names::generate_names(round_count),
			};
			(game, sender)
		}
		pub async fn run(mut self) -> Result<(), ()> {
			
			self.clients.send_all(
				&HostMsgOut::GameStarted,
				&PlayerMsgOut::InGame
			).await;
			
			loop {
				if let State::Done(result) = self.state {
					break result;
				}
				
				tokio::select! {
					_ = &mut *self.timeout => self.advance().await,
					event = self.receiver.recv() => {
						let Some(event) = event else { break Err(()) };
						match event {
							room::Event::PlayerJoin { socket: _, name: _, icon: _ } =>
								{ tracing::warn!("[drawblins] player attempted to join a game that is already in progress"); },
							room::Event::PlayerRejoin { socket, player_id, token } =>
								{ self.handle_rejoin(socket, player_id, token).await; }
						}
					},
					event = self.clients.recv() => {
						let Some(event) = event else { break Err(()) };
						self.handle_client_event(event).await?
					},
				}
			}
		}
		
		fn vote_choices(&self, eligible: [bool; MAX_PLAYER_COUNT]) -> Box<[String]> {
			self.clients.players.iter()
				.filter_map(|(id, player)| {
					if let Some(true) = eligible.get(id) {
						Some(player.name.clone())
					} else {
						None
					}
				})
				.collect()
		}
		/*fn all_submitted(&self) {
			
		}*/
		
		async fn handle_client_event(&mut self, event: ClientEvent) -> Result<(), ()> {
			match event {
				ClientEvent::Disconnect(client_id) => {
					match client_id {
						ClientId::Host =>
							return Err(()),
						ClientId::Player(player_id) =>
							{ self.handle_player_disconnect(player_id).await; }
					}
				},
				ClientEvent::Message(client_id, message) => {
					match client_id {
						ClientId::Host => {
							let Ok(message) = deserialize::<'_, HostMsgIn>(&message) else { return Ok(()) };
							match message {
								HostMsgIn::Terminate => return Err(())
							}
						},
						ClientId::Player(player_id) => {
							let Ok(message) = deserialize::<'_, PlayerMsgIn>(&message) else { return Ok(()) };
							match message {
								PlayerMsgIn::DrawingSubmission { drawing } =>
									self.handle_drawing_submission(player_id, drawing).await,
								PlayerMsgIn::VoteSubmission { for_name } =>
									self.handle_vote_submission(player_id, for_name).await
							}
						}
					};
				}
			}
			return Ok(())
		}
		async fn handle_rejoin(&mut self, socket: WebSocket, player_id: PlayerId, token: PlayerToken) {
			if let State::Done(_) = self.state {
				return;
			}
			
			let result = self.clients.reconnect_player(socket, player_id, token).await;
			let Ok(_) = result else { return };
			
			self.clients.send_host(&GlobalHostMsgOut::PlayerReconnected { player_id }).await;
			self.clients.send_player(player_id, &PlayerMsgOut::InGame).await;
			
			let msg = match self.state {
				State::Done(_) => return, // unreachable
				State::Start => PlayerMsgOut::Waiting(WaitingKind::Start),
				State::Draw { submitted } => {
					if let Some(true) = submitted.get(player_id as usize) {
						/* If the player has already submitted, just idle */
						PlayerMsgOut::Waiting(WaitingKind::Draw)
					} else {
						/* Otherwise, ask them to draw */
						let Some(goblin_name) = self.names.get(self.round) else {
							tracing::error!("[drawblins] no goblin name for current round: {}", self.round);
							return;
						};
						PlayerMsgOut::Drawing {
							goblin_name,
							secs_left: self.timeout.remaining_secs()
						}
					}
				},
				State::Vote { eligible: _, ref choices, votes } => {
					if let Some(None) = votes.get(player_id as usize) {
						/* If the player hasn't voted, ask them to */
						self.clients.send_player(player_id, &PlayerMsgOut::Voting {
							choices,
							secs_left: self.timeout.remaining_secs()
						}).await;
						return;
					} else {
						/* If they have, they should just wait */
						PlayerMsgOut::Waiting(WaitingKind::Vote)
					}
				},
				State::Results | State::Score => {
					PlayerMsgOut::Waiting(WaitingKind::Results)
				},
			};
			self.clients.send_player(player_id, &msg).await;
		}
		async fn handle_player_disconnect(&mut self, player_id: PlayerId) {
			let msg = &GlobalHostMsgOut::PlayerDisconnected { player_id };
			self.clients.send_host(msg).await;
		}
		
		async fn advance(&mut self) {
			match self.state {
				State::Start => self.start_draw().await,
				State::Draw { submitted } => self.start_vote(submitted).await,
				State::Vote { eligible: _, ref choices, votes: _ } => self.start_results(choices.len()).await,
				State::Results => self.start_score().await,
				State::Score => self.start_draw().await,
				State::Done(_) => {
					tracing::warn!("[drawblins] attempted to advance a terminated game");
				}
			}
		}
		async fn start_draw(&mut self) {
			/* Increment the round counter, unless we just started */
			if !matches!(self.state, State::Start) {
				self.round += 1;
			}
			
			let Some(goblin_name) = self.names.get(self.round) else {
				return self.start_finale().await; // last round just ended, we're done
			};
			
			self.state = State::Draw { submitted: [false; MAX_PLAYER_COUNT] };
			self.timeout.reset(Timeout::scaled(DRAW_DURATION, self.settings.draw_time_factor));
			
			self.clients.send_all(
				&HostMsgOut::Drawing { goblin_name /*, secs_left*/ },
				&PlayerMsgOut::Drawing {
					goblin_name,
					secs_left: self.timeout.remaining_secs()
				}
			).await;
		}
		async fn start_vote(&mut self, eligible: [bool; MAX_PLAYER_COUNT]) {
			
			let choices = self.vote_choices(eligible);
			if choices.is_empty() {
				// if nobody submitted a drawing, just end the game?
				// for now we skip to results instead; probably not ideal
				//self.state = State::Done(Ok(()));
				self.start_results(0).await;
				return;
			}
			
			let duration = Timeout::scaled_dynamic(VOTE_DURATION, self.settings.vote_time_factor, choices.len());
			self.timeout.reset(duration);
			
			self.clients.send_all(
				&HostMsgOut::Voting {},
				&PlayerMsgOut::Voting {
					choices: &choices,
					secs_left: self.timeout.remaining_secs()
				}
			).await;
			self.state = State::Vote { eligible, choices, votes: [None; MAX_PLAYER_COUNT] };	
		}
		async fn start_results(&mut self, choice_count: usize) {
			self.state = State::Results;
			self.timeout.reset(Timeout::dynamic(RESULTS_DURATION, choice_count));
			self.clients.send_all(
				&HostMsgOut::Results,
				&PlayerMsgOut::Waiting(WaitingKind::Results)
			).await;
		}
		async fn start_score(&mut self) {
			self.state = State::Score;
			let duration = Timeout::scaled_dynamic(SCORE_DURATION, self.settings.score_time_factor, self.clients.player_count());
			self.timeout.reset(duration);
			self.clients.send_host(&HostMsgOut::Scoring).await;
		}
		async fn start_finale(&mut self) {
			self.state = State::Done(Ok(()));
		}
		async fn handle_drawing_submission(&mut self, player_id: PlayerId, drawing: String) {
			let State::Draw { ref mut submitted } = self.state else {
				tracing::debug!("[drawblins] received a drawing while not in drawing state [{player_id}]");
				return;
			};
			let Some(false) = submitted.get(player_id as usize) else {
				tracing::debug!("[drawblins] duplicate drawing received [{player_id}]");
				return;
			};
			
			submitted[player_id as usize] = true;
			
			self.clients.send_host(&HostMsgOut::DrawingSubmitted {
				player_id,
				drawing: &drawing
			}).await;
			
			let all_submitted = self.clients.players.iter().all(|(id, _)| {
				matches!(submitted.get(id), Some(true))
			});
			if all_submitted {
				self.advance().await;
			}
		}
		async fn handle_vote_submission(&mut self, player_id: PlayerId, for_name: String) {
			
			let for_id = self.clients.player_id_from_name(&for_name);
			
			let Some(for_id) = for_id else {
				tracing::warn!("[drawblins] couldn't find player with name for vote: [{player_id} -> {for_name}]");
				return;
			};
			if player_id == for_id {
				tracing::warn!("[drawblins] self vote attempted [{player_id} -> {for_id}]"); //: {}", Self::id_str(&self.id), player_id);
				return;
			}
			/*if !self.clients.players.contains(for_id as usize) {
				//tracing::warn!("[drawblins] attempted to vote for player that is not present [{player_id} -> {for_id}]");
				tracing::error!("[drawblins] voting error");
				return;
			}*/
			let State::Vote { ref eligible, ref choices, ref mut votes } = self.state else {
				tracing::warn!("[drawblins] received a vote while not in voting state [{player_id} -> {for_id}]");
				return;
			};
			let Some(true) = eligible.get(for_id as usize) else {
				tracing::warn!("[drawblins] voted for ineligible player [{player_id} -> {for_id}]");
				return;
			};
			let Some(None) = votes.get(player_id as usize) else {
				tracing::warn!("[drawblins] duplicate vote received [{player_id} -> {for_id}]");
				return;
			};
			
			votes[player_id as usize] = Some(for_id);
			
			let votes_received = votes
				.iter()
				.filter(|vote| vote.is_some())
				.count();
			
			let mut votes_needed = self.clients.player_count();
			if choices.len() <= 1 {
				// if only one player submitted a drawing, that player has nobody to vote for
				// we need 1 less vote in this case
				votes_needed -= 1;
			}
			
			let all_voted = votes_received >= votes_needed;
			/*let all_submitted = self.clients.players.iter().all(|(id, _)| {
				matches!(votes.get(id), Some(Some(_)))
			});*/
			
			self.clients.send_host(&HostMsgOut::VoteSubmitted {
				player_id,
				for_id
			}).await;
			
			if all_voted {
				self.advance().await;
			}
		}
	}
}

/*mod dating {
	
	use super::*;
	
	#[derive(Serialize, Deserialize)]
	#[serde(rename_all = "camelCase")]
	struct Settings {
		pub round_count: usize,
		
	}
	
	/*#[derive(Deserialize)]
	#[serde(tag = "type", content = "data")]
	#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
	enum HostMsgIn {
		Terminate
	}
	#[derive(Serialize)]
	#[serde(tag = "type", content = "data")]
	#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
	enum HostMsgOut<'a> {
		//PlayerDisconnected { player_id: PlayerId }
		//PlayerReconnected { player_id: PlayerId, player_name: String },
		GameStarted,
		
		Drawing { goblin_name: &'a str },
		Voting,
		Results,
		Scoring,
		
		DrawingSubmitted { player_id: PlayerId, drawing: &'a str },
		VoteSubmitted { player_id: PlayerId, for_id: PlayerId }
	}
	
	#[derive(Deserialize)]
	#[serde(tag = "type", content = "data")]
	#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
	enum PlayerMsgIn {
		DrawingSubmission { drawing: String },
		VoteSubmission { for_name: String } //for_id: PlayerId }
	}
	
	#[derive(Serialize, Clone)]
	#[serde(tag = "type", content = "data")]
	#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
	enum PlayerMsgOut<'a> {
		InGame,
		Waiting(WaitingKind),
		Drawing { goblin_name: &'a str, secs_left: f32 },
		Voting { choices: &'a [String], secs_left: f32 },
	}*/
	
	
	enum State {
		Start,
		Draw {},
	}
	
	struct Game<'a> {
		clients: &'a mut ClientIndex,
		receiver: room::Receiver,
		settings: Settings,
	}
	impl<'a> Game<'a> {
		/*pub fn new(clients: &'a mut ClientIndex, settings: Settings) -> (Self, game::Sender) {
			let (sender, receiver) = mpsc::channel(EVENT_QUEUE_SIZE);
		}*/
	}
}*/
mod showdown {
	
	/*use super::*;
	//use timeout::Timeout;
	
	//const MAX_PLAYER_COUNT: usize = 8;
	//const ROUND_COUNT: usize = 3;
	
	enum State {
		Start,
		Draw { submitted: [bool; MAX_PLAYER_COUNT] }
	}*/
	
}



/*enum RoomHandle {
	Lobby(lobby::Sender),
	Game(game::Sender)
}*/

//type RoomHandle = mpsc::Sender<RoomEvent>;
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
		let mut clients = ClientIndex::new(host_socket, MAX_PLAYER_COUNT as PlayerId);
		let result = clients.send_host(&GlobalHostMsgOut::Accepted {
			join_code: id.as_str()
		}).await;
		
		if !result {
			tracing::warn!("failed initial send to host");
			return;
		}
		
		loop {
			let (lobby, handle) = lobby::Lobby::new(&mut clients);
			self.rooms.insert(id, handle);
			let Ok(settings) = lobby.run().await else { break };
			
			match settings {
				lobby::Settings::Drawblins(settings) => {
					let (game, handle) = drawblins::Game::new(&mut clients, settings);
					self.rooms.insert(id, handle);
					let Ok(_) = game.run().await else { break };
				},
			};
		}
		
		self.rooms.remove(&id);
		clients.send_all(
			&GlobalHostMsgOut::Terminated,
			&GlobalPlayerMsgOut::Terminated
		).await;
		clients.disconnect_all().await;
	}
	pub async fn accept_host(&self, host_socket: WebSocket) {
		let Some(id) = self.generate_room_id() else { return };
		tracing::debug!("[{}] Opening!", id.as_str());
		self.init_room(id, host_socket).await;
		tracing::debug!("[{}] Closed", id.as_str());
	}
	pub async fn accept_player_join(&self, socket: WebSocket, room_id: RoomId, name: String, icon: PlayerIcon) {
		let Some(handle) = self.rooms.get(&room_id) else {
			// this should essentially never happen
			ClientIndex::terminate_player(socket).await;
			return;
		};
		let _ = handle.send(room::Event::PlayerJoin { socket, name, icon }).await;
	}
	pub async fn accept_player_rejoin(&self, socket: WebSocket, room_id: RoomId, player_id: PlayerId, token: PlayerToken) {
		let Some(handle) = self.rooms.get(&room_id) else {
			// this should essentially never happen
			ClientIndex::terminate_player(socket).await;
			return;
		};
		let _ = handle.send(room::Event::PlayerRejoin { socket, player_id, token }).await;
	}
}


