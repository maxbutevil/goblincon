

use serde::{Serialize, Deserialize};

//use std::net::SocketAddr;
//use internment::ArcIntern;
pub type RoomId = [u8; ROOM_ID_LEN];
//pub type ClientId = ArcIntern<SocketAddr>;
pub type PlayerId = u8;

pub use std::time::Duration;

pub const ROUND_COUNT: usize = 3;
pub const MIN_NAME_LEN: usize = 2;
pub const MAX_NAME_LEN: usize = 16;
pub const MIN_PLAYER_COUNT: usize = 2;
pub const MAX_PLAYER_COUNT: usize = 8;

pub const START_DURATION: Duration = Duration::from_secs(1);
pub const DRAW_DURATION: Duration = Duration::from_secs(5);
pub const DRAW_AUTOSUBMIT_DURATION: Duration = Duration::from_secs(4);
pub const VOTE_DURATION: Duration = Duration::from_secs(20);
pub const SCORE_DURATION: Duration = Duration::from_secs(10);

pub const ROOM_ID_LEN: usize = 5;
pub const ROOM_ID_CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ";


#[derive(Deserialize)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum HostMessageIn {
	//CreateGame {}
}

#[derive(Deserialize)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum PlayerMessageIn {
	//JoinGame { room_id: RoomId, player_name: String },
	StartGame,
	DrawingSubmission { drawing: Box<String> },
	//VoteSubmission { for_id: PlayerId }
	VoteSubmission { for_name: String },
}


#[derive(Serialize)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum HostMessageOut<'a> {
	
	
	LobbyCreated { join_code: &'a str },
	PlayerJoined { player_id: PlayerId, player_name: String },
	PlayerLeft { player_id: PlayerId },
	
	GameStarted,
	GameTerminated,
	
	DrawingStarted { goblin_name: &'a str },
	DrawingTimeout,
	VotingStarted,
	ScoringStarted,/// { votes: [u8; MAX_PLAYER_COUNT] },
	
	DrawingSubmitted { player_id: PlayerId, drawing: &'a str },
	VoteSubmitted { player_id: PlayerId, for_id: PlayerId }
	
}

#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub enum StatusKind {
	Error,
	
}

#[derive(Serialize, Clone)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum PlayerMessageOut<'a> {
	
	//JoinedGame { room_id: RoomId }, //players: Vec<RemotePlayer> }
	//PlayerJoined { player_id: usize, player_name: String },
	
	StatusUpdate { kind: StatusKind, message: &'a str },
	
	//Error { error_message: &'a str },
	
	LobbyJoined { promoted: bool },
	//LobbyJoinError { error_message: &'a str },
	Promoted,
	
	GameStarted,
	GameTerminated,
	
	DrawingStarted,
	DrawingTimeout,
	VotingStarted { choices: &'a Vec<String> }, //{ choices: &'a Vec<RemotePlayer<'a>> },
	ScoringStarted,
	
	
	//Placeholder(std::marker::PhantomData<&'a str>)
	
	//DrawingSubmitted { player_id: usize, drawing: &'a str },
	
}
impl<'a> PlayerMessageOut<'a> {
	
	pub fn error(message: &'a str) -> PlayerMessageOut::<'a> {
		Self::StatusUpdate { kind: StatusKind::Error, message }
	}
	
	
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemotePlayer<'a> {
	pub id: u8,
	pub name: &'a str
}





