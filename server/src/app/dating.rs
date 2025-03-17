
use super::*;
use strgen::bachelor_themes;

const SUITOR_COUNT: usize = 2;
const START_TIME: Duration = Duration::from_secs(3);
const DRAW_BACHELOR_TIME: Duration = Duration::from_secs(100);
const DRAW_SUITOR_TIME: Duration = Duration::from_secs(100);
const VOTE_TIME: Duration = Duration::from_secs(20);
//const NO_SUBMISSIONS_VOTE_TIME: Duration = Duration::from_secs(4);


const SHOW_VOTES_TIME: DynamicDuration = DynamicDuration::from_secs(6, 1);
const SHOW_SCORES_TIME: DynamicDuration = DynamicDuration::from_secs(6, 1);

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
	#[serde(deserialize_with = "room::clamp_round_count")]
	pub round_count: usize,
	#[serde(deserialize_with = "room::clamp_time_factor")]
	pub bachelor_draw_time_factor: f32,
	#[serde(deserialize_with = "room::clamp_time_factor")]
	pub suitor_draw_time_factor: f32,
	#[serde(deserialize_with = "room::clamp_time_factor")]
	pub vote_time_factor: f32,
	#[serde(deserialize_with = "room::clamp_time_factor")]
	pub score_time_factor: f32,
}

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
	/* State Sync */
	DrawingBachelors { theme: &'a str },
	DrawingSuitors,
	Voting { bachelor_id: PlayerId },
	ShowingVotes,
	ShowingScores,
	
	/* Events */
	BachelorSubmitted {
		player_id: PlayerId,
		drawing: &'a str,
		#[serde(skip_serializing_if = "Option::is_none")]
		name: Option<&'a str>
	},
	SuitorSubmitted {
		player_id: PlayerId,
		bachelor_id: PlayerId,
		drawing: &'a str,
		#[serde(skip_serializing_if = "Option::is_none")]
		name: Option<&'a str>
	},
	VoteSubmitted { player_id: PlayerId, for_id: PlayerId },
}

#[derive(Deserialize)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
enum PlayerMsgIn {
	BachelorSubmission { drawing: String, #[serde(default)] name: Option<String> },
	SuitorSubmission { bachelor_id: PlayerId, drawing: String, #[serde(default)] name: Option<String> },
	VoteSubmission { for_name: String }
}

#[derive(Serialize, Clone)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
enum PlayerMsgOut<'a> {
	
	DrawingBachelor { theme: &'a str, secs_left: f32 },
	DrawingSuitor { bachelor_id: PlayerId, bachelor_drawing: &'a str, secs_left: f32 },
	//DrawingSuitor { bachelor_drawings: &'a [&'a str], secs_left: f32 },
	//Shipping { choices: &'a [String], secs_left: f32 },
	Voting { choices: &'a [String], secs_left: f32 },
	
	ShowingVotes,
	ShowingScores,
	
	DoneDrawingBachelor,
	DoneDrawingSuitor,
	//DoneShipping,
	DoneVoting,
}

type PlayerMap<T> = [T; MAX_PLAYER_COUNT];
type VotingRound = (PlayerId, [PlayerId; SUITOR_COUNT]);
type Assignment = (PlayerId, String);
struct Assignments(Box<[Assignment]>);
impl std::ops::Deref for Assignments {
	type Target = Box<[(PlayerId, String)]>;
	fn deref(&self) -> &Self::Target { &self.0 }
}
impl std::ops::DerefMut for Assignments {
	fn deref_mut(&mut self) -> &mut Self::Target { &mut self.0 }
}
impl Assignments {
	fn new(bachelor_submissions: PlayerMap<Option<String>>) -> Option<Self> {
		
		let mut player_ids = bachelor_submissions
			.into_iter()
			.enumerate()
			//.filter_map(|(id, s)| s.take().map(|s| (id as PlayerId, s)))
			.filter_map(|(id, s)| s.map(|s| (id as PlayerId, s)))
			.collect::<Box<_>>();
		
		if player_ids.len() < 3 {
			None
		} else {
			player_ids.shuffle(&mut rand::rng());
			Some(Self(player_ids))
		}
	}
	fn find(&self, player_id: PlayerId) -> Option<usize> {
		self
			.iter()
			.position(|(id, _)| *id == player_id)
	}
	fn get_wrapped<'a>(&'a self, i: usize) -> &'a (PlayerId, String) {
		//self.get(i).unwrap()
		&self[i % self.len()]
	}
	
	fn get_bachelors_at<'a>(&'a self, i: usize) -> [&'a (PlayerId, String); SUITOR_COUNT] {
		let get = |shift| self.get_wrapped(i + shift);
		
		if self.len() <= 3 {
			[get(1), get(2)]
		} else {
			[get(1), get(self.len() - 2)]
		}
	}
	fn get_bachelors<'a>(&'a self, suitor_id: PlayerId) -> Option<[&'a (PlayerId, String); SUITOR_COUNT]> {
		Some(self.get_bachelors_at(self.find(suitor_id)?))
	}
	/*fn get_bachelor_drawings<'a>(&'a self, suitor_id: PlayerId) -> Option<[&'a str; SUITOR_COUNT]> {
		self
			.get_bachelors(suitor_id)
			.map(|bachelors| bachelors.map(|b| b.1.as_str()))
	}*/
	/*fn get_bachelor_drawings<'a>(&'a self, suitor_id: PlayerId) -> Option<[&'a str; SUITOR_COUNT]> {
		Some(self.get_bachelor_drawings_at(self.find(suitor_id)?))
	}*/
	
	
	fn get_suitor_ids_at(&self, i: usize) -> [PlayerId; SUITOR_COUNT] {
		self.get_suitors_at(i).map(|(id, _)| *id)
	}
	
	fn get_suitors_at<'a>(&'a self, i: usize) -> [&'a Assignment; SUITOR_COUNT] {
		//let get = |shift| self.get_wrapped(i + shift);
		//let a = self.get_wrapped(i + 1);
		
		if self.len() <= 3 {
			[self.get_wrapped(i + 1), self.get_wrapped(i + 2)]
		} else {
			[self.get_wrapped(i + 2), self.get_wrapped(i + self.len() - 1)]
		}
	}
	/*fn get_suitors<'a>(&'a self, bachelor_id: PlayerId) -> Option<[&'a Assignment; SUITOR_COUNT]> {
		Some(self.get_suitors_at(self.find(bachelor_id)?))
	}*/
	/*fn get_suitor_ids(&self, bachelor_id: PlayerId) -> Option<[PlayerId; SUITOR_COUNT]> {
		self
			.get_suitors(bachelor_id)
			.map(|suitors| suitors.map(|(id, _)| *id))
	}*/
	fn player_ids<'a>(&'a self) -> impl Iterator<Item=PlayerId> + 'a {
		self
			.iter()
			.map(|(bachelor_id, _)| *bachelor_id)
	}
	fn bachelors<'a>(&'a self) -> impl Iterator<Item=(PlayerId, [&'a (PlayerId, String); SUITOR_COUNT])> {
		self
			.iter()
			.enumerate()
			.map(|(i, (player_id, _))|
				(*player_id, self.get_bachelors_at(i))
			)
	}
	/*fn bachelor_drawings<'a>(&'a self) -> impl Iterator<Item=(PlayerId, [&'a str; SUITOR_COUNT])> {
		
		self
			.iter()
			.enumerate()
			.map(|(i, (player_id, _))| {
				let drawings = self
					.get_bachelors_at(i)
					.map(|(_, drawing)| drawing.as_str());
				(*player_id, drawings)
			})
	}*/
	
	
	
	fn vote_rounds(&self) -> Vec<VotingRound> {
		
		let mut remaining = self
			.iter()
			.enumerate()
			.map(|(i, (id, _))| (*id, self.get_suitor_ids_at(i)))
			.collect::<Vec<_>>();
		
		remaining.shuffle(&mut rand::rng());
		remaining
	}
}

enum State {
	Start,
	DrawBachelors { submissions: Box<PlayerMap<Option<String>>> },
	//DrawSuitors { submission_counts: PlayerMap<u8>, assignments: Assignments },
	DrawSuitors { assignments: Assignments, current: usize, submitted: [PlayerMap<bool>; SUITOR_COUNT] },
	//DrawSuitors { submitted: PlayerMap<[bool; SUITOR_COUNT]>, current: usize, assignments: Assignments },
	Vote { remaining: Vec<VotingRound>, current: VotingRound, votes: Box<PlayerMap<Option<PlayerId>>> },
	ShowVotes { remaining: Vec<VotingRound> },
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
	
	themes: Box<[&'static str]>
	//rounds: Vec<Round>
}
impl<'a> Game<'a> {
	
	/*fn get_theme<'a>() -> &'a str {
		self
	}*/
	
	pub fn new(clients: &'a mut ClientIndex, settings: Settings) -> (Self, room::Sender) {
		let (sender, receiver) = room::channel();
		let round_count = settings.round_count;
		
		let game = Self {
			clients,
			receiver,
			settings,
			timeout: Timeout::new(START_TIME),
			
			state: State::Start,
			round: 0, //Round { bachelors: [const { None }; MAX_PLAYER_COUNT] },
			
			themes: bachelor_themes::generate(round_count)
		};
		(game, sender)
	}
	pub async fn run(mut self) -> Result<(), ()> {
		
		let msg = &GlobalPlayerMsgOut::InDating;
		self.clients.players.send_all(msg).await;
		
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
							{ tracing::warn!("player attempted to join a game that is already in progress"); },
						room::Event::PlayerReconnect { socket, player_id, token, forced } =>
							{ self.handle_reconnect(socket, player_id, token, forced).await; }
					}
				},
				event = self.clients.recv() => {
					let Some(event) = event else { break Err(()) };
					self.handle_client_event(event).await?
				},
			}
		}
	}
	
	fn vote_choices(&self, suitor_ids: [PlayerId; SUITOR_COUNT]) -> Box<[String]> {
		suitor_ids
			.iter()
			.filter_map(|&id| {
				let player = self.clients.player(id);
				player.map(|p| p.name.to_owned())
			})
			.collect::<Box<[String]>>()
	}
	
	async fn handle_reconnect(&mut self, socket: WebSocket, player_id: PlayerId, token: PlayerToken, forced: bool) {
		let result = self.clients.reconnect_player(socket, player_id, token, forced).await;
		let Ok(_) = result else { return };
		
		let msg = GlobalPlayerMsgOut::InDating;
		self.clients.players.send(player_id, &msg).await;
		
		let msg = 'msg: {
			match self.state {
				State::Start => return,
				State::Done(_) => return,
				State::ShowVotes { remaining: _ } => PlayerMsgOut::ShowingVotes,
				State::ShowScores => PlayerMsgOut::ShowingScores,
				
				State::DrawBachelors { ref submissions } => {
					let submitted = submissions[player_id as usize].is_some();
					if submitted {
						PlayerMsgOut::DoneDrawingBachelor
					} else {
						let theme = self.themes[self.round];//.as_str();
						let secs_left = self.timeout.remaining_secs();
						PlayerMsgOut::DrawingBachelor { theme, secs_left }
					}
				},
				State::DrawSuitors { ref assignments, ref submitted, current } => {
					
					let submitted = submitted
						.get(current)
						.and_then(|s| s.get(player_id as usize));
					
					let Some(false) = submitted else {
						break 'msg PlayerMsgOut::DoneDrawingSuitor;
					};
					
					let Some(bachelors) = assignments.get_bachelors(player_id) else {
						tracing::warn!("couldn't get bachelor drawing for rejoining player");
						break 'msg PlayerMsgOut::DoneDrawingSuitor;
					};
					
					let Some((bachelor_id, ref bachelor_drawing)) = bachelors.get(current) else {
						tracing::warn!("couldn't get bachelor drawing for rejoining player");
						break 'msg PlayerMsgOut::DoneDrawingSuitor;
					};
					
					let secs_left = self.timeout.remaining_secs();
					self.clients.players.send(player_id, &PlayerMsgOut::DrawingSuitor {
						bachelor_id: *bachelor_id,
						bachelor_drawing: bachelor_drawing.as_str(),
						secs_left
					}).await;
					return;
				},
				State::Vote { ref current, ref votes, remaining: _ } => {
					
					if let Some(None) = votes.get(player_id as usize) {
						let (_, suitor_ids) = current;
						let choices = self.vote_choices(*suitor_ids);
						let choices = choices.as_ref();
						let secs_left = self.timeout.remaining_secs();
						let msg = PlayerMsgOut::Voting {
							choices,
							secs_left
						};
						self.clients.players.send(player_id, &msg).await;
						return;
					} else {
						PlayerMsgOut::DoneVoting
					}
				}
			}
		};
		
		self.clients.players.send(player_id, &msg).await;
	}
	async fn handle_client_event(&mut self, event: (ClientId, ClientEvent)) -> Result<(), ()> {
		match event {
			(ClientId::Host, ClientEvent::Disconnect) =>
				{ return Err(()) },
			(ClientId::Player(_), ClientEvent::Disconnect) =>
				{ /* ClientIndex handles disconnects for us */},
			(ClientId::Host, ClientEvent::Message(msg)) => {
				//let Ok(msg) = deserialize::<'_, HostMsgIn>(&msg) else { return Ok(()) };
				//self.handle_host_message(msg).await;
				tracing::debug!("invalid host message: {msg}");
			},
			(ClientId::Player(player_id), ClientEvent::Message(msg)) => {
				if let Ok(msg) = deserialize::<'_, PlayerMsgIn>(&msg) {
					self.handle_player_message(player_id, msg).await;
				} else {
					tracing::debug!("invalid player message: {msg}");
					return Ok(());
				}
			}
		}
		Ok(())
	}
	//async fn handle_host_message(&mut self, message: HostMsgIn) {
		
	//}
	async fn handle_player_message(&mut self, player_id: PlayerId, msg: PlayerMsgIn) {
		match msg {
			PlayerMsgIn::BachelorSubmission { drawing, name } =>
				self.handle_bachelor_submission(player_id, drawing, name).await,
			PlayerMsgIn::SuitorSubmission { bachelor_id, drawing, name } =>
				self.handle_suitor_submission(player_id, bachelor_id, drawing, name).await,
			PlayerMsgIn::VoteSubmission { for_name } =>
				self.handle_vote_submission(player_id, for_name).await
		}
	}
	async fn handle_bachelor_submission(&mut self, player_id: PlayerId, drawing: String, name: Option<String>) {
		let State::DrawBachelors { ref mut submissions } = self.state else {
			tracing::debug!("player attempted to submit bachelor drawing while game in invalid state");
			return;
		};
		let Some(None) = submissions.get(player_id as usize) else {
			tracing::debug!("duplicate or invalid bachelor submission attempted");
			return;
		};
		
		self.clients.host.send(&HostMsgOut::BachelorSubmitted {
			player_id,
			drawing: &drawing,
			name: name.as_deref(),
		}).await;
		
		submissions[player_id as usize] = Some(drawing);
		
		let all_submitted = self.clients.players
			.ids()
			.all(|id| matches!(submissions.get(id as usize), Some(Some(_))));
		if all_submitted {
			self.advance().await;
		}
	}
	async fn handle_suitor_submission(&mut self, player_id: PlayerId, bachelor_id: PlayerId, drawing: String, name: Option<String>) {
		let State::DrawSuitors { ref mut submitted, ref assignments, current } = self.state else {
			tracing::debug!("player attempted to submit suitor drawing while game in invalid state");
			return;
		};
		
		let Some(bachelors) = assignments.get_bachelors(player_id) else {
			tracing::debug!("couldn't find suitor in assignment index");
			return;
		};
		
		let round = bachelors
			.iter()
			.position(|(id, _)| *id == bachelor_id);
		
		let Some(round) = round else {
			tracing::debug!("submitted suitor for invalid bachelor");
			return;
		};
		let Some(submitted) = submitted.get_mut(current) else {
			tracing::error!("invalid round for suitor submission (somehow)");
			return;
		};
		let Some(false) = submitted.get(player_id as usize) else {
			tracing::debug!("attempted duplicate suitor submission");
			return;
		};
		
		submitted[player_id as usize] = true;
		
		self.clients.host.send(&HostMsgOut::SuitorSubmitted {
			player_id,
			bachelor_id,
			drawing: &drawing,
			name: name.as_deref()
		}).await;
		
		if round == current {
			let all_submitted = assignments
				.player_ids()
				.all(|id| matches!(submitted.get(id as usize), Some(true)));
			if all_submitted {
				self.advance().await;
			}
		}
	}
	async fn handle_vote_submission(&mut self, player_id: PlayerId, for_name: String) {
		let State::Vote { ref current, ref mut votes, remaining: _ } = self.state else {
			tracing::debug!("player attempted to vote while game in invalid state");
			return;
		};
		
		let Some(None) = votes.get(player_id as usize) else {
			tracing::debug!("player attempted to vote multiple times");
			return;
		};
		
		let Some(for_id) = self.clients.players.id_from_name(&for_name) else {
			tracing::debug!("player attempted to vote for player that is not present");
			return;
		};
		
		let (_bachelor_id, suitor_ids) = current;
		if suitor_ids.contains(&player_id) {
			tracing::debug!("player attempted to vote in round where they are a suitor");
			return;
		}
		if !suitor_ids.contains(&for_id) {
			tracing::debug!("player attempted to vote for invalid player");
			return;
		}
		
		votes[player_id as usize] = Some(for_id);
		let msg = HostMsgOut::VoteSubmitted { player_id, for_id };
		self.clients.host.send(&msg).await;
		
		let all_submitted = self.clients.players
			.ids()
			.all(|id| {
				if suitor_ids.contains(&id) {
					true
				} else if matches!(votes.get(id as usize), Some(Some(_))) {
					true
				} else {
					false
				}
			});
		if all_submitted {
			self.advance().await;
		}
	}
	async fn advance(&mut self) {
		
		/* Temporary placeholder state for enum field ownership reasons */
		let state = std::mem::replace(
			&mut self.state,
			State::Done(Err(()))
		);
		
		self.state = match state {
			State::Start =>
				self.start_draw_bachelors().await,
			State::DrawBachelors { submissions } =>
				self.start_draw_suitors(*submissions).await,
			State::DrawSuitors { assignments, current, submitted } =>
				self.start_next_draw_suitor(1 + current, assignments, submitted).await,
			State::Vote { remaining, current: _, votes } =>
				self.start_show_votes(remaining, votes.as_ref()).await,
			State::ShowVotes { remaining } =>
				self.start_next_vote(remaining).await,
			State::ShowScores => {
				self.round += 1;
				self.start_draw_bachelors().await
			}
			State::Done(_) => {
				tracing::warn!("attempted to advance a finished game");
				return;
			}
		}
	}
	async fn start_draw_bachelors(&mut self) -> State {
		
		let Some(theme) = self.themes.get(self.round) else {
			/* We're done */
			return State::Done(Ok(()));
		};
		
		let secs_left = self.timeout.reset_scaled(
			DRAW_BACHELOR_TIME,
			self.settings.bachelor_draw_time_factor
		);
		
		self.clients.send_all(
			&PlayerMsgOut::DrawingBachelor { theme, secs_left },
			&HostMsgOut::DrawingBachelors { theme }
		).await;
		
		let submissions = Box::new([const { None }; MAX_PLAYER_COUNT]);
		State::DrawBachelors { submissions }
	}
	async fn start_draw_suitors(&mut self, submissions: PlayerMap<Option<String>>) -> State {
		if let Some(assignments) = Assignments::new(submissions) {
			//self.start_draw_suitors(assignments).await
			let submitted = [[false; MAX_PLAYER_COUNT]; SUITOR_COUNT];
			self.start_next_draw_suitor(0, assignments, submitted).await
		} else {
			tracing::debug!("not enough bachelor submissions to proceed");
			State::Done(Err(()))
		}
	}
	async fn start_next_draw_suitor(&mut self, current: usize, assignments: Assignments, submitted: [PlayerMap<bool>; SUITOR_COUNT]) -> State {
		
		//tracing::info!("{current}");
		if current >= SUITOR_COUNT {
			return self.start_vote(&assignments).await;
		}
		
		let secs_left = self.timeout.reset_scaled(
			DRAW_SUITOR_TIME,
			self.settings.suitor_draw_time_factor
		);
		
		/* Tell host */
		self.clients.host.send(&HostMsgOut::DrawingSuitors).await;
		
		/* Tell players */
		let iter = assignments.bachelors();
		for (player_id, bachelors) in iter {
			let (bachelor_id, bachelor_drawing) = bachelors[current];
			let msg = PlayerMsgOut::DrawingSuitor {
				bachelor_id: *bachelor_id,
				bachelor_drawing: bachelor_drawing.as_str(),
				secs_left
			};
			self.clients.players.send(player_id, &msg).await;
		}
		
		State::DrawSuitors { assignments, current, submitted }
	}
	async fn start_vote(&mut self, assignments: &Assignments) -> State {
		self.start_next_vote(assignments.vote_rounds()).await
	}
	async fn start_next_vote(&mut self, mut remaining: Vec<VotingRound>) -> State {
		
		let Some(current) = remaining.pop() else {
			/* No votes left, show scores instead */
			return self.start_show_scores().await;
		};
		
		let (bachelor_id, suitor_ids) = current;
		let choices = self.vote_choices(suitor_ids);
		let choices = choices.as_ref();
		
		let secs_left = self.timeout.reset_scaled(
			VOTE_TIME,
			self.settings.vote_time_factor
		);
		
		self.clients.host.send(&HostMsgOut::Voting { bachelor_id }).await;
		for (id, player) in self.clients.players.iter_mut() {
			if suitor_ids.contains(&(id as PlayerId)) {
				player.send(&PlayerMsgOut::DoneVoting).await;
			} else {
				player.send(&PlayerMsgOut::Voting {	choices, secs_left }).await;
			}
		}
		
		State::Vote {
			votes: Box::new([None; MAX_PLAYER_COUNT]),
			current,
			remaining
		}
	}
	async fn start_show_votes(&mut self, remaining: Vec<VotingRound>, votes: &[Option<PlayerId>; MAX_PLAYER_COUNT]) -> State {
		
		self.clients.send_all(
			&PlayerMsgOut::ShowingVotes,
			&HostMsgOut::ShowingVotes
		).await;
		
		let num_votes = votes
			.iter()
			.filter(|v| v.is_some())
			.count();
		self.timeout.reset_dynamic_scaled(
			SHOW_VOTES_TIME,
			num_votes,
			self.settings.score_time_factor
		);
		
		State::ShowVotes { remaining }
	}
	async fn start_show_scores(&mut self) -> State {
		
		self.clients.send_all(
			&PlayerMsgOut::ShowingScores,
			&HostMsgOut::ShowingScores,
		).await;
		
		self.timeout.reset_dynamic_scaled(
			SHOW_SCORES_TIME,
			self.clients.player_count(),
			self.settings.score_time_factor
		);
		
		State::ShowScores
	}
}
