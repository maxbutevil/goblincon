





use std::sync::Arc;

use slab::Slab;
use dashmap::DashMap;

use futures_util::{
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
use client_index::ClientIndex;

//use tokio_tungstenite::WebSocketStream;
//use tokio_tungstenite::tungstenite::Message;


pub type WebSocketSender = SplitSink<WebSocket, Message>;
pub type WebSocketReceiver = SplitStream<WebSocket>;




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
			Ok(Message::Ping(_)) => {
				/* Ignore these, tungstenite handles them */
			},
			Ok(Message::Close(_)) => {
				log::debug!("websocket connection closed");
				return None;
			},
			Ok(message) => {
				log::warn!("invalid websocket message: {message:?}");
			},
			Err(err) => {
				log::error!("{err}");
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
			log::warn!("{err}");
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
	async fn send(&mut self, message: &impl Serialize) -> Result<(), ()> {
		if self.is_connected() {
			send(&mut self.sender, message).await
		} else {
			Err(())
		}
	}
}
impl Host {
	async fn send(&mut self, message: &impl Serialize) -> Result<(), ()> {
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
	async fn send(&mut self, message: &impl Serialize) -> Result<(), ()> {
		send(&mut self.presence.sender, message).await
	}
}

use std::pin::Pin;
use tokio::time::{sleep, Sleep, Duration};
struct Timeout(pub Pin<Box<Sleep>>);
impl Timeout {
	fn new(duration: Duration) -> Self {
		Self(Box::pin(sleep(duration)))
	}
	fn replace(&mut self, duration: Duration) {
		self.0.set(sleep(duration));
	}
	fn scaled(duration: Duration, scale_setting: f32) -> Duration {
		Duration::from_secs_f32(scale_setting * duration.as_secs_f32())
	}
	fn variable(duration: VariableDuration, scale_factor: usize) -> Duration {
		Duration::from_millis(duration.millis(scale_factor))
	}
	fn variable_scaled(duration: VariableDuration, scale_factor: usize, scale_setting: f32) -> Duration {
		let millis = (duration.millis(scale_factor) as f32) * scale_setting;
		//log::debug!("{} | {}")
		Duration::from_millis(millis as u64)
	}
	
	fn remaining(&self) -> Duration {
		self.0.deadline() - tokio::time::Instant::now()
	}
	fn remaining_secs(&self) -> f32 {
		self.remaining().as_secs_f32()
	}
	fn future<'a>(&'a mut self) -> &'a mut Pin<Box<Sleep>> {
		&mut self.0
	}
	
}

/* A duration that varies based on the number of players present */
struct VariableDuration {
	base_millis: u64,
	scaled_millis: u64
}
impl VariableDuration {
	const fn from_secs(base_secs: u64, scaled_secs: u64) -> Self {
		Self::from_millis(base_secs * 1000, scaled_secs * 1000)
	}
	const fn from_millis(base_millis: u64, scaled_millis: u64) -> Self {
		Self { base_millis, scaled_millis }
	}
	const fn secs(&self, scale_factor: usize) -> u64 {
		self.millis(scale_factor).div_ceil(1000)
	}
	const fn millis(&self, scale_factor: usize) -> u64 {
		self.base_millis + (scale_factor as u64) * self.scaled_millis
	}
	/*const fn duration(&self, scale_factor: usize) -> Duration {
		Duration::from_millis(self.millis(scale_factor))
	}
	const fn duration_scaled(&self, scale_factor: usize, scale_setting: f32) {
		
	}*/
	/*fn build_timeout(&self, scale_factor: u64, scale_setting: f32) -> Timeout {
		let millis = (self.millis(scale_factor) as f32) * scale_setting
		let duration = Duration::from_millis(self.millis(scale_factor) * scale_setting);
		
		//Timeout::from_secs(((self.secs(scale_factor) as f32) * scale_setting))
	}*/
}

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
		pub async fn send_host(&mut self, message: &impl Serialize) -> Result<(), ()> {
			self.host.send(message).await
		}
		pub async fn send_player(&mut self, id: PlayerId, message: &impl Serialize) -> Result<(), ()> {
			if let Some(player) = self.players.get_mut(id as usize) {
				player.send(message).await
			} else {
				log::error!("attempted to send to nonexistent player");
				Err(())
			}
		}
		//pub async fn send_host_and_player(&mut self, player_id: PlayerId)
		pub async fn send_all(&mut self, host_message: &impl Serialize, player_message: &impl Serialize) -> Result<(), ()> {
			let results = tokio::join!(
				self.host.send(host_message),
				Self::send_players(self.players.iter_mut(), player_message)
			);
			results.0.and(results.1)
		}
		pub async fn send_all_except(&mut self, except_id: PlayerId, host_message: &impl Serialize, player_message: &impl Serialize) -> Result<(), ()> {
			let results = tokio::join!(
				self.host.send(host_message),
				Self::send_players_except(self.players.iter_mut(), except_id, player_message)
			);
			results.0.and(results.1)
		}
		pub async fn send_all_players(&mut self, message: &impl Serialize) -> Result<(), ()> {
			Self::send_players(self.players.iter_mut(), message).await
		}
		pub async fn send_all_players_except(&mut self, except_id: PlayerId, message: &impl Serialize) -> Result<(), ()> {
			Self::send_players_except(self.players.iter_mut(), except_id, message).await
		}
		async fn send_players<'a, I>(players: I, message: &impl Serialize) -> Result<(), ()>
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
		async fn send_players_except<'a, I>(players: I, except_id: PlayerId, message: &impl Serialize) -> Result<(), ()>
		where I: Iterator<Item=(usize, &'a mut Box<Player>)> {
			let iter = players.enumerate()
				.filter(|(id, _)| *id as PlayerId != except_id)
				.map(|(_, player)| player);
			Self::send_players(iter, message).await
		}
	}
	
}
mod lobby {
	
	use super::*;
	
	const EVENT_QUEUE_SIZE: usize = 2;
	
	pub type Sender = mpsc::Sender<Event>;
	type Receiver = mpsc::Receiver<Event>;
	
	#[derive(Deserialize)]
	#[serde(tag = "type", content = "data")]
	#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
	enum HostMsgIn {
		Terminate,
		//UpdateSettings(game::Settings)
		StartGame(game::Settings)
	}
	#[derive(Serialize)]
	#[serde(tag = "type", content = "data")]
	#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
	enum HostMsgOut {
		InLobby,
		//LobbyCreated,
		PlayerJoined { player_id: PlayerId, player_name: String },
		PlayerLeft { player_id: PlayerId },
		GameStarting,
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
	
	pub enum Event {
		PlayerJoin { socket: WebSocket, name: String }
	}
	enum State {
		//New,
		Open { leader_id: PlayerId },
		Starting
	}
	
	pub struct Lobby<'a> {
		//id: RoomId,
		pub clients: &'a mut ClientIndex,
		//pub settings: &'a mut game::Settings,
		receiver: Receiver,
		//timeout: Timeout,
		state: State
		//leader_id: PlayerId,
	}
	impl<'a> Lobby<'a> {
		pub fn new(clients: &'a mut ClientIndex/*, settings: &'a mut game::Settings*/) -> (Self, Sender) {
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
				let _ = self.clients.send_host(&HostMsgOut::InLobby).await;
			} else {
				let leader_id = self.new_leader_id();
				self.state = State::Open { leader_id };
				let _ = self.clients.send_all_except(
					leader_id,
					&HostMsgOut::InLobby,
					&PlayerMsgOut::InLobby { promoted: false }
				).await;
				let _ = self.clients.send_player(
					leader_id,
					&PlayerMsgOut::InLobby { promoted: true }
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
								
								let State::Open { ref mut leader_id } = self.state else {
									log::debug!("player attempted to join lobby while not open");
									continue;
								};
								
								let result = self.clients.connect_player(socket, name.clone()).await;
								let Ok((player_id, token)) = result else { continue };
								
								/* If we don't have a leader, make this player the leader */
								if !self.clients.players.contains(*leader_id as usize) {
									*leader_id = player_id;
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
									promoted: *leader_id == player_id
								}).await;
							}
						}
					},
					event = self.clients.recv() => {
						use client_index::Event;
						let Some(event) = event else { break Err(()); };
						match event {
							Event::HostDisconnect => break Err(()),
							Event::PlayerDisconnect(player_id) => {
								let State::Open { leader_id } = self.state else {
									log::debug!("player disconnected from lobby while not open");
									continue;
								};
								
								self.clients.remove_player(player_id).await;
								let _ = self.clients.send_host(&HostMsgOut::PlayerLeft { player_id }).await;
								
								/* If the leader left, promote someone else */
								if player_id == leader_id && !self.clients.players.is_empty() {
									let leader_id = self.new_leader_id();
									self.state = State::Open { leader_id };
									let _ = self.clients.send_player(leader_id, &PlayerMsgOut::InLobby {
										promoted: true
									}).await;
								}
							},
							Event::HostMessage(message) => {
								let Ok(message) = deserialize::<'_, HostMsgIn>(&message) else { continue };
								match message {
									HostMsgIn::Terminate => break Err(()),
									HostMsgIn::StartGame(settings) => {
										let State::Starting = self.state else {
											log::warn!("host attempted to start game for lobby in invalid state");
											continue;
										};
										
										break Ok(settings);
									}
								}
							},
							Event::PlayerMessage(player_id, message) => {
								let Ok(message) = deserialize::<'_, PlayerMsgIn>(&message) else { continue };
								match message {
									PlayerMsgIn::StartGame => {
										let State::Open { leader_id } = self.state else {
											log::debug!("attempted to start game for lobby in invalid state");
											continue;
										};
										
										if player_id != leader_id {
											log::warn!("non-leader player attempted to start game");
											continue;
										}
										
										if self.clients.players.len() < MIN_PLAYER_COUNT {
											let message = GlobalPlayerMsgOut::Error(&"Not enough players");
											let _ = self.clients.send_player(player_id, &message).await;
											continue;
										}
										
										/* Start the game */
										self.state = State::Starting;
										let _ = self.clients.send_host(&HostMsgOut::GameStarting).await;
										//return Ok(());
									}
								}
							},
						}
					}
				}
			}
		}
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
		//None,
		Drawblins(drawblins::Settings)
	}
}

mod drawblins {
	
	use super::*;
	
	const EVENT_QUEUE_SIZE: usize = 2;

	const MAX_PLAYER_COUNT: usize = 12;
	//const ROUND_COUNT: usize = 1;
	const START_DURATION: Duration = Duration::from_secs(3);
	const DRAW_DURATION: Duration = Duration::from_secs(150);
	//const DRAW_DURATION: Duration = Duration::from_secs(120);
	//const DRAW_AUTOSUBMIT_DURATION: Duration = Duration::from_secs(5);
	//const VOTE_DURATION: Duration = Duration::from_secs(16);
	const VOTE_DURATION: VariableDuration = VariableDuration::from_secs(12, 2);
	const RESULTS_DURATION: VariableDuration = VariableDuration::from_secs(8, 1);
	const SCORE_DURATION: Duration = Duration::from_secs(10);
	
	
	#[derive(Serialize, Deserialize)]
	#[serde(rename_all = "camelCase")]
	pub struct Settings {
		//pub max_player_count: usize,
		// final round bonus?
		pub round_count: usize,
		pub draw_time_factor: f32,
		pub vote_time_factor: f32,
		//pub score_time_factor: f64
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
		Terminated(Result<(), ()>)
	}
	pub struct Game<'a> {
		
		clients: &'a mut ClientIndex,
		//settings: &'a mut Settings,
		settings: Settings,
		receiver: game::Receiver,
		state: State,
		round: usize,
		names: Box<[&'static str]>,
		timeout: Timeout
	}
	impl<'a> Game<'a> {
		
		pub fn new(clients: &'a mut ClientIndex, settings: Settings) -> (Self, game::Sender) {
			let (sender, receiver) = mpsc::channel(EVENT_QUEUE_SIZE);
			let round_count = settings.round_count;
			let game = Self {
				receiver,
				clients,
				settings,
				state: State::Start,
				round: 0,
				names: goblin_names::generate(round_count),
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
					_ = &mut self.timeout.future() => {
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
					event = self.clients.recv() => {
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
				State::Vote { eligible: _, ref choices, votes } => {
					if let Some(None) = votes.get(player_id as usize) {
						/* If the player hasn't voted, ask them to */
						//let choices = &*choices;
						let _ = self.clients.send_player(player_id, &PlayerMsgOut::Voting {
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
			let _ = self.clients.send_player(player_id, &message).await;
		}
		async fn advance(&mut self) {
			match self.state {
				State::Start => self.start_draw().await,
				State::Draw { submitted } => self.start_vote(submitted).await,
				State::Vote { eligible: _, ref choices, votes: _ } => self.start_results(choices.len()).await,
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
			self.timeout.replace(Timeout::scaled(DRAW_DURATION, self.settings.draw_time_factor));
			
			let _ = self.clients.send_all(
				&HostMsgOut::Drawing { goblin_name /*, secs_left*/ },
				&PlayerMsgOut::Drawing {
					goblin_name,
					secs_left: self.timeout.remaining_secs()
				}
			).await;
		}
		async fn start_vote(&mut self, eligible: [bool; MAX_PLAYER_COUNT]) {
			let choices = self.vote_choices(eligible);
			self.timeout.replace(Timeout::variable_scaled(VOTE_DURATION, choices.len(), self.settings.vote_time_factor));
			let _ = self.clients.send_all(
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
			self.timeout.replace(Timeout::variable(RESULTS_DURATION, choice_count));
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
			let State::Vote { eligible, choices: _, ref mut votes } = self.state else {
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
	
	
}

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

enum RoomHandle {
	Lobby(lobby::Sender),
	Game(game::Sender)
}

//type RoomHandle = mpsc::Sender<RoomEvent>;
#[derive(Clone)]
pub struct App {
	rooms: Arc<DashMap<RoomId, RoomHandle>>
}
impl App {
	
	pub fn new() -> Self {
		Self { rooms: Arc::new(DashMap::new()) }
	}
	
	pub fn has_room(&self, room_id: &RoomId) -> bool {
		self.rooms.contains_key(room_id)
	}
	fn generate_room_id(&self) -> Option<RoomId> {
		
		const ATTEMPTS: usize = 5;
		
		for _ in 0..ATTEMPTS {
			let id = RoomId::generate();
			if !self.rooms.contains_key(&id) {
				return Some(id);
			}
		}
		
		log::error!("failed to generate a valid room id (somehow)");
		None
	}
	pub async fn accept_host(&self, host_socket: WebSocket) {
		let Some(id) = self.generate_room_id() else { return };
		log::info!("[{}] Opening!", id.as_str());
		self.init_room(id, host_socket).await;
		log::info!("[{}] Closed", id.as_str());
	}
	async fn init_room(&self, id: RoomId, host_socket: WebSocket) {
		
		let mut clients = ClientIndex::new(host_socket, MAX_PLAYER_COUNT as PlayerId);
		//let mut settings = game::Settings::None;
		let Ok(_) = clients.send_host(&GlobalHostMsgOut::Accepted {
			join_code: id.as_str()
		}).await else { return };
		
		loop {
			//let settings = game::Settings::Drawblins(drawblins::Settings { round_count: 0 });
			let (lobby, handle) = lobby::Lobby::new(&mut clients); //, game::Settings::None);
			self.rooms.insert(id, RoomHandle::Lobby(handle));
			let Ok(settings) = lobby.run().await else { break };
			
			match settings {
				game::Settings::Drawblins(settings) => {
					let (mut game, handle) = drawblins::Game::new(&mut clients, settings);
					self.rooms.insert(id, RoomHandle::Game(handle));
					let Ok(_) = game.run().await else { break };
				},
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
		let Some(handle) = self.rooms.get_mut(&room_id) else { return; };
		
		match *handle {
			RoomHandle::Lobby(ref handle) => {
				let _ = handle.send(lobby::Event::PlayerJoin { socket, name }).await;
			}
			RoomHandle::Game(ref handle) => {
				let _ = handle.send(game::Event::PlayerRejoin { socket, player_id, token }).await;
			},
		}
	}
	
}


