

use super::*;
use strgen::goblin_names;

const START_TIME: Duration = Duration::from_secs(3);
const DRAW_TIME: Duration = Duration::from_secs(120);
const VOTE_TIME: DynamicDuration = DynamicDuration::from_secs(12, 2);
const SHOW_VOTES_TIME: DynamicDuration = DynamicDuration::from_secs(6, 1);
const SHOW_SCORES_TIME: DynamicDuration = DynamicDuration::from_secs(4, 1);

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
	#[serde(deserialize_with = "room::clamp_round_count")]
	round_count: usize,
	#[serde(deserialize_with = "room::clamp_time_factor")]
	draw_time_factor: f32,
	#[serde(deserialize_with = "room::clamp_time_factor")]
	vote_time_factor: f32,
	#[serde(deserialize_with = "room::clamp_time_factor")]
	score_time_factor: f32
}

#[test]
fn test() {
	let s: Settings = deserialize(r#"{
		"roundCount": 0,
		"drawTimeFactor": 0.1,
		"voteTimeFactor": -30.0,
		"scoreTimeFactor": 12.0
	}"#).unwrap();
	assert_eq!(s.round_count, 1);
	assert_eq!(s.draw_time_factor, 0.2);
	assert_eq!(s.vote_time_factor, 0.2);
	assert_eq!(s.score_time_factor, 5.0);
	println!("{}", serialize(&s).unwrap());
}

/*macro_rules! clamp {
	($func_name:ident, $t:ty, $min:literal, $max:literal) => {
		fn $func_name<'de, D: Deserializer<'de>>(deserializer: D) -> Result<$t, D::Error> {
			let val: $t = Deserialize::deserialize(deserializer)?;
			Ok(val.clamp($min, $max))
		}
	}
}*/

//clamp!(clamp_f32, f32, 0.2, 1.0);

/*macro_rules! serde_transform {
	($func_name:ident, $t:ty, $min:literal, $max:literal) => {
		fn $func_name<'de, D: Deserializer<'de>>(deserializer: D) -> Result<$t, D::Error> {
			let val: $t = Deserialize::deserialize(deserializer)?;
			Ok(val.clamp($min, $max))
		}
	}
}*/

#[derive(Deserialize)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
enum HostMsgIn {
	//Terminate
}
#[derive(Serialize)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
enum HostMsgOut<'a> {
	//GameStarted,
	
	Drawing { end_secs: u64, goblin_name: &'a str },
	Voting { end_secs: u64 },
	ShowingVotes,
	ShowingScores,
	
	DrawingSubmitted { player_id: PlayerId, drawing: &'a str },
	VoteSubmitted { player_id: PlayerId, for_id: PlayerId },
	//Finished,
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
	
	//Drawing { goblin_name: &'a str, secs_left: f32 },
	//Voting { choices: &'a [String], secs_left: f32 },
	Drawing { end_secs: u64, goblin_name: &'a str },
	Voting { end_secs: u64, choices: &'a [String] },
	
	Starting,
	DoneDrawing,
	DoneVoting,
	ShowingVotes,
	ShowingScores,
	//Finished,
}

//impl Send for PlayerMsgOut<'_> {}

enum State {
	Start,
	Draw { submitted: [bool; MAX_PLAYER_COUNT] },
	Vote { eligible: [bool; MAX_PLAYER_COUNT], choices: Box<[String]>, votes: [Option<PlayerId>; MAX_PLAYER_COUNT] },
	ShowVotes,
	ShowScores,
	
	Done(Result<(), ()>)
}
pub struct Game<'a> {
	
	clients: &'a mut ClientIndex,
	receiver: room::Receiver,
	
	settings: Settings,
	
	timeout: Timeout,
	state: State,
	round: usize,
	names: Box<[String]>
}
impl<'a> Game<'a> {
	
	pub fn new(clients: &'a mut ClientIndex, settings: Settings) -> (Self, room::Sender) {
		let (sender, receiver) = room::channel();
		let round_count = settings.round_count;
		let game = Self {
			receiver,
			clients,
			settings,
			
			timeout: Timeout::new(START_TIME),
			state: State::Start,
			round: 0,
			names: goblin_names::generate(round_count),
		};
		(game, sender)
	}
	pub async fn run(mut self) -> Result<(), ()> {
		
		/*self.clients.send_all(
			&GlobalHostMsgOut::InDrawblins,
			&GlobalPlayerMsgOut::InDrawblins
		).await;*/
		let msg = &GlobalPlayerMsgOut::InDrawblins;
		self.clients.players.send_all(msg).await;
		
		loop {
			if let State::Done(result) = self.state {
				break result;
			}
			
			tokio::select! {
				_ = &mut *self.timeout => self.advance().await,
				event = self.receiver.recv() => {
					let Some(event) = event else {
						break Err(());
					};
					match event {
						room::Event::PlayerJoin { socket: _, name: _, icon: _ } =>
							{ tracing::warn!("player attempted to join a game that is already in progress"); },
						room::Event::PlayerReconnect { socket, player_id, token, manual } =>
							{ self.handle_reconnect(socket, player_id, token, manual).await; }
					}
				},
				event = self.clients.recv() => {
					let Some(event) = event else {
						break Err(());
					};
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
	
	async fn handle_client_event(&mut self, event: (ClientId, ClientEvent)) -> Result<(), ()> {
		match event {
			(ClientId::Host, ClientEvent::Disconnect) =>
				{ return Err(()) },
			(ClientId::Player(_player_id), ClientEvent::Disconnect) =>
				{ /* ClientIndex handles player disconnects for us */ },
			(ClientId::Host, ClientEvent::Message(msg)) => {
				tracing::debug!("invalid host message: {msg}");
			},
			(ClientId::Player(player_id), ClientEvent::Message(msg)) => {
				let Ok(msg) = deserialize::<'_, PlayerMsgIn>(&msg) else {
					tracing::debug!("invalid player message: {msg}");
					return Ok(());
				};
				match msg {
					PlayerMsgIn::DrawingSubmission { drawing } =>
						self.handle_drawing_submission(player_id, drawing).await,
					PlayerMsgIn::VoteSubmission { for_name } =>
						self.handle_vote_submission(player_id, for_name).await
				}
			}
		}
		return Ok(())
	}
	async fn handle_reconnect(&mut self, socket: WebSocket, player_id: PlayerId, token: PlayerToken, manual: bool) {
		
		let result = self.clients.reconnect_player(socket, player_id, token, manual).await;
		let Ok(_) = result else { return };
		
		let msg = GlobalPlayerMsgOut::InDrawblins;
		self.clients.players.send(player_id, &msg).await;
		
		let msg = match self.state {
			State::Done(_) => return, // unreachable
			State::Start => PlayerMsgOut::Starting,
			State::ShowVotes => PlayerMsgOut::ShowingVotes,
			State::ShowScores => PlayerMsgOut::ShowingScores,
			State::Draw { submitted } => {
				if let Some(true) = submitted.get(player_id as usize) {
					/* If the player has already submitted, just idle */
					PlayerMsgOut::DoneDrawing
				} else {
					/* Otherwise, ask them to draw */
					let Some(goblin_name) = self.names.get(self.round) else {
						tracing::error!("no goblin name for current round: {}", self.round);
						return;
					};
					PlayerMsgOut::Drawing {
						end_secs: self.timeout.absolute_secs(),
						goblin_name
					}
				}
			},
			State::Vote { eligible: _, ref choices, votes } => {
				if let Some(None) = votes.get(player_id as usize) {
					/* If the player hasn't voted, ask them to */
					self.clients.players.send(player_id, &PlayerMsgOut::Voting {
						end_secs: self.timeout.absolute_secs(),
						choices
					}).await;
					return;
				} else {
					/* If they have, they should just wait */
					PlayerMsgOut::DoneVoting
				}
			},
		};
		self.clients.players.send(player_id, &msg).await;
	}
	
	async fn advance(&mut self) {
		match self.state {
			State::Start => self.start_draw().await,
			State::Draw { submitted } => self.start_vote(submitted).await,
			State::Vote { eligible: _, ref choices, votes: _ } => self.start_show_votes(choices.len()).await,
			State::ShowVotes => self.start_show_scores().await,
			State::ShowScores => {
				self.round += 1;
				self.start_draw().await;
			}
			State::Done(_) => {
				tracing::warn!("attempted to advance a finished game");
			}
		}
	}
	async fn start_draw(&mut self) {
		
		let Some(goblin_name) = self.names.get(self.round) else {
			return self.start_finale().await; // last round just ended, we're done
		};
		
		self.state = State::Draw { submitted: [false; MAX_PLAYER_COUNT] };
		
		let end_secs = self.timeout.reset_scaled(
			DRAW_TIME,
			self.settings.draw_time_factor
		);
		
		self.clients.send_all(
			&PlayerMsgOut::Drawing { end_secs, goblin_name },
			&HostMsgOut::Drawing { end_secs, goblin_name },
		).await;
	}
	async fn start_vote(&mut self, eligible: [bool; MAX_PLAYER_COUNT]) {
		
		let choices = self.vote_choices(eligible);
		if choices.is_empty() {
			// if nobody submitted a drawing, just end the game?
			// for now we skip to results instead
			//self.state = State::Done(Ok(()));
			self.start_show_votes(0).await;
			return;
		}
		
		let end_secs = self.timeout.reset_dynamic_scaled(
			VOTE_TIME,
			choices.len(),
			self.settings.vote_time_factor
		);
		
		self.clients.send_all(
			&PlayerMsgOut::Voting { end_secs, choices: &choices },
			&HostMsgOut::Voting { end_secs },
		).await;
		self.state = State::Vote { eligible, choices, votes: [None; MAX_PLAYER_COUNT] };	
	}
	async fn start_show_votes(&mut self, choice_count: usize) {
		
		self.state = State::ShowVotes;
		self.timeout.reset_dynamic(
			SHOW_VOTES_TIME,
			choice_count
		);
		
		self.clients.send_all(
			&PlayerMsgOut::ShowingVotes,
			&HostMsgOut::ShowingVotes
		).await;
	}
	async fn start_show_scores(&mut self) {
		
		self.state = State::ShowScores;
		self.timeout.reset_dynamic_scaled(
			SHOW_SCORES_TIME,
			self.clients.player_count(),
			self.settings.score_time_factor
		);
		
		self.clients.send_all(
			&PlayerMsgOut::ShowingScores,
			&HostMsgOut::ShowingScores
		).await;
	}
	async fn start_finale(&mut self) {
		self.state = State::Done(Ok(()));
	}
	async fn handle_drawing_submission(&mut self, player_id: PlayerId, drawing: String) {
		let State::Draw { ref mut submitted } = self.state else {
			tracing::debug!("received a drawing while not in drawing state [{player_id}]");
			return;
		};
		let Some(false) = submitted.get(player_id as usize) else {
			tracing::debug!("duplicate drawing received [{player_id}]");
			return;
		};
		
		submitted[player_id as usize] = true;
		
		self.clients.host.send(&HostMsgOut::DrawingSubmitted {
			player_id,
			drawing: &drawing
		}).await;
		
		let all_submitted = self.clients.players
			.ids()
			.all(|id| matches!(submitted.get(id as usize), Some(true)));
		if all_submitted {
			self.advance().await;
		}
	}
	async fn handle_vote_submission(&mut self, player_id: PlayerId, for_name: String) {
		
		let for_id = self.clients.players.id_from_name(&for_name);
		
		let Some(for_id) = for_id else {
			tracing::warn!("couldn't find player with name for vote: [{player_id} -> {for_name}]");
			return;
		};
		if player_id == for_id {
			tracing::warn!("self vote attempted [{player_id} -> {for_id}]"); //: {}", Self::id_str(&self.id), player_id);
			return;
		}
		/*if !self.clients.players.contains(for_id as usize) {
			//tracing::warn!("attempted to vote for player that is not present [{player_id} -> {for_id}]");
			tracing::error!("voting error");
			return;
		}*/
		let State::Vote { ref eligible, ref choices, ref mut votes } = self.state else {
			tracing::warn!("received a vote while not in voting state [{player_id} -> {for_id}]");
			return;
		};
		let Some(true) = eligible.get(for_id as usize) else {
			tracing::warn!("voted for ineligible player [{player_id} -> {for_id}]");
			return;
		};
		let Some(None) = votes.get(player_id as usize) else {
			tracing::warn!("duplicate or invalid vote received [{player_id} -> {for_id}]");
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
		
		self.clients.host.send(&HostMsgOut::VoteSubmitted {
			player_id,
			for_id
		}).await;
		
		if all_voted {
			self.advance().await;
		}
	}
}
