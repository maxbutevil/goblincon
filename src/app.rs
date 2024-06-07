






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
			log::error!("Serialization error: {err}");
			Err(())
		}
	}
}
fn deserialize<'a, T: Deserialize<'a>>(str: &'a str) -> Result<T, ()> {
	match serde_json::from_str::<T>(str) {
		Ok(value) => Ok(value),
		Err(err) => {
			log::error!("Deserialization error: {err}");
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
				log::warn!("Invalid WebSocket message: {message:?}");
				//break None;
			}
			Err(err) => {
				log::error!("WebSocket receive: {err}");
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

/*fn forward(receiver: WebSocketReceiver, ) {
	
}*/
/*fn serialize_option(value: Option<&impl Serialize>) -> Option<String> {
	
}
fn deserialize_option<'a, T: Deserialize<'a>>(str: Option<&'a str>) -> Option<T> {
	str.and_then(|str| deserialize(str))
}*/

//use dashmap::mapref::one::Ref;

//


struct HostPresence {
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
		send(&mut presence.sender, Message::Text(serialize(message)?)).await
	}
}
impl PlayerPresence {
	async fn send(presence: &mut PlayerPresence, message: &PlayerMessageOut<'_>) -> Result<(), ()> {
		send(&mut presence.sender, Message::Text(serialize(message)?)).await
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
	
}


enum TimeoutKind {
	Start,
	Draw,
	Vote,
	Score
}
enum RoomEvent {
	Terminate,
	Timeout { kind: TimeoutKind },
	HostMessage { message: HostMessageIn },
	PlayerJoin { socket: Box<WebSocket>, name: String },
	PlayerDrop { player_id: PlayerId },
	PlayerMessage { player_id: PlayerId, message: PlayerMessageIn }
}

enum RoomState {
	Lobby { vip_id: u8 },
	Start,
	Draw { submitted: [bool; MAX_PLAYER_COUNT] },
	Vote { votes: [Option<u8>; MAX_PLAYER_COUNT] },
	Score,
	Terminated
}

struct Room {
	id: RoomId,
	handle: RoomHandle,
	receiver: mpsc::Receiver<RoomEvent>,
	
	host: HostPresence,
	players: Slab<PlayerPresence>,
	
	round: usize,
	state: RoomState,
	names: Vec<&'static str>,
	
	timeout: Option<tokio::task::JoinHandle<()>>
	
}
impl Room {
	
	/*fn id_str<'a>(id: &'a RoomId) -> Result<&'a str, ()> {
		match std::str::from_utf8()
	}*/
	fn id_str<'a>(id: &'a RoomId) -> &'a str {
		unsafe { std::str::from_utf8_unchecked(id) }
	}
	
	/*fn vip_id(&self) -> Option<PlayerId> {
		for (id, _) in self.players.iter() {
			return Some(id as u8);
		}
		None
	}*/
	fn set_vip_id() {
		
	}
	fn get_player<'a>(&'a self, id: PlayerId) -> Option<&PlayerPresence> {
		self.players.get(id as usize)
	}
	
	async fn listen(mut self) {
		
		let join_code = &Self::id_str(&self.id).to_owned();
		let _result = self.send_host(&HostMessageOut::LobbyCreated { join_code }).await;
		//if let Err()
		
		
		while let Some(event) = self.receiver.recv().await {
			
			match event {
				RoomEvent::Terminate => self.terminate(),
				RoomEvent::Timeout { kind } => self.handle_timeout(kind).await,
				RoomEvent::HostMessage { message } => self.handle_host_message(message).await,
				RoomEvent::PlayerJoin { socket, name } => self.handle_join(*socket, name).await,
				RoomEvent::PlayerDrop { player_id } => self.handle_drop(player_id).await,
				RoomEvent::PlayerMessage { player_id, message } => self.handle_player_message(player_id, message).await
			}
			
			if let RoomState::Terminated = self.state {
				
				let _ = self.send_all(
					&HostMessageOut::GameTerminated,
					&PlayerMessageOut::GameTerminated
				).await;
				
				self.host.handle.abort();
				for (_, player) in self.players {
					player.handle.abort();
				}
				break;
				
			}
			
		}
		
	}
	
	fn terminate(&mut self) {
		self.state = RoomState::Terminated;
	}
	async fn send_host(&mut self, message: &HostMessageOut<'_>) -> Result<(), ()> {
		HostPresence::send(&mut self.host, message).await
	}
	async fn send_player(&mut self, id: PlayerId, message: &PlayerMessageOut<'_>) -> Result<(), ()> {
		if let Some(player) = self.players.get_mut(id as usize) {
			PlayerPresence::send(player, message).await
		} else {
			Err(())
		}
	}
	async fn send_all(&mut self, host_message: &HostMessageOut<'_>, player_message: &PlayerMessageOut<'_>) -> Result<(), ()> {
		//let iter = self.players.iter_mut();
		let results = tokio::join!(
			HostPresence::send(&mut self.host, host_message),
			PlayerPresence::send_all(self.players.iter_mut(), player_message)
		);
		match results {
			(Ok(()), Ok(())) => Ok(()),
			_ => Err(())
		}
	}
	async fn send_all_except(&mut self, except_id: PlayerId, host_message: &HostMessageOut<'_>, player_message: &PlayerMessageOut<'_>) -> Result<(), ()> {
		let except_id = except_id as usize;
		let iter = self.players.iter_mut().filter(|(id, _)| *id != except_id);
		let results = tokio::join!(
			HostPresence::send(&mut self.host, host_message),
			PlayerPresence::send_all(iter, player_message)
		);
		match results {
			(Ok(()), Ok(())) => Ok(()),
			_ => Err(())
		}
	}
	async fn send_all_players(&mut self, message: &PlayerMessageOut<'_>) -> Result<(), ()> {
		PlayerPresence::send_all(self.players.iter_mut(), message).await
	}
	async fn send_all_players_except(&mut self, except_id: PlayerId, message: &PlayerMessageOut<'_>) -> Result<(), ()> {
		let except_id = except_id as usize;
		let iter = self.players.iter_mut().filter(|(id, _)| *id != except_id);
		PlayerPresence::send_all(iter, message).await
	}
	
	async fn handle_timeout(&mut self, kind: TimeoutKind) {
		
		//log::info!("Timeout!");
		
		match (kind, &self.state) {
			(TimeoutKind::Start, RoomState::Start) => self.start_drawing().await,
			(TimeoutKind::Draw, RoomState::Draw { submitted: _ }) => self.start_voting().await,
			(TimeoutKind::Vote, RoomState::Vote { votes: _ }) => self.start_scoring().await,
			(TimeoutKind::Score, RoomState::Score) => self.start_drawing().await,
			_ => {}
		}
		
	}
	async fn handle_join(&mut self, socket: WebSocket, player_name: String) {
		
		if let RoomState::Lobby { ref mut vip_id } = self.state {
			
			if self.players.len() == self.players.capacity() {
				return; // room is full
			}
			
			let (sender, mut rx) = socket.split();
			let player_id = self.players.vacant_key() as u8;
			
			let room_handle = self.handle.clone();
			let player_handle = tokio::spawn(async move {
				while let Some(content) = next_string(&mut rx).await {
					if let Ok(message) = deserialize::<'_, PlayerMessageIn>(&content) {
						let result = room_handle.send(RoomEvent::PlayerMessage { player_id, message }).await;
						if let Err(_) = result { return; }
					}
				}
				let _ = room_handle.send(RoomEvent::PlayerDrop { player_id }).await;
			});
			
			self.players.insert(PlayerPresence {
				sender,
				handle: player_handle,
				name: player_name.clone(),
			});
			
			/* Make this player the VIP, if they're the first one in */
			if self.players.len() == 1 {
				*vip_id = player_id;
				let _ = self.send_player(player_id, &PlayerMessageOut::Promoted).await;
			}
			
			log::info!("[{}] Player Joined: {player_name}", Room::id_str(&self.id));
			let _result = self.send_host(&HostMessageOut::PlayerJoined {
				player_id,
				player_name
			}).await;
			
		} else {
			
		} // log or something?
		
		
		
	}
	async fn handle_drop(&mut self, player_id: PlayerId) {
		//self.players.contains(id) 
		self.players.remove(player_id as usize);
		
		/* Choose a new VIP, if necessary (and possible) */
		if let RoomState::Lobby { ref mut vip_id } = self.state {
			if *vip_id == player_id {
				
				let new_vip = self.players
					.iter()
					.next();
				
				if let Some((new_vip_id, _)) = new_vip {
					*vip_id = new_vip_id as u8;
					let _ = self.send_player(
						new_vip_id as u8,
						&PlayerMessageOut::BecameVIP
					).await;
				}
				
			}
		}
		
		//self.send_host(&HostMessageOut::PlayerLeft);
		
	}
	async fn handle_host_message(&mut self, _message: HostMessageIn) {
		
	}
	async fn handle_player_message(&mut self, player_id: PlayerId, message: PlayerMessageIn) {
		match message {
			PlayerMessageIn::StartGame {} => {
				if let RoomState::Lobby { vip_id } = self.state {
					if player_id == vip_id {
						self.start_game().await;
					}
				}
			},
			PlayerMessageIn::DrawingSubmission { drawing } =>
				self.handle_drawing_submission(player_id, &drawing).await,
			PlayerMessageIn::VoteSubmission { for_id } =>
				self.handle_vote_submission(player_id, for_id).await
		}
	}
	
	async fn handle_drawing_submission(&mut self, player_id: PlayerId, drawing: &str) {
		
		if let RoomState::Draw { mut submitted } = self.state {
			if let Some(false) = submitted.get(player_id as usize) {
				
				submitted[player_id as usize] = true;
				let all_submitted = self.players.iter().all(|(id, _)| {
					matches!(submitted.get(id), Some(true))
				});
				
				let result = self.send_host(&HostMessageOut::DrawingSubmitted {
					player_id,
					drawing
				}).await;
				match result {
					Err(_) => {},
					Ok(_) => {
						
						if all_submitted {
							self.start_voting().await;
						} else {
							// todo
						}
						
					}
				}
			}
		} // log?
		
	}
	async fn handle_vote_submission(&mut self, player_id: PlayerId, for_id: PlayerId) {
		
		if player_id == for_id {
			log::warn!("[{}] Self Vote Attempted: {}", Self::id_str(&self.id), player_id);
			return;
		}
		
		if let RoomState::Vote { mut votes } = self.state {
			if let Some(None) = votes.get(player_id as usize) {
				
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
		} // log?
		
	}
	
	fn set_timeout(&mut self, kind: TimeoutKind, duration: Duration) {
		
		let handle = self.handle.clone();
		let old_timeout = self.timeout.replace(tokio::spawn(async move {
			tokio::time::sleep(duration).await;
			let _result = handle.send(RoomEvent::Timeout { kind }).await;
		}));
		
		if let Some(old_timeout) = old_timeout {
			old_timeout.abort();
		}
		
	}
	async fn start_game(&mut self) {
		self.state = RoomState::Start;
		self.set_timeout(TimeoutKind::Start, START_DURATION);
		let result = self.send_all(
			&HostMessageOut::GameStarted,
			&PlayerMessageOut::GameStarted
		).await;
		
		// If we've managed to already encounter an error, just terminate the game.
		if result.is_err() {
			self.terminate();
		}
		
		
	}
	async fn start_drawing(&mut self) {
		
		if !matches!(self.state, RoomState::Start) {
			self.round += 1;
		}
		
		self.state = RoomState::Draw { submitted: [false; MAX_PLAYER_COUNT] };
		self.set_timeout(TimeoutKind::Draw, DRAW_DURATION);
		
		let goblin_name = self.names.get(self.round).unwrap_or(&"Defaultio");
		let _result = self.send_all(
			&HostMessageOut::DrawingStarted { goblin_name },
			&PlayerMessageOut::DrawingStarted
		).await;
		
	}
	async fn start_voting(&mut self) {
		
		let choices = &{
			if let RoomState::Draw { submitted } = self.state {
				self.players.iter().filter_map(|(id, presence)| {
					if matches!(submitted.get(id), Some(true)) {
						Some(presence.name.clone())
					} else {
						None
					}
				}).collect()
			} else {
				// this shouldn't happen
				//panic!();
				todo!();
			}
		};
		
		self.state = RoomState::Vote { votes: [None; MAX_PLAYER_COUNT ] };
		self.set_timeout(TimeoutKind::Vote, VOTE_DURATION);
		
		// todo: do something different if nobody submitted
		//let choices = 
		
		
		let _result = self.send_all(
			&HostMessageOut::VotingStarted {},
			&PlayerMessageOut::VotingStarted { choices }
		).await;
	}
	async fn start_scoring(&mut self) {
		
		let mut vote_counts = [0; MAX_PLAYER_COUNT];
		if let RoomState::Vote { votes } = self.state {
			for vote in votes {
				if let Some(vote) = vote {
					if let Some(vote_count) = vote_counts.get_mut(vote as usize) {
						*vote_count += 1;
					}
				}
			}
		} else {
			// this shouldn't happen
			todo!();
		}
		
		self.state = RoomState::Score;
		self.set_timeout(TimeoutKind::Score, SCORE_DURATION);
		let _ = self.send_all(
			&HostMessageOut::ScoringStarted { vote_counts },
			&PlayerMessageOut::ScoringStarted
		).await;
		
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
						if result.is_err() {
							break;
						}
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
			host: HostPresence { sender: host_tx, handle: host_handle },
			players: Slab::<PlayerPresence>::with_capacity(MAX_PLAYER_COUNT),
			
			state: RoomState::Lobby { vip_id: 0 },
			round: 0,
			names: goblin_names::get_names(ROUND_COUNT),
			
			timeout: None
		}.listen().await;
		
		self.handles.remove(&id);
		
	}
	
	pub async fn accept_player(&self, socket: WebSocket, room_id: RoomId, name: String) {
		if let Some(handle) = self.handles.get(&room_id) {
			let socket = Box::new(socket);
			let _result = handle.send(RoomEvent::PlayerJoin { socket, name }).await;
		}
	}
	
	
}


/*struct ClientMap {
	senders: DashMap<ClientId, WebSocketSender>,
	//phantom: std::marker::PhantomData
}
impl ClientMap {
	
	fn new() -> Self {
		Self {
			senders: DashMap::new(),
			//phantom: std::marker::PhantomData
		}
	}
	
	fn has(&self, id: &ClientId) -> bool {
		self.senders.contains_key(id)
	}
	
	fn add(&self, id: ClientId, sender: WebSocketSender) {
		self.senders.insert(id, sender);
	}
	fn remove(&self, id: &ClientId) {
		self.senders.remove(id);
	}
	
	async fn send_string(&self, id: &ClientId, content: String) -> Result<(), ()> {
		match self.senders.get_mut(id) {
			None => {
				warn!("Attempted to send to invalid client: {id}");
				Err(())
			},
			Some(mut sender) => {
				match sender.send(Message::Text(content)).await {
					Err(_) => Err(()), // log?
					Ok(_) => Ok(())
				}
			}
		}
	}
	async fn send<M>(&self, id: &ClientId, message: &M) -> Result<(), ()>
	where M: Send + Sync + Serialize
	{
		if let Ok(string) = serialize(message) {
			self.send_string(id, string).await
		} else {
			Err(())
		}
	}
	
}*/


