
use super::*;
use strgen::bachelor_themes;

const SUITOR_COUNT: usize = 2;
const START_TIME: Duration = Duration::from_secs(3);
const DRAW_BACHELOR_TIME: Duration = Duration::from_secs(140);
const DRAW_SUITOR_TIME: Duration = Duration::from_secs(140);
const VOTE_TIME: Duration = Duration::from_secs(20);
const VOTE_TIME_ONE_SUBMISSION: Duration = Duration::from_secs(15);
const VOTE_TIME_NO_SUBMISSIONS: Duration = Duration::from_secs(12);

const SHOW_VOTES_TIME: DynamicDuration = DynamicDuration::from_secs(6, 1);
const SHOW_SCORES_TIME: DynamicDuration = DynamicDuration::from_secs(6, 1);
//const RECAP_TIME: DynamicDuration = DynamicDuration::from_secs(180, 0);

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Settings {
	#[serde(deserialize_with = "room::clamp_round_count")]
	round_count: usize,
	#[serde(deserialize_with = "room::clamp_time_factor")]
	bachelor_draw_time_factor: f32,
	#[serde(deserialize_with = "room::clamp_time_factor")]
	suitor_draw_time_factor: f32,
	#[serde(deserialize_with = "room::clamp_time_factor")]
	vote_time_factor: f32,
	#[serde(deserialize_with = "room::clamp_time_factor")]
	score_time_factor: f32,
	
	naming: bool,
}

#[derive(Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
struct Submission {
	drawing: Box<str>,
	#[serde(default, deserialize_with = "room::cap_submission_name", skip_serializing_if = "Option::is_none")]
	name: Option<Box<str>>
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
	DrawingBachelors { secs_left: f32, theme: &'a str },
	DrawingSuitors { secs_left: f32 },
	Voting { secs_left: f32, bachelor_id: PlayerId },
	ShowingVotes,
	ShowingScores,
	
	/* Events */
	BachelorSubmitted { player_id: PlayerId, submission: &'a Submission },
	SuitorSubmitted { player_id: PlayerId, bachelor_id: PlayerId, submission: &'a Submission },
	VoteSubmitted { player_id: PlayerId, for_id: PlayerId },
	//Finished,
}

#[derive(Deserialize)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
enum PlayerMsgIn {
	BachelorSubmission { submission: Submission },
	SuitorSubmission { bachelor_id: PlayerId, submission: Submission },
	VoteSubmission { for_name: String },
}

#[derive(Serialize, Clone)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
enum PlayerMsgOut<'a> {
	
	DrawingBachelor { theme: &'a str, naming: bool, secs_left: f32 },
	DrawingSuitor { bachelor_id: PlayerId, bachelor_submission: &'a Submission, naming: bool, secs_left: f32 },
	//DrawingSuitor { bachelor_drawings: &'a [&'a str], secs_left: f32 },
	//Shipping { choices: &'a [String], secs_left: f32 },
	Voting { choices: &'a [String], secs_left: f32 },
	
	ShowingVotes,
	ShowingScores,
	
	DoneDrawingBachelor,
	DoneDrawingSuitor,
	//DoneShipping,
	DoneVoting,
	NotVoting, // for when your own submission is being voted on
	
	//Finished,
}

type PlayerMap<T> = [T; MAX_PLAYER_COUNT];
type VotingRound = (PlayerId, [PlayerId; SUITOR_COUNT]);
type Assignment = (PlayerId, Submission);
struct Assignments(Box<[Assignment]>);
impl std::ops::Deref for Assignments {
	type Target = Box<[Assignment]>;
	fn deref(&self) -> &Self::Target { &self.0 }
}
impl std::ops::DerefMut for Assignments {
	fn deref_mut(&mut self) -> &mut Self::Target { &mut self.0 }
}
impl Assignments {
	fn new(bachelor_submissions: PlayerMap<Option<Submission>>) -> Option<Self> {
		
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
	fn get_wrapped<'a>(&'a self, i: usize) -> &'a Assignment {
		//self.get(i).unwrap()
		&self[i % self.len()]
	}
	
	fn get_bachelors_at<'a>(&'a self, i: usize) -> [&'a Assignment; SUITOR_COUNT] {
		let get = |shift| self.get_wrapped(i + shift);
		
		if self.len() <= 3 {
			[get(1), get(2)]
		} else {
			[get(1), get(self.len() - 2)]
		}
	}
	fn get_bachelors<'a>(&'a self, suitor_id: PlayerId) -> Option<[&'a Assignment; SUITOR_COUNT]> {
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
		let get = |shift| self.get_wrapped(i + shift);
		
		if self.len() <= 3 {
			[get(2), get(1)]
		} else {
			[get(self.len() - 1), get(2)]
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
	fn bachelors<'a>(&'a self) -> impl Iterator<Item=(PlayerId, [&'a Assignment; SUITOR_COUNT])> {
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
	
	
	
	fn vote_rounds(&self) -> Box<[VotingRound]> {
		
		let mut remaining = self
			.iter()
			.enumerate()
			.map(|(i, (id, _))| (*id, self.get_suitor_ids_at(i)))
			.collect::<Box<_>>();
		
		remaining.shuffle(&mut rand::rng());
		remaining
	}
}


enum State {
	Start,
	DrawBachelors { submissions: Box<PlayerMap<Option<Submission>>> },
	DrawSuitors { assignments: Assignments, current: usize, submitted: [PlayerMap<bool>; SUITOR_COUNT] },
	Vote { current: usize, rounds: Box<[VotingRound]>, submitted: [PlayerMap<bool>; SUITOR_COUNT], voted: PlayerMap<bool> },
	ShowVotes { current: usize, rounds: Box<[VotingRound]>, submitted: [PlayerMap<bool>; SUITOR_COUNT] },
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
}
impl<'a> Game<'a> {
	
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
						room::Event::PlayerReconnect { socket, player_id, token, manual } =>
							{ self.handle_reconnect(socket, player_id, token, manual).await; }
					}
				},
				event = self.clients.recv() => {
					let Some(event) = event else { break Err(()) };
					self.handle_client_event(event).await?
				},
			}
		}
	}
	
	fn vote_choices(&self, mut suitor_ids: [PlayerId; SUITOR_COUNT], submitted: &[PlayerMap<bool>; SUITOR_COUNT]) -> Box<[String]> {
		suitor_ids.sort_unstable();
		suitor_ids
			.iter()
			.enumerate()
			.filter_map(|(r, &id)| {
				if !submitted[r][id as usize] {
					// This player did not submit, can't vote for their nonexistent drawing
					None
				} else {
					let player = self.clients.player(id);
					player.map(|p| p.name.to_owned())
				}
			})
			.collect::<Box<[String]>>()
	}
	
	async fn handle_reconnect(&mut self, socket: WebSocket, player_id: PlayerId, token: PlayerToken, manual: bool) {
		let result = self.clients.reconnect_player(socket, player_id, token, manual).await;
		let Ok(_) = result else { return };
		
		let msg = GlobalPlayerMsgOut::InDating;
		self.clients.players.send(player_id, &msg).await;
		
		let msg = 'msg: {
			match self.state {
				State::Start => return,
				State::Done(_) => return,
				State::ShowVotes { current: _, rounds: _, submitted: _ } => PlayerMsgOut::ShowingVotes,
				State::ShowScores => PlayerMsgOut::ShowingScores,
				State::DrawBachelors { ref submissions } => {
					let submitted = submissions[player_id as usize].is_some();
					if submitted {
						PlayerMsgOut::DoneDrawingBachelor
					} else {
						PlayerMsgOut::DrawingBachelor {
							theme: self.themes[self.round],
							naming: self.settings.naming,
							secs_left: self.timeout.remaining_secs()
						}
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
					
					let Some((bachelor_id, ref bachelor_submission)) = bachelors.get(current) else {
						tracing::warn!("couldn't get bachelor drawing for rejoining player");
						break 'msg PlayerMsgOut::DoneDrawingSuitor;
					};
					
					self.clients.players.send(player_id, &PlayerMsgOut::DrawingSuitor {
						bachelor_id: *bachelor_id,
						bachelor_submission: &bachelor_submission,
						naming: self.settings.naming,
						secs_left: self.timeout.remaining_secs()
					}).await;
					return;
				},
				State::Vote { current, ref rounds, ref voted, ref submitted } => {
				
					let (_, suitor_ids) = rounds[current];
					if suitor_ids.contains(&player_id) {
						break 'msg PlayerMsgOut::NotVoting;
					}
					
					let Some(false) = voted.get(player_id as usize) else {
						break 'msg PlayerMsgOut::DoneVoting;
					};
					
					let choices = self.vote_choices(suitor_ids, submitted);
					let choices = choices.as_ref();
					
					if choices.is_empty() {
						break 'msg PlayerMsgOut::NotVoting;
					}
					
					let secs_left = self.timeout.remaining_secs();
					let msg = PlayerMsgOut::Voting {
						choices,
						secs_left
					};
					self.clients.players.send(player_id, &msg).await;
					return;
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
				{ /* ClientIndex handles disconnects for us */ },
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
	async fn handle_player_message(&mut self, player_id: PlayerId, msg: PlayerMsgIn) {
		match msg {
			PlayerMsgIn::BachelorSubmission { submission } =>
				self.handle_bachelor_submission(player_id, submission).await,
			PlayerMsgIn::SuitorSubmission { bachelor_id, submission } =>
				self.handle_suitor_submission(player_id, bachelor_id, submission).await,
			PlayerMsgIn::VoteSubmission { for_name } =>
				self.handle_vote_submission(player_id, for_name).await
		}
	}
	async fn handle_bachelor_submission(&mut self, player_id: PlayerId, submission: Submission) {
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
			submission: &submission
		}).await;
		
		submissions[player_id as usize] = Some(submission);
		
		let all_submitted = self.clients.players
			.ids()
			.all(|id| matches!(submissions.get(id as usize), Some(Some(_))));
		if all_submitted {
			self.advance().await;
		}
	}
	async fn handle_suitor_submission(&mut self, player_id: PlayerId, bachelor_id: PlayerId, submission: Submission) {
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
		if round > current {
			tracing::debug!("attempted to submit suitor for a bachelor from a future round");
			return;
		}
		let Some(submitted) = submitted.get_mut(current) else {
			tracing::error!("invalid round for suitor submission");
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
			submission: &submission
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
		let State::Vote { ref mut voted, current, ref rounds, submitted: _ } = self.state else {
			tracing::debug!("player attempted to vote while game in invalid state");
			return;
		};
		
		let Some(false) = voted.get(player_id as usize) else {
			tracing::debug!("player attempted to vote multiple times");
			return;
		};
		
		let Some(for_id) = self.clients.players.id_from_name(&for_name) else {
			tracing::debug!("player attempted to vote for player that is not present");
			return;
		};
		
		let (_bachelor_id, suitor_ids) = rounds[current];
		if suitor_ids.contains(&player_id) {
			tracing::debug!("player attempted to vote in round where they are a suitor");
			return;
		}
		if !suitor_ids.contains(&for_id) {
			tracing::debug!("player attempted to vote for invalid player");
			return;
		}
		
		voted[player_id as usize] = true;//Some(for_id);
		let msg = HostMsgOut::VoteSubmitted { player_id, for_id };
		self.clients.host.send(&msg).await;
		
		let all_submitted = self.clients.players
			.ids()
			.all(|id| {
				if suitor_ids.contains(&id) {
					true
				} else if matches!(voted.get(id as usize), Some(true)) {
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
			State::Vote { current, rounds, submitted, voted } =>
				self.start_show_votes(current, rounds, submitted, voted).await,
			State::ShowVotes { current, rounds, submitted } =>
				self.start_next_vote(1 + current, rounds, submitted).await,
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
		
		let naming = self.settings.naming;
		let secs_left = self.timeout.reset_scaled(
			DRAW_BACHELOR_TIME,
			self.settings.bachelor_draw_time_factor
		);
		
		self.clients.send_all(
			&PlayerMsgOut::DrawingBachelor { theme, naming, secs_left },
			&HostMsgOut::DrawingBachelors { theme, secs_left }
		).await;
		
		let submissions = Box::new([const { None }; MAX_PLAYER_COUNT]);
		State::DrawBachelors { submissions }
	}
	async fn start_draw_suitors(&mut self, submissions: PlayerMap<Option<Submission>>) -> State {
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
			return self.start_vote(&assignments, submitted).await;
		}
		
		let secs_left = self.timeout.reset_scaled(
			DRAW_SUITOR_TIME,
			self.settings.suitor_draw_time_factor
		);
		
		/* Tell host */
		self.clients.host.send(&HostMsgOut::DrawingSuitors {
			secs_left
		}).await;
		
		/* Tell players */
		let iter = assignments.bachelors();
		for (player_id, bachelors) in iter {
			let (bachelor_id, bachelor_submission) = bachelors[current];
			self.clients.players.send(player_id, &PlayerMsgOut::DrawingSuitor {
				bachelor_id: *bachelor_id,
				bachelor_submission,
				naming: self.settings.naming,
				secs_left
			}).await;
		}
		
		State::DrawSuitors { assignments, current, submitted }
	}
	async fn start_vote(&mut self, assignments: &Assignments, submitted: [PlayerMap<bool>; SUITOR_COUNT]) -> State {
		let mut rounds = assignments
			.iter()
			.enumerate()
			.map(|(i, &(id, _))| {
				let suitor_ids = assignments.get_suitor_ids_at(i);
				(id, suitor_ids)
			})
			.collect::<Box<_>>();
		
		rounds.shuffle(&mut rand::rng());
		
		self.start_next_vote(0, assignments.vote_rounds(), submitted).await
	}
	async fn start_next_vote(&mut self, current: usize, rounds: Box<[VotingRound]>, submitted: [PlayerMap<bool>; SUITOR_COUNT]) -> State {
		
		let Some(&(bachelor_id, suitor_ids)) = rounds.get(current) else {
			/* No votes left, show scores instead */
			return self.start_show_scores().await;
		};
		
		let choices = self.vote_choices(suitor_ids, &submitted);
		let choices = choices.as_ref();
		
		let secs_left = self.timeout.reset_scaled(
			match choices.len() {
				0 => VOTE_TIME_NO_SUBMISSIONS,
				1 => VOTE_TIME_ONE_SUBMISSION,
				_ => VOTE_TIME
			},
			self.settings.vote_time_factor
		);
		
		self.clients.host.send(&HostMsgOut::Voting {
			bachelor_id,
			secs_left
		}).await;
		for (id, player) in self.clients.players.iter_mut() {
			if suitor_ids.contains(&(id as PlayerId)) || choices.is_empty() {
				player.send(&PlayerMsgOut::NotVoting).await;
			} else {
				player.send(&PlayerMsgOut::Voting {	choices, secs_left }).await;
			}
		}
		
		State::Vote {
			current,
			rounds,
			submitted,
			voted: [false; MAX_PLAYER_COUNT],
		}
	}
	async fn start_show_votes(&mut self, current: usize, rounds: Box<[VotingRound]>, submitted: [PlayerMap<bool>; SUITOR_COUNT], voted: PlayerMap<bool>) -> State {
		
		self.clients.send_all(
			&PlayerMsgOut::ShowingVotes,
			&HostMsgOut::ShowingVotes
		).await;
		
		let num_votes = voted
			.iter()
			.filter(|&&v| v == true)
			.count();
		self.timeout.reset_dynamic_scaled(
			SHOW_VOTES_TIME,
			num_votes,
			self.settings.score_time_factor
		);
		
		State::ShowVotes { current, rounds, submitted }
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
