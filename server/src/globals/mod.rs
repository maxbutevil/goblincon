


pub mod token;
pub mod timeout;
pub use token::*;



pub use tokio::time::Duration;
pub use serde::{
	Serialize,
	Deserialize, Deserializer
};
pub use futures_util::{
	SinkExt, StreamExt,
	stream::{SplitSink, SplitStream}
};

pub type PlayerId = u8;
pub type PlayerIcon = u8;
/*pub type PlayerColor = u8;
pub const NUM_PLAYER_ICONS: PlayerIcon = 8;
pub const NUM_PLAYER_COLORS: PlayerColor = 16;*/

pub use rand::prelude::*;
pub use axum::extract::ws::{WebSocket, Message, Utf8Bytes};
pub type WebSocketSender = SplitSink<WebSocket, Message>;
pub type WebSocketReceiver = SplitStream<WebSocket>;

pub const MIN_PLAYER_COUNT: usize = 3;
pub const MAX_PLAYER_COUNT: usize = 16;

pub const MIN_PLAYER_NAME_CHARS: usize = 2;
pub const MAX_PLAYER_NAME_CHARS: usize = 16;
pub const MIN_PLAYER_NAME_LEN: usize = MIN_PLAYER_NAME_CHARS;
pub const MAX_PLAYER_NAME_LEN: usize = 2 * MAX_PLAYER_NAME_CHARS;

pub const MAX_SUBMISSION_NAME_CHARS: usize = 64;
pub const MAX_SUBMISSION_NAME_LEN: usize = 2 * MAX_SUBMISSION_NAME_CHARS;


#[derive(Serialize, Clone)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum GlobalPlayerMsgOut<'a> {
	//Terminated,
	Error(&'a str),
	
	InLobby {
		/* player_count sent to the leader so they know if they can start the game */
		#[serde(skip_serializing_if = "Option::is_none")]
		player_count: Option<usize>
	},
	InDrawblins,
	InDating,
}

#[derive(Serialize)]
#[serde(tag = "type", content = "data")]
#[serde(rename_all = "camelCase", rename_all_fields = "camelCase")]
pub enum GlobalHostMsgOut {
	InLobby { leader_id: PlayerId },
}







/*pub struct ClientToken(Token<24>);
impl ClientToken {
	pub fn from_str(str: &str) -> Option<Self> {
		let inner = Token::from_str(str)?;
		Some(Self(inner))
	}
	pub fn as_str<'a>(&'a self) -> &'a str {
		self.0.as_str()
	}
}

pub struct RoomToken(Token<5>) {
	pub fn from_str(str: &str) -> Option<Self> {
		let inner = Token::from_str(str)?;
		Some(Self(inner))
	}
	pub fn as_str<'a>(&'a self) -> &'a str {
		
	}
}


#[derive(Clone, Copy, PartialEq, Eq, Hash)]
pub struct ClientToken(Token<24>);
pub struct RoomToken(Token<5>);
impl std::ops::Deref for RoomToken {
	type Target = Token<5>;
	fn deref(&self) -> Token<5> { self.0 }
}

#[derive(Clone, Copy, PartialEq, Eq, Hash)]
pub struct RoomToken([u8; Self::LEN]);
impl RoomToken {
	
	const LEN: usize = 5;
	const CHARS: &'static [u8] = b"BCDFGHJKLMNPQRSTVWXZ";
	
	pub fn generate() -> Self {
		let rng = &mut rand::rng();
		let inner = [(); 5].map(|_| *Self::CHARS.choose(rng).unwrap());
		Self(inner)
	}
	pub fn parse(join_code: &str) -> Option<Self> {
		/* Minor note: this method allows invalid characters not usable by generate() */
		/* However, it still guarantees valid UTF-8, so it's fine */
		if join_code.len() != Self::LEN {
			None
		} else {
			join_code
				.as_bytes()
				.first_chunk::<{Self::LEN}>()
				.map(|id| Self(id.to_owned()))
		}
	}
	
}
impl std::ops::Deref for RoomToken {
	type Target = [u8; Self::LEN];
	fn deref(&self) -> &[u8; Self::LEN] { &self.0 }
}*/

//macro_rules! require {
	
//}

/*macro_rules! expect {
	
}

pub trait SoftExpect {
	fn is_unexpected(&self) -> bool;
	
	fn info_expect(&self, what: &str) { if self.is_unexpected() { tracing::info!(what) } }
	fn debug_expect(&self, what: &str) { if self.is_unexpected() { tracing::debug!(what) } }
	fn warn_expect(&self, what: &str) { if self.is_unexpected() { tracing::warn!(what) } }
	fn error_expect(&self, what: &str) { if self.is_unexpected() { tracing::error!(what) } }
}
impl<T> SoftExpect for Option<T> {
	fn is_unexpected(&self) -> bool { self.is_none() }
}
impl<T, E> SoftExpect for Result<T, E> {
	fn is_unexpected(&self) -> bool { self.is_err() }
}*/

/*impl std::ops::DerefMut for RoomToken {
	fn deref_mut(&mut self) -> &mut [u8; Self::LEN] { &mut self.0 }
}*/


/*#[derive(Serialize, Deserialize)]
pub struct PlayerId(u8);
impl PlayerId {
	pub fn new(id: u8) {
		if id > MAX_PLAYER_COUNT {
			
		}
		Self(id)
	}
	pub fn usize(&self) -> usize {
		self.0 as usize
	}
}
impl std::ops::Deref for PlayerId {
	type Target = u8;
	fn deref(&self) -> &Self::Target { &self.0 }
}*/

//pub struct PlayerIcon(u8);

