






//use internment::ArcIntern;
//use log::{info, warn, error};

use std::sync::Arc;
use std::time::Instant;

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
use std::net::SocketAddr;
use axum::extract::ws::{Message, WebSocket};

use crate::types::*;
use crate::goblin_names;

//use tokio_tungstenite::WebSocketStream;
//use tokio_tungstenite::tungstenite::Message;


pub type WebSocketSender = SplitSink<WebSocket, Message>;
pub type WebSocketReceiver = SplitStream<WebSocket>;

fn serialize(value: &impl Serialize) -> Result<String, ()> {
	match serde_json::to_string(value) {
		Ok(string) => Ok(string),
		Err(err) =>	{
			log::error!("serialization error: {err}");
			Err(())
		}
	}
}
fn deserialize<'a, T: Deserialize<'a>>(str: &'a str) -> Result<T, ()> {
	match serde_json::from_str::<T>(str) {
		Ok(value) => Ok(value),
		Err(err) => {
			log::error!("deserialization error: {err}");
			Err(())
		}
	}
}
async fn next_string(receiver: &mut WebSocketReceiver) -> Option<String> {
		
	while let Some(message) = receiver.next().await {
		match message {
			Ok(Message::Text(content)) => return Some(content),
			Ok(Message::Close(_)) => {
				log::info!("WebSocket connection closed.");
				return None;
			},
			Ok(message) => {
				log::warn!("invalid websocket message: {message:?}");
				//break None;
			}
			Err(err) => {
				log::error!("websocket receive: {err}");
				return None;
			},
		}
	}
	
	None
	
}
async fn send(sender: &mut WebSocketSender, message: Message) -> Result<(), ()> {
	match sender.send(message).await {
		Ok(()) => Ok(()),
		Err(err) => {
			log::error!("websocket send: {err}");
			Err(())
		}
	}
}
async fn serialize_send(sender: &mut WebSocketSender, message: impl Serialize) -> Result<(), ()> {
	send(sender, Message::Text(serialize(&message)?)).await
}

/*fn forward(receiver: WebSocketReceiver, ) {
	
}*/
/*fn serialize_option(value: Option<&impl Serialize>) -> Option<String> {
	
}
fn deserialize_option<'a, T: Deserialize<'a>>(str: Option<&'a str>) -> Option<T> {
	str.and_then(|str| deserialize(str))
}*/

//use dashmap::mapref::one::Ref;

//


struct Presence {
	sender: WebSocketSender,
	handle: JoinHandle<()>
}
struct Host {
	presence: Presence,
}
struct Player {
	presence: Option<Presence>,
	addr: SocketAddr,
	name: String,
}
impl Presence {
	
	fn new(sender: WebSocketSender, handle: JoinHandle<()>) -> Self {
		Self { sender, handle }
	}
	async fn send(&mut self, message: Message) -> Result<(), ()> {
		send(&mut self.sender, message).await
	}
}
impl Host {
	async fn send(&mut self, message: &HostMessageOut<'_>) -> Result<(), ()> {
		serialize_send(&mut self.presence.sender, message).await
	}
}
impl Player {
	
	fn is_connected(&self) -> bool { self.presence.is_some() }
	
	async fn send_raw(&mut self, message: Message) -> Result<(), ()> {
		if let Some(ref mut presence) = self.presence {
			send(&mut presence.sender, message).await
		} else {
			Err(())
		}
	}
	async fn send(&mut self, message: &PlayerMessageOut<'_>) -> Result<(), ()> {
		self.send_raw(Message::Text(serialize(message)?)).await
	}
	async fn send_all<'a, I>(players: I, message: &PlayerMessageOut<'_>) -> Result<(), ()>
	where I: Iterator<Item=(usize, &'a mut Player)>
	{
		let message = Message::Text(serialize(message)?);
		let (_, results) = TokioScope::scope_and_block(|scope| {
			for (_, player) in players {
				scope.spawn(player.send_raw(message.clone()));
			}
		});
		
		for result in results {
			if !matches!(result, Ok(_)) {
				return Err(());
			}
		}
		
		Ok(())
	}
}




/*struct HostPresence {
	sender: WebSocketSender,
	handle: JoinHandle<()>,
}
struct PlayerPresence {
	sender: WebSocketSender,
	handle: JoinHandle<()>,
	name: String,
}
impl HostPresence {
	async fn send(presence: &mut HostPresence, message: &HostMessageOut<'_>) -> Result<(), ()> {
		serialize_send(&mut presence.sender, message).await
	}
}
impl PlayerPresence {
	
	async fn send(presence: &mut PlayerPresence, message: &PlayerMessageOut<'_>) -> Result<(), ()> {
		serialize_send(&mut presence.sender, message).await
	}
	async fn send_all<'a, I>(presences: I, message: &PlayerMessageOut<'_>) -> Result<(), ()>
	where I: Iterator<Item=(usize, &'a mut PlayerPresence)>
	{
		let message = Message::Text(serialize(message)?);
		let (_, results) = TokioScope::scope_and_block(|scope| {
			for (_, presence) in presences {
				scope.spawn(send(&mut presence.sender, message.clone()));
			}
		});
		
		for result in results {
			if !matches!(result, Ok(Ok(_))) {
				return Err(());
			}
		}
		
		Ok(())
	}
	
	/*fn as_remote() -> RemotePlayer {
		RemotePlayer {
			id: self.id,
		}
	}*/
	
}*/


enum TimeoutKind {
	Start,
	Draw,
	DrawAutoSubmit,
	Vote,
	Score
}
enum RoomEvent {
	Terminate,
	Timeout { kind: TimeoutKind },
	HostMessage { message: HostMessageIn },
	PlayerJoin { socket: Box<WebSocket>, addr: SocketAddr, name: String },
	PlayerDisconnect { player_id: PlayerId },
	PlayerMessage { player_id: PlayerId, message: PlayerMessageIn }
}

enum RoomState {
	Lobby { vip_id: u8 },
	Start,
	Draw { submitted: [bool; MAX_PLAYER_COUNT] },
	Vote { eligible: [bool; MAX_PLAYER_COUNT], votes: [Option<u8>; MAX_PLAYER_COUNT] },
	Score,
	Terminated
}
enum PlayerState {
	Idle,
	Lobby { promoted: bool },
	Drawing,
	Voting,
}

struct RoomTimeout {
	handle: tokio::task::JoinHandle<()>,
	end: Instant
}
struct Room {
	id: RoomId,
	handle: RoomHandle,
	receiver: mpsc::Receiver<RoomEvent>,
	timeout: Option<RoomTimeout>,
	
	host: Host,
	players: Slab<Player>,
	
	round: usize,
	state: RoomState,
	names: Vec<&'static str>,
}
impl Room {
	
	/*fn id_str<'a>(id: &'a RoomId) -> Result<&'a str, ()> {
		match std::str::from_utf8()
	}*/
	fn id_str<'a>(id: &'a RoomId) -> &'a str {
		unsafe { std::str::from_utf8_unchecked(id) }
	}
	
	/*fn player<'a>(&'a self, id: PlayerId) -> Option<&PlayerPresence> {
		self.players.get(id as usize)
	}
	fn player_as_remote<'a>(&'a self, id: PlayerId) -> Option<RemotePlayer> {
		self.players.get(id as usize).map(|presence| RemotePlayer {
			id,
			name: &presence.name
		})
	}*/
	
	fn is_lobby(&self) -> bool {
		matches!(self.state, RoomState::Lobby { vip_id: _ })
	}
	//fn current_name(&self) -> &String
	
	async fn listen(mut self) {
		
		let join_code = &Self::id_str(&self.id).to_owned();
		let _result = self.send_host(&HostMessageOut::LobbyCreated { join_code }).await;
		
		while let Some(event) = self.receiver.recv().await {
			
			match event {
				RoomEvent::Terminate => self.terminate(),
				RoomEvent::Timeout { kind } => self.handle_timeout(kind).await,
				RoomEvent::HostMessage { message } => self.handle_host_message(message).await,
				RoomEvent::PlayerJoin { socket, addr, name } => self.handle_join(*socket, addr, name).await,
				RoomEvent::PlayerDisconnect { player_id } => self.handle_disconnect(player_id).await,
				RoomEvent::PlayerMessage { player_id, message } => self.handle_player_message(player_id, message).await
			}
			
			if let RoomState::Terminated = self.state {
				let _ = self.send_all(
					&HostMessageOut::GameTerminated,
					&PlayerMessageOut::GameTerminated
				).await;
				
				// Not sure this is necessary
				/*self.host.presence.handle.abort();
				for player in self.players {
					player.presence.handle.abort();
				}*/
				break;
			}
			
		}
		
	}
	
	fn terminate(&mut self) {
		self.state = RoomState::Terminated;
	}
	async fn send_host(&mut self, message: &HostMessageOut<'_>) -> Result<(), ()> {
		self.host.send(message).await
	}
	async fn send_player(&mut self, id: PlayerId, message: &PlayerMessageOut<'_>) -> Result<(), ()> {
		if let Some(player) = self.players.get_mut(id as usize) {
			player.send(message).await
		} else {
			Err(())
		}
	}
	async fn send_all(&mut self, host_message: &HostMessageOut<'_>, player_message: &PlayerMessageOut<'_>) -> Result<(), ()> {
		//let iter = self.players.iter_mut();
		let results = tokio::join!(
			self.host.send(host_message),
			Player::send_all(self.players.iter_mut(), player_message)
		);
		results.0.and(results.1)
	}
	async fn send_all_except(&mut self, except_id: PlayerId, host_message: &HostMessageOut<'_>, player_message: &PlayerMessageOut<'_>) -> Result<(), ()> {
		let except_id = except_id as usize;
		let iter = self.players.iter_mut().filter(|(id, _)| *id != except_id);
		let results = tokio::join!(
			self.host.send(host_message),
			Player::send_all(iter, player_message)
		);
		results.0.and(results.1)
	}
	async fn send_all_players(&mut self, message: &PlayerMessageOut<'_>) -> Result<(), ()> {
		Player::send_all(self.players.iter_mut(), message).await
	}
	async fn send_all_players_except(&mut self, except_id: PlayerId, message: &PlayerMessageOut<'_>) -> Result<(), ()> {
		let except_id = except_id as usize;
		let iter = self.players.iter_mut().filter(|(id, _)| *id != except_id);
		Player::send_all(iter, message).await
	}
	
	async fn handle_timeout(&mut self, kind: TimeoutKind) {
		//log::info!("Timeout!");
		match (kind, &self.state) {
			(TimeoutKind::Start, RoomState::Start) => self.start_drawing().await,
			(TimeoutKind::Draw, RoomState::Draw { submitted: _ }) => self.start_drawing_autosubmit().await,
			(TimeoutKind::DrawAutoSubmit, RoomState::Draw { submitted: _ }) => self.start_voting().await,
			(TimeoutKind::Vote, RoomState::Vote { eligible: _, votes: _ }) => self.start_scoring().await,
			(TimeoutKind::Score, RoomState::Score) => self.start_drawing().await,
			_ => {}
		}
		
	}
	async fn handle_join(&mut self, socket: WebSocket, addr: SocketAddr, player_name: String) {
		
		async fn reject(mut socket: WebSocket, message: &str) {
			if let Ok(message) = serialize(&PlayerMessageOut::error(message)) {
				let _ = socket.send(Message::Text(message)).await;
			}
		}
		fn accept(socket: WebSocket, room_handle: RoomHandle, player_id: PlayerId) -> Presence {
		
			let (sender, mut rx) = socket.split();
			
			//let player_id = self.players.vacant_key() as u8;
			let handle = tokio::spawn(async move {
				while let Some(content) = next_string(&mut rx).await {
					if let Ok(message) = deserialize::<'_, PlayerMessageIn>(&content) {
						let result = room_handle.send(RoomEvent::PlayerMessage { player_id, message }).await;
						if let Err(_) = result { break; }
					}
				}
				let _ = room_handle.send(RoomEvent::PlayerDisconnect { player_id }).await;
			});
			
			Presence::new(sender, handle)
			
		}
		
		//let player = self.players.iter().find(|(_, player)| player.addr == addr);
		let RoomState::Lobby { ref mut vip_id } = self.state else {
			/* Game has already started; handle rejoin attempt */
			let player_id = {
				let player = self.players
					.iter_mut()
					//.find(|(_, player)| player.addr == addr)
					.find(|(_, player)| player.name == player_name); // hmm
				let Some((player_id, player)) = player else {
					log::debug!("join rejected; game is active");
					return reject(socket, "Game already started").await;
				};
				if player.presence.is_some() {
					log::debug!("join rejected; player is already connected");
					return reject(socket, "Already connected elsewhere").await;
				}
				
				let player_id = player_id as PlayerId;
				player.presence = Some(accept(socket, self.handle.clone(), player_id));
				player_id
			};
			
			/* Tell the rejoining player about the current game state */
			let _ = match self.state {
				RoomState::Lobby { vip_id: _ } => return,
				RoomState::Terminated => return,
				RoomState::Start =>
					self.send_player(player_id, &PlayerMessageOut::Idle { kind: IdleKind::Start }).await,
				RoomState::Score {} =>
					self.send_player(player_id, &PlayerMessageOut::Idle { kind: IdleKind::Score }).await,
				RoomState::Draw { submitted } => {
					if let Some(false) = submitted.get(player_id as usize) {
						let Some(goblin_name) = self.names.get(self.round) else {
							log::error!("no goblin name for current round");
							return;
						};
						self.send_player(player_id, &PlayerMessageOut::Drawing {
							goblin_name,
							secs_left: self.timeout_remaining().as_secs_f32()
						}).await
					} else { // already submitted
						self.send_player(player_id, &PlayerMessageOut::Idle { kind: IdleKind::Draw }).await
					}
				},
				RoomState::Vote { eligible, votes } => {
					if let Some(None) = votes.get(player_id as usize) {
						let choices = &self.vote_choices(&eligible);
						self.send_player(player_id, &PlayerMessageOut::Voting {	choices }).await
					} else { // already submitted
						self.send_player(player_id, &PlayerMessageOut::Idle { kind: IdleKind::Vote }).await
					}
				}
			};
			return;
		};
		
		/* Game has not started, handle lobby join attempt */
		if self.players.len() >= MAX_PLAYER_COUNT {
			log::debug!("join rejected; game is full");
			return reject(socket, "Game is full").await;
		}
		
		let name_collision = self.players.iter().any(|(_, player)| player.name == player_name);
		if name_collision {
			log::debug!("join rejected; name collision");
			return reject(socket, "Name is taken").await;
		}
		
		let player_id = self.players.vacant_key() as PlayerId;
		let presence = Some(accept(socket, self.handle.clone(), player_id));
		
		/* Make this player the VIP if they're the first one in */
		let promoted = self.players.is_empty();
		if promoted { *vip_id = player_id }
		
		self.players.insert(Player {
			presence,
			addr,
			name: player_name.clone(),
		});
		
		log::info!("[{}] Player Joined: {player_name}", Room::id_str(&self.id));
		let _ = self.send_player(player_id, &PlayerMessageOut::LobbyJoined { promoted }).await;
		let _result = self.send_host(&HostMessageOut::PlayerJoined {
			player_id,
			player_name
		}).await;
		
	}
	async fn handle_disconnect(&mut self, player_id: PlayerId) {
		
		if !self.players.contains(player_id as usize) {
			log::error!("handling disconnect for player that is not present");
			return;
		}
		
		if let RoomState::Lobby { vip_id } = self.state {
			/* In lobby; drop player entirely */
			drop(self.players.remove(player_id as usize));
			let _result = self.send_host(&HostMessageOut::PlayerLeft { player_id }).await;
			
			/* Choose a new VIP, if necessary (and possible) */
			if vip_id == player_id {
				let new_vip = self.players.iter().next();
				let Some((new_vip_id, _)) = new_vip else { return; };
				let new_vip_id = new_vip_id as PlayerId;
				self.state = RoomState::Lobby { vip_id: new_vip_id };
				let _ = self.send_player(
					new_vip_id,
					&PlayerMessageOut::Promoted
				).await;
			}
		} else {
			/* Not in lobby - player may rejoin; don't remove them */
			let Some(player) = self.players.get_mut(player_id as usize) else { unreachable!(); };
			let Some(presence) = Option::take(&mut player.presence) else {
				log::error!("handling disconnect for player that is already disconnected");
				return;
			};
			presence.handle.abort();
			//drop(presence);
		}
		
		/*if !self.is_lobby() && self.players.is_empty() {
			self.terminate();
			return;
		}*/
		
	}
	async fn handle_host_message(&mut self, _message: HostMessageIn) {
		
	}
	async fn handle_player_message(&mut self, player_id: PlayerId, message: PlayerMessageIn) {
		match message {
			PlayerMessageIn::StartGame {} => {
				if let RoomState::Lobby { vip_id } = self.state {
					if player_id == vip_id {
						if self.players.len() >= MIN_PLAYER_COUNT {
							self.start_game().await;
						} else {
							let _ = self.send_player(player_id, &PlayerMessageOut::error("Not enough players")).await;
						}
					}
				}
			},
			PlayerMessageIn::DrawingSubmission { drawing } =>
				self.handle_drawing_submission(player_id, &drawing).await,
			PlayerMessageIn::VoteSubmission { for_name } =>
				self.handle_vote_submission(player_id, for_name).await
		}
	}
	
	async fn handle_drawing_submission(&mut self, player_id: PlayerId, drawing: &str) {
		
		let RoomState::Draw { ref mut submitted } = self.state else {
			log::debug!("received a drawing while not in drawing state [{player_id}]");
			return;
		};
		let Some(false) = submitted.get(player_id as usize) else {
			log::debug!("duplicate drawing received [{player_id}]");
			return;
		};
		
		submitted[player_id as usize] = true;
		let all_submitted = self.players.iter().all(|(id, _)| {
			matches!(submitted.get(id), Some(true))
		});
		
		let result = self.send_host(&HostMessageOut::DrawingSubmitted {
			player_id,
			drawing
		}).await;
		match result {
			Err(_) => {}, // handle somehow?
			Ok(_) => {
				
				if all_submitted {
					self.start_voting().await;
				} else {
					// todo
				}
				
			}
		}
		
	}
	async fn handle_vote_submission(&mut self, player_id: PlayerId, for_name: String) {
		
		let Some(for_id) = self.players.iter().find_map(|(id, presence)| {
			if presence.name == for_name {
				Some(id as u8)
			} else {
				None
			}
		}) else {
			log::warn!("couldn't find player with name for vote: [{player_id} -> {for_name}]");
			return;
		};
		
		if player_id == for_id {
			log::warn!("self vote attempted [{player_id} -> {for_id}]"); //: {}", Self::id_str(&self.id), player_id);
			return;
		}
		//if !self.players.
		if !self.players.contains(for_id as usize) {
			log::warn!("attempted to vote for player that is not present [{player_id} -> {for_id}]");
			return;
		}
		
		let RoomState::Vote { eligible, ref mut votes } = self.state else {
			log::warn!("received a vote while not in voting state [{player_id} -> {for_id}]");
			return;
		};
		let Some(true) = eligible.get(player_id as usize) else {
			log::warn!("voted for ineligible player [{player_id} -> {for_id}]");
			return;
		};
		let Some(None) = votes.get(player_id as usize) else {
			log::warn!("duplicate vote received [{player_id} -> {for_id}]");
			return;
		};
		
		votes[player_id as usize] = Some(for_id);
		let all_submitted = self.players.iter().all(|(id, _)| {
			matches!(votes.get(id), Some(Some(_)))
		});
		
		let _result = self.send_host(&HostMessageOut::VoteSubmitted {
			player_id,
			for_id
		}).await; // Error check?
		
		if all_submitted {
			self.start_scoring().await;
		} else {
			// tell the client something?
		}
		
	}
	
	fn timeout_remaining(&self) -> Duration {
		if let Some(timeout) = &self.timeout {
			timeout.end - Instant::now()
		} else {
			Duration::ZERO
		}
	}
	fn set_timeout(&mut self, kind: TimeoutKind, duration: Duration) {
		let room_handle = self.handle.clone();
		let old_timeout = self.timeout.replace(RoomTimeout {
			end: Instant::now() + duration,
			handle: tokio::spawn(async move {
				tokio::time::sleep(duration).await;
				let _ = room_handle.send(RoomEvent::Timeout { kind }).await;
			}),
		});
		
		if let Some(old_timeout) = old_timeout {
			old_timeout.handle.abort();
		}
	}
	fn vote_choices(&self, eligible: &[bool]) -> Vec<String> {
		self.players
			.iter()
			.filter_map(|(id, presence)| {
				if let Some(true) = eligible.get(id) {
					Some(presence.name.clone())
				} else {
					None
				}
			})
			.collect::<Vec<_>>()
	}
	async fn start_game(&mut self) {
		self.state = RoomState::Start;
		self.set_timeout(TimeoutKind::Start, START_DURATION);
		let _ = self.send_all(
			&HostMessageOut::GameStarted,
			&PlayerMessageOut::Idle { kind: IdleKind::Start }
		).await;
		
		/*// If we've managed to already encounter an error, just terminate the game.
		if result.is_err() {
			self.terminate();
		}*/
		
	}
	async fn start_drawing(&mut self) {
		
		if !matches!(self.state, RoomState::Start) {
			self.round += 1;
		}
		
		
		
		let Some(&goblin_name) = self.names.get(self.round) else {
			self.start_finale().await; // last round just ended, we're done
			return;
		};
		
		self.state = RoomState::Draw { submitted: [false; MAX_PLAYER_COUNT] };
		self.set_timeout(TimeoutKind::Draw, DRAW_DURATION);
		
		let secs_left = DRAW_DURATION.as_secs_f32();
		let _ = self.send_all(
			&HostMessageOut::DrawingStarted { goblin_name /*, secs_left*/ },
			&PlayerMessageOut::Drawing { goblin_name, secs_left }
		).await;
		
	}
	async fn start_drawing_autosubmit(&mut self) {
		
		if !matches!(self.state, RoomState::Draw { submitted: _ }) {
			log::error!("started drawing autosubmit from a state other than draw");
			self.terminate();
			return;
		}
		
		self.set_timeout(TimeoutKind::DrawAutoSubmit, DRAW_AUTOSUBMIT_DURATION);
		let _result = self.send_all(
			&HostMessageOut::DrawingTimeout,
			&PlayerMessageOut::DrawingTimeout
		).await;
		
	}
	async fn start_voting(&mut self) {
		
		let RoomState::Draw { submitted } = self.state else {
			log::error!("starting scoring from a state other than draw");
			self.terminate();
			return;
		};
		
		let choices = &self.vote_choices(&submitted);
		self.state = RoomState::Vote { eligible: submitted, votes: [None; MAX_PLAYER_COUNT ] };
		self.set_timeout(TimeoutKind::Vote, VOTE_DURATION);
		let _result = self.send_all(
			&HostMessageOut::VotingStarted {},
			&PlayerMessageOut::Voting { choices }
		).await;
		
		
		
		// todo: do something different if nobody submitted
		//let choices = 
		
		
		
	}
	async fn start_scoring(&mut self) {
		
		let RoomState::Vote { eligible: _, votes: _ } = self.state else {
			log::error!("starting scoring from a state other than vote");
			self.terminate();
			return;
		};
		
		/*let mut vote_counts = [0; MAX_PLAYER_COUNT];
		for vote in votes {
			if let Some(vote) = vote {
				if let Some(vote_count) = vote_counts.get_mut(vote as usize) {
					*vote_count += 1;
				}
			}
		}*/
		
		self.state = RoomState::Score;
		self.set_timeout(TimeoutKind::Score, SCORE_DURATION);
		
		//let votes = votes.map(|vote| vote.unwrap_or(PlayerId::MAX));
		let _result = self.send_all(
			&HostMessageOut::ScoringStarted,
			&PlayerMessageOut::Idle { kind: IdleKind::Score },
		).await;
		
	}
	async fn start_finale(&mut self) { // todo
		self.terminate();
	}
	
}


type RoomHandle = mpsc::Sender<RoomEvent>;
#[derive(Clone)]
pub struct App {
	handles: Arc<DashMap<RoomId, RoomHandle>>
}
impl App {
	
	pub fn new() -> Self {
		Self { handles: Arc::new(DashMap::new()) }
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
	
	
	fn generate_room_id(&self) -> Option<RoomId> {
		
		const ATTEMPTS: usize = 5;
		
		use rand::Rng;
		let mut rng = rand::thread_rng();
		
		for _ in 0..ATTEMPTS {
			let id = [(); 5].map(|_| ROOM_ID_CHARS[rng.gen_range(0..ROOM_ID_CHARS.len())]);
			if !self.has_handle(&id) {
				return Some(id);
			}
		}
		
		log::error!("Couldn't generate a valid room ID.");
		None
		
	}
	
	pub fn has_handle(&self, id: &RoomId) -> bool {
		self.handles.contains_key(id)
	}
	/*fn get_handle<'a>(&'a self, id: &RoomId) -> Option<Ref<'a, RoomId, RoomHandle>> {
		self.handles.get(id)
	}*/
	
	pub async fn accept_host(&self, host_socket: WebSocket) {
		if let Some(id) = self.generate_room_id() {
			
			log::info!("[{}] Opening!", Room::id_str(&id));
			self.create_room(id, host_socket).await;
			log::info!("[{}] Closed", Room::id_str(&id)); // honestly not sure why this works
			
		}
	}
	async fn create_room(&self, id: RoomId, host_socket: WebSocket) {
		
		let (handle, receiver) = mpsc::channel::<RoomEvent>(MAX_PLAYER_COUNT);
		let (host_tx, mut host_rx) = host_socket.split();
		
		let host_handle = {
			let handle = handle.clone();
			tokio::spawn(async move {
				while let Some(content) = next_string(&mut host_rx).await {
					if let Ok(message) = deserialize::<'_, HostMessageIn>(&content) {
						let result = handle.send(RoomEvent::HostMessage { message }).await;
						if result.is_err() { break; }
					}
				}
				let _ = handle.send(RoomEvent::Terminate).await;
			})
		};
		
		self.handles.insert(id.clone(), handle.clone());
		
		Room {
			id, // No idea why we can borrow this later. Maybe await is smarter than I think?
			handle,
			receiver,
			
			host: Host { presence: Presence::new(host_tx, host_handle) },
			players: Slab::<Player>::with_capacity(MAX_PLAYER_COUNT),
			
			state: RoomState::Lobby { vip_id: 0 },
			round: 0,
			names: goblin_names::get_names(ROUND_COUNT),
			
			timeout: None
		}.listen().await;
		
		self.handles.remove(&id);
		
	}
	
	pub async fn accept_player(&self, room_id: RoomId, socket: WebSocket, addr: SocketAddr, name: String) {
		if let Some(handle) = self.handles.get(&room_id) {
			let socket = Box::new(socket);
			let _result = handle.send(RoomEvent::PlayerJoin { socket, addr, name }).await;
		}
	}
	
}


