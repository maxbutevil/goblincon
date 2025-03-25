	



use crate::globals::*;
use tokio::sync::mpsc;
use serde::{Deserialize, Deserializer};

use super::{WebSocket, PlayerId, PlayerIcon, PlayerToken};

pub type Sender = mpsc::Sender<Event>;
pub type Receiver = mpsc::Receiver<Event>;
pub enum Event {
	PlayerJoin { socket: WebSocket, name: String, icon: PlayerIcon },
	PlayerReconnect { socket: WebSocket, player_id: PlayerId, token: PlayerToken, forced: bool }
}

pub fn channel() -> (Sender, Receiver) {
	const EVENT_QUEUE_SIZE: usize = 2;
	mpsc::channel(EVENT_QUEUE_SIZE)
}

macro_rules! deserializer_transform {
	($func_name:ident, |$val:ident: $t:ty| $transform:expr) => {
		pub fn $func_name<'de, D: Deserializer<'de>>(deserializer: D) -> Result<$t, D::Error> {
			fn inner($val: $t) -> $t {
				$transform
			}
			
			let initial: $t = Deserialize::deserialize(deserializer)?;
			Ok(inner(initial))
		}
	}
}

deserializer_transform!(clamp_round_count, |v: usize| v.clamp(1, 16));
deserializer_transform!(clamp_time_factor, |v: f32| v.clamp(0.2, 5.0));
deserializer_transform!(cap_submission_name, |v: Option<String>| {
	
	let Some(v) = v else {
		return None;
	};
	
	/* May come back to this; for now, names that are too long are simply dropped */
	if v.len() <= MAX_SUBMISSION_NAME_LEN {
		Some(v)
	} else {
		None
	}
	
	/*if v.len() > MAX_SUBMISSION_NAME_LEN {
		if let Some((last_index, _)) = v.char_indices().nth(MAX_NAME_LEN) {
			v.truncate(last_index);
			Some(v)
		} else {
			Some(v)
		}
		tracing::debug!("Received name that is too long");
		return None;
	}*/
	//None
});
//


/*#[test]
fn test_cap_submission_name() {
	println!("");
}*/


/*
pub trait Room<'a, R, E> {
	
	async fn run(self) -> Result<R, E>;
}*/
//pub trait Game<'a, E> : Room <'a, ()> {}

/*use super::client::ClientIndex;
pub trait Game<'a> {
	fn new(clients: &'a mut ClientIndex) -> (Sender, Self);
	async fn run(self) -> Result<(), ()>;
}*/


//impl Room<T: Game<'a, E>, 'a, (), E> for T {}


/*impl<T: Game, 'a, E> Room for T {
	fn new(clients: &'a mut ClientIndex) -> (Sender, Self) {
		
	}
}*/

/*pub trait Game<'a, E> {
	fn new(clients: &'a mut super::client::ClientIndex) -> (Sender, Self);
	async fn run(self) -> Result<(), E>;
}*/





