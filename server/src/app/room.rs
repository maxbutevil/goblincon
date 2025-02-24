	




use tokio::sync::mpsc;
use serde::{Deserialize, Deserializer};
use super::{WebSocket, PlayerId, PlayerIcon, PlayerToken};

pub type Sender = mpsc::Sender<Event>;
pub type Receiver = mpsc::Receiver<Event>;
pub enum Event {
	PlayerJoin { socket: WebSocket, name: String, icon: PlayerIcon },
	PlayerReconnect { socket: WebSocket, player_id: PlayerId, token: PlayerToken }
}

pub fn channel() -> (Sender, Receiver) {
	const EVENT_QUEUE_SIZE: usize = 2;
	mpsc::channel(EVENT_QUEUE_SIZE)
}

macro_rules! deserializer_transform {
	($func_name:ident, |$val:ident: $t:ty| $transform:expr) => {
		pub fn $func_name<'de, D: Deserializer<'de>>(deserializer: D) -> Result<$t, D::Error> {
			let $val: $t = Deserialize::deserialize(deserializer)?;
			Ok($transform)
		}
	}
}

deserializer_transform!(clamp_round_count, |v: usize| v.clamp(1, 16));
deserializer_transform!(clamp_time_factor, |v: f32| v.clamp(0.2, 5.0));

//

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





