






//use internment::ArcIntern;
//use log::{info, warn, error};

use std::sync::Arc;

use slab::Slab;
use dashmap::DashMap;


use futures_util::{
	//Future,
	SinkExt, StreamExt,
	stream::{SplitSink, SplitStream}
};


use tokio::sync::mpsc;
use tokio::task::JoinHandle;
use async_scoped::TokioScope;
use serde::{Serialize, Deserialize};
//use std::net::SocketAddr;
use axum::extract::ws::{Message, WebSocket};

use crate::types::*;
use crate::goblin_names;

//use tokio_tungstenite::WebSocketStream;
//use tokio_tungstenite::tungstenite::Message;


pub type WebSocketSender = SplitSink<WebSocket, Message>;
pub type WebSocketReceiver = SplitStream<WebSocket>;



fn room_id_str<'a>(id: &'a RoomId) -> &'a str {
	unsafe { std::str::from_utf8_unchecked(id) }
}
fn serialize(value: &impl Serialize) -> Result<String, ()> {
	match serde_json::to_string(value) {
		Ok(string) => Ok(string),
		Err(err) =>	{
			log::error!("serialization: {err}");
			Err(())
		}
	}
}
fn deserialize<'a, T: Deserialize<'a>>(str: &'a str) -> Result<T, ()> {
	match serde_json::from_str::<T>(str) {
		Ok(value) => Ok(value),
		Err(err) => {
			log::error!("deserialization: {err}");
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
			Ok(Message::Close(_)) => {
				log::debug!("websocket connection closed.");
				return None;
			},
			Ok(Message::Ping(_)) => {},
			Ok(message) => {
				log::warn!("invalid websocket message: {message:?}")
			},
			Err(err) => {
				log::error!("websocket receive: {err}");
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
			log::warn!("websocket send: {err}");
			Err(())
		}
	}
}
async fn send(sender: &mut WebSocketSender, message: impl Serialize) -> Result<(), ()> {
	send_raw(sender, Message::Text(serialize(&message)?)).await
}
async fn reject_socket(mut socket: WebSocket, message: &str) {
	let Ok(message) = serialize(&GlobalPlayerMsgOut::Error(message)) else { return };
	let _ = socket.send(Message::Text(message)).await;
}




struct Presence {
	sender: WebSocketSender,
	handle: JoinHandle<()>
}
struct Host {
	presence: Presence,
}
struct Player {
	presence: Presence,
	//addr: SocketAddr,
	name: String,
	token: PlayerToken
}
impl Presence {
	fn new(sender: WebSocketSender, handle: JoinHandle<()>) -> Self {
		Self { sender, handle }
	}
	fn is_connected(&self) -> bool {
		!self.handle.is_finished()
	}
	async fn disconnect(&mut self) {
		if self.is_connected() {
			let _ = self.sender.close().await;
		}
	}
	/*async fn send_raw(&mut self, message: Message) -> Result<(), ()> {
		send_raw(&mut self.sender, message).await
	}*/
	async fn send<M: Serialize>(&mut self, message: &M) -> Result<(), ()> {
		if self.is_connected() {
			send(&mut self.sender, message).await
		} else {
			Err(())
		}
	}
}
impl Host {
	async fn send<M: Serialize>(&mut self, message: &M) -> Result<(), ()> {
		send(&mut self.presence.sender, message).await
	}
}
impl Player {
	fn new(presence: Presence, name: String, token: PlayerToken) -> Self {
		Self { presence, name, token }
	}
	async fn send_raw(&mut self, message: Message) -> Result<(), ()> {
		send_raw(&mut self.presence.sender, message).await
	}
	async fn send<M: Serialize>(&mut self, message: &M) -> Result<(), ()> {
		send(&mut self.presence.sender, message).await
	}
}

use client_index::ClientIndex;




mod client_index {
	
	use crate::types::*;
	use super::*;
	
	pub type Sender = mpsc::Sender<Event>;
	pub type Receiver = mpsc::Receiver<Event>;
	pub enum Event {
		HostDisconnect,
		HostMessage(String),
		PlayerDisconnect(PlayerId),
		PlayerMessage(PlayerId, String)
	}
	pub struct ClientIndex {
		sender: Sender,
		pub receiver: Receiver,
		pub host: Host,
		pub players: Slab<Box<Player>>
	}
	
	impl ClientIndex {
		
		pub fn new(host_socket: WebSocket, capacity: PlayerId) -> Self {
			let (sender, receiver) = mpsc::channel(2);
			let host = {
				let (tx, mut rx) = host_socket.split();
				let sender = sender.clone();
				let handle = tokio::spawn(async move {
					while let Some(content) = super::next_string(&mut rx).await {
						let result = sender.send(Event::HostMessage(content)).await;
						if result.is_err() {
							break;
						}
					}
					//log::info!();
					let _ = sender.send(Event::HostDisconnect).await;
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
		
		pub fn is_full(&self) -> bool {
			self.players.len() == self.players.capacity()
		}
		pub async fn recv(&mut self) -> Option<Event> {
			/*let event = self.receiver.recv().await;
			if let Some(Event::PlayerDisconnect(player_id)) = event {
				if let Some(player) = self.players.get_mut(player_id as usize) {
					
				}
			}
			event*/
			self.receiver.recv().await
		}
		
		fn generate_token() -> PlayerToken {
			use rand::Rng;
			rand::thread_rng().gen::<PlayerToken>()
		}
		
		fn player_presence(sender: Sender, socket: WebSocket, player_id: PlayerId) -> Presence {
			let (tx, mut rx) = socket.split();
			let handle = tokio::spawn(async move {
				while let Some(content) = next_string(&mut rx).await {
					let result = sender.send(Event::PlayerMessage(player_id, content)).await;
					if result.is_err() {
						break;
					}
				}
				let _ = sender.send(Event::PlayerDisconnect(player_id)).await;
			});
			Presence::new(tx, handle)
		}
		pub async fn connect_player(&mut self, socket: WebSocket, name: String) -> Result<(PlayerId, PlayerToken), ()> {
			
			if self.is_full() {
				return Err(reject_socket(socket, "Lobby is full").await);
			}
			
			let name_taken = self.players.iter().any(|(_, player)| name == player.name);
			if name_taken {
				return Err(reject_socket(socket, "Name is taken").await);
			}
			
			let player_id = self.players.vacant_key() as PlayerId;
			let token = Self::generate_token();
			
			let presence = Self::player_presence(self.sender.clone(), socket, player_id);
			self.players.insert(Box::new(Player::new(presence, name, token)));
			Ok((player_id, token))
		}
		pub async fn reconnect_player(&mut self, socket: WebSocket, player_id: PlayerId, player_token: PlayerToken) -> Result<(), ()> {
			
			let Some(player) = self.players.get_mut(player_id as usize) else {
				log::info!("game rejoin failure (no such player)");
				return Err(reject_socket(socket, "Couldn't rejoin game").await);
			};
			
			if player_token != player.token {
				log::info!("game rejoin failure (invalid token)");
				return Err(reject_socket(socket, "Couldn't rejoin game").await);
			}
			
			if player.presence.is_connected() {
				log::info!("game rejoin failure (already connected)");
				return Err(reject_socket(socket, "Already connected elsewhere").await);
			}
			
			player.presence = Self::player_presence(self.sender.clone(), socket, player_id);
			Ok(())
		}
		pub async fn disconnect_player(&mut self, player_id: PlayerId) {
			if let Some(player) = self.players.get_mut(player_id as usize) {
				player.presence.disconnect().await
			}
		}
		pub async fn remove_player(&mut self, player_id: PlayerId) {
			if self.players.contains(player_id as usize) {
				let mut player = self.players.remove(player_id as usize);
				let _ = player.presence.disconnect().await;
			} else {
				log::warn!("attempted to remove player that is not present");
			}
		}
		pub fn remove_disconnected_players(&mut self) -> Vec<PlayerId> {
			//self.players.retain(|_, player| player.presence.is_connected());
			let mut removed_ids = Vec::new();
			for (id, player) in self.players.iter() {
				if !player.presence.is_connected() {
					removed_ids.push(id as PlayerId);
				}
			}
			for &id in removed_ids.iter() {
				self.players.remove(id as usize);
			}
			removed_ids
		}
		//pub async fn 
		pub async fn disconnect_all(&mut self) {
			self.host.presence.disconnect().await;
			for (_, player) in self.players.iter_mut() {
				player.presence.disconnect().await;
			}
		}
		/*pub async fn terminate(mut self) {
			self.host.presence.disconnect().await;
			for (_, player) in self.players.iter_mut() {
				player.presence.disconnect().await;
			}
		}*/
		pub async fn send_host<M: Serialize>(&mut self, message: &M) -> Result<(), ()> {
			self.host.send(message).await
		}
		pub async fn send_player<M: Serialize>(&mut self, id: PlayerId, message: &M) -> Result<(), ()> {
			if let Some(player) = self.players.get_mut(id as usize) {
				player.send(message).await
			} else {
				log::error!("attempted to send to nonexistent player");
				Err(())
			}
		}
		//pub async fn send_host_and_player(&mut self, player_id: PlayerId)
		pub async fn send_all<H: Serialize, P: Serialize>(&mut self, host_message: &H, player_message: &P) -> Result<(), ()> {
			let results = tokio::join!(
				self.host.send(host_message),
				Self::send_players(self.players.iter_mut(), player_message)
			);
			results.0.and(results.1)
		}
		pub async fn send_all_except<H: Serialize, P: Serialize>(&mut self, except_id: PlayerId, host_message: &H, player_message: &P) -> Result<(), ()> {
			let results = tokio::join!(
				self.host.send(host_message),
				Self::send_players_except(self.players.iter_mut(), except_id, player_message)
			);
			results.0.and(results.1)
		}
		pub async fn send_all_players<M: Serialize>(&mut self, message: &M) -> Result<(), ()> {
			Self::send_players(self.players.iter_mut(), message).await
		}
		pub async fn send_all_players_except<M: Serialize>(&mut self, except_id: PlayerId, message: &M) -> Result<(), ()> {
			Self::send_players_except(self.players.iter_mut(), except_id, message).await
		}
		async fn send_players<'a, I, M: Serialize>(players: I, message: &M) -> Result<(), ()>
		where I: Iterator<Item=(usize, &'a mut Box<Player>)> {
			let message = Message::Text(serialize(message)?);
			let (_, results) = TokioScope::scope_and_block(|scope| {
				for (_, player) in players {
					scope.spawn(player.send_raw(message.clone()));
				}
			});
			
			for result in results {
				if !matches!(result, Ok(Ok(_))) {
					return Err(());
				}
			}
			
			Ok(())
		}
		async fn send_players_except<'a, I, M: Serialize>(players: I, except_id: PlayerId, message: &M) -> Result<(), ()>
		where I: Iterator<Item=(usize, &'a mut Box<Player>)> {
			let iter = players.enumerate()
				.filter(|(id, _)| *id as PlayerId != except_id)
				.map(|(_, player)| player);
			Self::send_players(iter, message).await
		}
		
		
		/*async fn drop_player() {
			
		}*/
		
	}
	
}
mod lobby {
	
	use super::*;
	
	const EVENT_QUEUE_SIZE: usize = 2;
	
	pub type Sender = mpsc::Sender<Event>;
	type Receiver = mpsc::Receiver<Event>;
	
	pub enum Event {
		PlayerJoin { socket: WebSocket, name: String }
	}
	
	pub struct Lobby<'a> {
		//id: RoomId,
		//pub sender: mpsc::Sender<Event>,
		pub receiver: mpsc::Receiver<Event>,
		pub settings: game::Settings,
		pub clients: &'a mut ClientIndex,
		leader_id: PlayerId,
		//host: super::Host,
		//players: Slab<super::Player>
	}
	impl<'a> Lobby<'a> {
		pub fn new(clients: &'a mut ClientIndex, settings: game::Settings) -> (Self, Sender) {
			let (sender, receiver) = mpsc::channel(EVENT_QUEUE_SIZE); /* this is an arbitrary size */
			let lobby = Self {
				receiver,
				settings,
				clients,
				leader_id: 0
			};
			(lobby, sender)
		}
		fn new_leader_id(&self) -> PlayerId {
			if let Some((leader_id, _)) = self.clients.players.iter().next() {
				leader_id as PlayerId
			} else {
				PlayerId::MAX
			}
		}
		async fn open(&mut self) {
			
			let removed_ids = self.clients.remove_disconnected_players();
			for player_id in removed_ids {
				let _ = self.clients.send_host(&HostMsgOut::PlayerLeft { player_id }).await;
			}
			
			if self.clients.players.is_empty() {
				let _ = self.clients.send_host(&HostMsgOut::LobbyCreated).await;
			} else {
				self.leader_id = self.new_leader_id();
				let _ = self.clients.send_player(
					self.leader_id,
					&PlayerMsgOut::InLobby { promoted: true }
				).await;
				let _ = self.clients.send_all_except(
					self.leader_id,
					&HostMsgOut::LobbyCreated,
					&PlayerMsgOut::InLobby { promoted: false }
				).await;
			}
		}
		pub async fn run(mut self) -> Result<game::Settings, ()> {
			
			self.open().await;
			
			loop {
				tokio::select! {
					event = self.receiver.recv() => {
						let Some(event) = event else { break Err(()); };
						match event {
							Event::PlayerJoin { socket, name } => {
								let result = self.clients.connect_player(socket, name.clone()).await;
								let Ok((player_id, token)) = result else { continue };
								
								/* If we don't have a leader, make this player the leader */
								if !self.clients.players.contains(self.leader_id as usize) {
									self.leader_id = player_id;
								}
								
								let _ = self.clients.send_host(&HostMsgOut::PlayerJoined {
									player_id,
									player_name: name
								}).await;
								let _ = self.clients.send_player(player_id, &PlayerMsgOut::Accepted {
									player_id,
									token,
									//promoted: self.leader_id == player_id
								}).await;
								let _ = self.clients.send_player(player_id, &PlayerMsgOut::InLobby {
									promoted: self.leader_id == player_id
								}).await;
							}
						}
					},
					event = self.clients.receiver.recv() => {
						use client_index::Event;
						let Some(event) = event else { break Err(()); };
						match event {
							Event::HostDisconnect => break Err(()),
							Event::PlayerDisconnect(player_id) => {
								self.clients.remove_player(player_id).await;
								let _ = self.clients.send_host(&HostMsgOut::PlayerLeft { player_id }).await;
								
								/* If the leader left, promote someone else */
								if player_id == self.leader_id && !self.clients.players.is_empty() {
									self.leader_id = self.new_leader_id();
									let _ = self.clients.send_player(self.leader_id, &PlayerMsgOut::InLobby {
										promoted: true
									}).await;
								}
							},
							Event::HostMessage(message) => {
								let Ok(message) = deserialize::<'_, HostMsgIn>(&message) else { continue };
								match message {
									HostMsgIn::Terminate => break Err(()),
									HostMsgIn::UpdateSettings(settings) => {
										self.settings = settings;
									}
								}
							},
							Event::PlayerMessage(player_id, message) => {
								let Ok(message) = deserialize::<'_, PlayerMsgIn>(&message) else { continue };
								match message {
									PlayerMsgIn::StartGame => {
										if player_id != self.leader_id {
											log::warn!("non-leader player attempted to start game");
											continue;
										}
										
										if self.clients.players.len() < MIN_PLAYER_COUNT {
											let message = GlobalPlayerMsgOut::Error(&"Not enough players");
											let _ = self.clients.send_player(player_id, &message).await;
											continue;
										}
										
										/* Start the game */
										/*let _ = self.clients.send_all(
											&HostMsgOut::GameStarted,
											&PlayerMsgOut::InGame
										).await;*/
										return Ok(self.settings);
									}
								}
							},
						}
					}
				}
			}
		}
	}
	
	#[derive(Deserialize)]
	#[serde(tag = "type", content = "data")]
	#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
	enum HostMsgIn {
		Terminate,
		UpdateSettings(game::Settings)
	}
	#[derive(Serialize)]
	#[serde(tag = "type", content = "data")]
	#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
	enum HostMsgOut {
		LobbyCreated,
		PlayerJoined { player_id: PlayerId, player_name: String },
		PlayerLeft { player_id: PlayerId },
		//GameStarted
	}
	
	#[derive(Deserialize)]
	#[serde(tag = "type", content = "data")]
	#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
	enum PlayerMsgIn {
		StartGame
	}
	#[derive(Serialize, Clone)]
	#[serde(tag = "type", content = "data")]
	#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
	enum PlayerMsgOut {
		Accepted { player_id: PlayerId, token: PlayerToken },
		//Promoted,
		InLobby { promoted: bool },
		//InGame
	}
	
}

mod game {
	use super::*;
	pub type Sender = mpsc::Sender<Event>;
	pub type Receiver = mpsc::Receiver<Event>;
	
	pub enum Event {
		PlayerRejoin { socket: WebSocket, player_id: PlayerId, token: PlayerToken }
	}
	#[derive(Serialize, Deserialize)]
	#[serde(tag = "game", content = "settings")]
	#[serde(rename_all = "camelCase")]
	pub enum Settings {
		None,
		Drawblins(drawblins::Settings)
	}
}

mod timeout {
	
	use std::pin::Pin;
	use tokio::time::{sleep, Sleep, Duration};
	pub struct Timeout(pub Pin<Box<Sleep>>);
	impl Timeout {
		pub fn new(duration: Duration) -> Self {
			Self(Box::pin(sleep(duration)))
		}
		pub fn future<'a>(&'a mut self) -> &'a mut Pin<Box<Sleep>> {
			&mut self.0
		}
		pub fn remaining(&self) -> Duration {
			self.0.deadline() - tokio::time::Instant::now()
		}
		pub fn remaining_secs(&self) -> f32 {
			self.remaining().as_secs_f32()
		}
	}
}

mod drawblins {
	
	use super::*;
	use timeout::Timeout;

	const MAX_PLAYER_COUNT: usize = 8;
	const ROUND_COUNT: usize = 1;
	
	const START_DURATION: Duration = Duration::from_secs(3);
	const DRAW_DURATION: Duration = Duration::from_secs(120);
	const DRAW_AUTOSUBMIT_DURATION: Duration = Duration::from_secs(4);
	const VOTE_DURATION: Duration = Duration::from_secs(16);
	const RESULTS_DURATION: Duration = Duration::from_secs(10);
	const SCORE_DURATION: Duration = Duration::from_secs(10);
	
	const EVENT_QUEUE_SIZE: usize = 2;
	
	enum State {
		Start,
		Draw { submitted: [bool; MAX_PLAYER_COUNT] },
		Vote { eligible: [bool; MAX_PLAYER_COUNT], votes: [Option<PlayerId>; MAX_PLAYER_COUNT] },
		Results,
		Score,
		Terminated(Result<(), ()>)
	}
	pub struct Game<'a> {
		receiver: game::Receiver,
		clients: &'a mut ClientIndex,
		settings: Settings,
		state: State,
		round: usize,
		names: Box<[&'static str]>,
		timeout: Timeout
	}
	impl<'a> Game<'a> {
		
		pub fn new(clients: &'a mut ClientIndex, settings: Settings) -> (Self, game::Sender) {
			let (sender, receiver) = mpsc::channel(EVENT_QUEUE_SIZE);
			let game = Self {
				receiver,
				clients,
				settings,
				state: State::Start,
				round: 0,
				names: goblin_names::get_names(ROUND_COUNT),
				timeout: Timeout::new(START_DURATION)
			};
			(game, sender)
		}
		pub async fn run(&mut self) -> Result<(), ()> {
			
			let _ = self.clients.send_all(
				&HostMsgOut::GameStarted,
				&PlayerMsgOut::InGame
			).await;
			
			loop {
				if let State::Terminated(result) = self.state {
					break result;
				}
				
				tokio::select! {
					_ = &mut self.timeout.0 => {
						self.advance().await
					},
					event = self.receiver.recv() => {
						let Some(event) = event else { break Err(()) };
						match event {
							game::Event::PlayerRejoin { socket, player_id, token } => {
								self.handle_rejoin(socket, player_id, token).await;
							}
						}
					},
					event = self.clients.receiver.recv() => {
						use client_index::Event;
						let Some(event) = event else { break Err(()) };
						match event {
							Event::HostDisconnect => break Err(()),
							Event::PlayerDisconnect(_player_id) => {},
							Event::HostMessage(message) => {
								let Ok(message) = deserialize::<'_, HostMsgIn>(&message) else { continue };
								match message {
									HostMsgIn::Terminate => break Err(())
								}
							},
							Event::PlayerMessage(player_id, message) => {
								let Ok(message) = deserialize::<'_, PlayerMsgIn>(&message) else { continue };
								match message {
									PlayerMsgIn::DrawingSubmission { drawing } =>
										self.handle_drawing_submission(player_id, drawing).await,
									PlayerMsgIn::VoteSubmission { for_name } =>
										self.handle_vote_submission(player_id, for_name).await
								}
							},
						}
					},
					
				}
			}
			
		}
		async fn handle_rejoin(&mut self, socket: WebSocket, player_id: PlayerId, token: PlayerToken) {
			if let State::Terminated(_) = self.state {
				return;
			}
			
			let Ok(_) = self.clients.reconnect_player(socket, player_id, token).await else { return };
			
			let _ = self.clients.send_player(player_id, &PlayerMsgOut::InGame).await;
			
			let message = match self.state {
				State::Terminated(_) => return, // unreachable
				State::Start => PlayerMsgOut::Waiting(WaitingKind::Start),
				State::Draw { submitted } => {
					if let Some(true) = submitted.get(player_id as usize) {
						/* If the player has already submitted, just idle */
						PlayerMsgOut::Waiting(WaitingKind::Draw)
					} else {
						/* Otherwise, ask them to draw */
						let Some(goblin_name) = self.names.get(self.round) else {
							log::error!("no goblin name for current round: {}", self.round);
							return;
						};
						PlayerMsgOut::Drawing {
							goblin_name,
							secs_left: self.timeout.remaining_secs()
						}
					}
				},
				State::Vote { eligible, votes } => {
					if let Some(None) = votes.get(player_id as usize) {
						/* If the player hasn't voted, ask them to */
						let _ = self.clients.send_player(player_id, &PlayerMsgOut::Voting {
							choices: self.vote_choices(eligible),
							secs_left: self.timeout.remaining_secs()
						}).await;
						return;
					} else {
						/* If they have, just idle */
						PlayerMsgOut::Waiting(WaitingKind::Vote)
					}
				},
				State::Results | State::Score => {
					PlayerMsgOut::Waiting(WaitingKind::Results)
				},
			};
			let _ = self.clients.send_player(player_id, &message).await;
		}
		async fn advance(&mut self) {
			match self.state {
				State::Start => self.start_draw().await,
				State::Draw { submitted } => self.start_vote(submitted).await,
				State::Vote { eligible: _, votes: _ } => self.start_results().await,
				State::Results => self.start_score().await,
				State::Score => self.start_draw().await,
				State::Terminated(_) => {
					log::warn!("[drawblins] attempted to advance a terminated game");
				}
			}
		}
		fn vote_choices(&self, eligible: [bool; MAX_PLAYER_COUNT]) -> Box<[String]> {
			self.clients.players.iter()
				.filter_map(|(id, presence)| {
					if let Some(true) = eligible.get(id) {
						Some(presence.name.clone())
					} else {
						None
					}
				})
				.collect()
		}
		
		fn terminate(&mut self, result: Result<(), ()>) {
			self.state = State::Terminated(result);
		}
		async fn start_draw(&mut self) {
			/* Increment the round counter, unless we just started */
			if !matches!(self.state, State::Start) {
				self.round += 1;
			}
			
			let Some(&goblin_name) = self.names.get(self.round) else {
				return self.start_finale().await; // last round just ended, we're done
			};
			
			self.state = State::Draw { submitted: [false; MAX_PLAYER_COUNT] };
			self.timeout = Timeout::new(DRAW_DURATION);
			
			let _ = self.clients.send_all(
				&HostMsgOut::Drawing { goblin_name /*, secs_left*/ },
				&PlayerMsgOut::Drawing {
					goblin_name,
					secs_left: DRAW_DURATION.as_secs_f32()
				}
			).await;
		}
		async fn start_vote(&mut self, eligible: [bool; MAX_PLAYER_COUNT]) {
			self.state = State::Vote { eligible, votes: [None; MAX_PLAYER_COUNT] };
			self.timeout = Timeout::new(VOTE_DURATION);
			let _ = self.clients.send_all(
				&HostMsgOut::Voting {},
				&PlayerMsgOut::Voting {
					choices: self.vote_choices(eligible),
					secs_left: VOTE_DURATION.as_secs_f32()
				}
			).await;
		}
		async fn start_results(&mut self) {
			self.state = State::Results;
			self.timeout = Timeout::new(RESULTS_DURATION);
			//let _ = self.clients.send_host(&HostMsgOut::Results).await;
			let _ = self.clients.send_all(
				&HostMsgOut::Results,
				&PlayerMsgOut::Waiting(WaitingKind::Results)
			).await;
		}
		async fn start_score(&mut self) {
			self.state = State::Score;
			self.timeout = Timeout::new(SCORE_DURATION);
			let _ = self.clients.send_host(&HostMsgOut::Scoring).await;
			/*let _ = self.clients.send_all(
				&HostMsgOut::Scoring,
				&PlayerMsgOut::Waiting(WaitingKind::Score)
			).await;*/
		}
		async fn start_finale(&mut self) {
			self.terminate(Ok(()));
		}
		async fn handle_drawing_submission(&mut self, player_id: PlayerId, drawing: String) {
			let State::Draw { ref mut submitted } = self.state else {
				return log::debug!("received a drawing while not in drawing state [{player_id}]");
			};
			let Some(false) = submitted.get(player_id as usize) else {
				return log::debug!("duplicate drawing received [{player_id}]");
			};
			
			submitted[player_id as usize] = true;
			
			let _ = self.clients.send_host(&HostMsgOut::DrawingSubmitted {
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
			
			let Some(for_id) = self.clients.players.iter().find_map(|(id, presence)| {
				if presence.name == for_name {
					Some(id as u8)
				} else {
					None
				}
			}) else {
				return log::warn!("couldn't find player with name for vote: [{player_id} -> {for_name}]");
			};
			
			if player_id == for_id {
				return log::warn!("self vote attempted [{player_id} -> {for_id}]"); //: {}", Self::id_str(&self.id), player_id);
			}
			if !self.clients.players.contains(for_id as usize) {
				return log::warn!("attempted to vote for player that is not present [{player_id} -> {for_id}]");
			}
			let State::Vote { eligible, ref mut votes } = self.state else {
				return log::warn!("received a vote while not in voting state [{player_id} -> {for_id}]");
			};
			let Some(true) = eligible.get(player_id as usize) else {
				return log::warn!("voted for ineligible player [{player_id} -> {for_id}]");
			};
			let Some(None) = votes.get(player_id as usize) else {
				return log::warn!("duplicate vote received [{player_id} -> {for_id}]");
			};
			
			votes[player_id as usize] = Some(for_id);
			let all_submitted = self.clients.players.iter().all(|(id, _)| {
				matches!(votes.get(id), Some(Some(_)))
			});
			
			let _ = self.clients.send_host(&HostMsgOut::VoteSubmitted {
				player_id,
				for_id
			}).await;
			
			if all_submitted {
				self.advance().await;
			}
		}
		
	}
	
	#[derive(Serialize, Deserialize)]
	#[serde(rename_all = "camelCase")]
	pub struct Settings {
		//pub max_player_count: usize,
		pub round_count: usize,
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
		//LobbyCreated { join_code: &'a str },
		//PlayerDisconnected { player_id: PlayerId }
		//PlayerRejoined { player_id: PlayerId, player_name: String },
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
		Voting { choices: Box<[String]>, secs_left: f32 },
	}
	
	#[derive(Serialize, Clone)]
	#[serde(rename_all = "camelCase")]
	enum WaitingKind {
		Start,
		Draw,
		Vote,
		Results,
		Score
	}
}

mod showdown {
	
	//use super::*;
	//use timeout::Timeout;
	
	const MAX_PLAYER_COUNT: usize = 8;
	const ROUND_COUNT: usize = 3;
	
	enum State {
		Start,
		Draw { submitted: [bool; MAX_PLAYER_COUNT] }
	}
	
}

enum RoomHandle {
	Lobby(lobby::Sender),
	Game(game::Sender)
}

//type RoomHandle = mpsc::Sender<RoomEvent>;
#[derive(Clone)]
pub struct App {
	//handles: Arc<DashMap<RoomId, RoomSender>>
	rooms: Arc<DashMap<RoomId, RoomHandle>>
	//lobbies: Arc<DashMap<RoomId, lobby::Sender>>,
	//games: Arc<Dashmap<RoomId, lobby::GameId>>
}
impl App {
	
	pub fn new() -> Self {
		Self { rooms: Arc::new(DashMap::new()) }
	}
	pub fn parse_room_id(join_code: &str) -> Option<RoomId> {
		
		if join_code.len() != ROOM_ID_LEN {
			//error!("Invalid game id: {join_code}");
			return None;
		}
		
		join_code
			.as_bytes()
			.first_chunk::<ROOM_ID_LEN>()
			.map(|id| id.to_owned())
			//.and_then(move |id| self.handles.get(id))
	}
	
	
	pub fn has_room(&self, room_id: &RoomId) -> bool {
		self.rooms.contains_key(room_id)
	}
	/*pub fn has_lobby(&self, room_id: &RoomId) -> bool {
		let room = self.rooms.get()
		matches!(self.rooms.get(room_id), Some(RoomHandle::Lobby(_)))
	}*/
	fn generate_room_id(&self) -> Option<RoomId> {
		
		const ATTEMPTS: usize = 5;
		
		use rand::Rng;
		let mut rng = rand::thread_rng();
		
		for _ in 0..ATTEMPTS {
			let id = [(); 5].map(|_| ROOM_ID_CHARS[rng.gen_range(0..ROOM_ID_CHARS.len())]);
			if !self.rooms.contains_key(&id) {
				return Some(id);
			}
		}
		
		log::error!("failed to generate a valid room id (somehow)");
		None
	}
	pub async fn accept_host(&self, host_socket: WebSocket) {
		let Some(id) = self.generate_room_id() else { return };
		log::info!("[{}] Opening!", room_id_str(&id));
		self.init_room(id, host_socket).await;
		log::info!("[{}] Closed", room_id_str(&id));
	}
	async fn init_room(&self, id: RoomId, host_socket: WebSocket) {
		
		let mut clients = ClientIndex::new(host_socket, MAX_PLAYER_COUNT as PlayerId);
		let Ok(_) = clients.send_host(&GlobalHostMsgOut::Accepted {
			join_code: &room_id_str(&id)
		}).await else { return };
		
		loop {
			let settings = game::Settings::Drawblins(drawblins::Settings { round_count: 0 });
			let (lobby, handle) = lobby::Lobby::new(&mut clients, settings);//, game::Settings::None);
			self.rooms.insert(id, RoomHandle::Lobby(handle));
			//self.cl
			let Ok(settings) = lobby.run().await else { break };
			
			match settings {
				game::Settings::None => break,
				game::Settings::Drawblins(settings) => {
					let (mut game, handle) = drawblins::Game::new(&mut clients, settings);
					self.rooms.insert(id, RoomHandle::Game(handle));
					let Ok(_) = game.run().await else { break };
				}
			};
		}
		
		self.rooms.remove(&id);
		let _ = clients.send_all(
			&GlobalHostMsgOut::Terminated,
			&GlobalPlayerMsgOut::Terminated
		).await;
		clients.disconnect_all().await;
		
	}
	pub async fn accept_player_join(&self, socket: WebSocket, room_id: RoomId, name: String) {
		let Some(mut handle) = self.rooms.get_mut(&room_id) else { return; };
		let RoomHandle::Lobby(ref mut handle) = *handle else {
			return log::debug!("attempted to join a game that is already running");
		};
		let _ = handle.send(lobby::Event::PlayerJoin { socket, name }).await;
	}
	pub async fn accept_player_rejoin(&self, socket: WebSocket, room_id: RoomId, name: String, player_id: PlayerId, token: PlayerToken) {
		let Some(mut handle) = self.rooms.get_mut(&room_id) else { return; };
		
		match *handle {
			RoomHandle::Lobby(ref mut handle) => {
				let _ = handle.send(lobby::Event::PlayerJoin { socket, name }).await;
			}
			RoomHandle::Game(ref mut handle) => {
				let _ = handle.send(game::Event::PlayerRejoin { socket, player_id, token }).await;
			},
		}
	}
	
}


