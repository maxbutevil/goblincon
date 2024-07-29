

use serde::{Serialize, Deserialize};

//use std::net::SocketAddr;
//use internment::ArcIntern;
pub type RoomId = [u8; ROOM_ID_LEN];
//pub type ClientId = ArcIntern<SocketAddr>;
pub type PlayerId = u8;
pub type PlayerToken = u32; // can't use usize or javascript will throw a fit

pub enum ClientId {
	Host,
	Player(PlayerId)
}

pub use tokio::time::Duration;

pub const ROUND_COUNT: usize = 3;
pub const MIN_NAME_LEN: usize = 2;
pub const MAX_NAME_LEN: usize = 16;
pub const MIN_PLAYER_COUNT: usize = 2;
pub const MAX_PLAYER_COUNT: usize = 8;

pub const ROOM_ID_LEN: usize = 5;
pub const ROOM_ID_CHARS: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZ";


/*#[derive(Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub enum StatusKind {
	Ok,
	Err
}*/
#[derive(Serialize, Clone)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum GlobalPlayerMsgOut<'a> {
	Terminated,
	Error(&'a str),
}

#[derive(Serialize, Clone)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum GlobalHostMsgOut<'a> {
	Accepted { join_code: &'a str },
	Terminated,
	//Error(&'a str),
}

#[derive(Deserialize)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
enum GlobalHostMsgIn {
	Terminate
}

/*impl<'a> GlobalPlayerMsgOut<'a> {
	fn ok(message: &'a str) -> Self {
		Self::StatusUpdate { kind: StatusKind::Ok, message }
	}
	fn err(message: &'a str) -> Self {
		Self::StatusUpdate { kind: StatusKind::Err, message }
	}
}*/




/*pub enum GameType {
	Drawblins,
	Showdown
}


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
#[serde(rename_all = "camelCase")]
pub enum IdleKind {
	Start,
	Draw,
	Vote,
	Score,
}

#[derive(Serialize, Clone)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum PlayerMessageOut<'a> {
	
	//JoinedGame { room_id: RoomId }, //players: Vec<RemotePlayer> }
	//PlayerJoined { player_id: usize, player_name: String },
	
	StatusUpdate { kind: StatusKind, message: &'a str },
	
	GameTerminated,
	LobbyJoined { promoted: bool },
	Promoted,
	
	Idle { kind: IdleKind },// { message: &'a str },
	Drawing { goblin_name: &'a str, secs_left: f32 },
	DrawingTimeout,
	Voting { choices: &'a Vec<String>, secs_left: f32 }
	
}
impl<'a> PlayerMessageOut<'a> {
	
	pub fn error(message: &'a str) -> PlayerMessageOut::<'a> {
		Self::StatusUpdate { kind: StatusKind::Error, message }
	}
}*/

/*#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemotePlayer<'a> {
	pub id: u8,
	pub name: &'a str
}*/





