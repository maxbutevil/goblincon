
use std::pin::Pin;
use tokio::time::{sleep, Sleep, Instant, Duration};
pub struct Timeout(Pin<Box<Sleep>>);
//struct Heartbeat(Timeout);
impl Timeout {
	pub fn new(duration: Duration) -> Self {
		Self(Box::pin(sleep(duration)))
	}
	
	pub fn reset(&mut self, duration: Duration) -> u64 {
		self.as_mut().reset(Instant::now() + duration);
		self.end_millis()
	}
	pub fn reset_scaled(&mut self, duration: Duration, scale_factor: f32) -> u64 {
		self.reset(duration.mul_f32(scale_factor))
	}
	pub fn reset_dynamic(&mut self, duration: DynamicDuration, num_players: usize) -> u64 {
		self.reset(duration.duration(num_players))
	}
	pub fn reset_dynamic_scaled(&mut self, duration: DynamicDuration, num_players: usize, scale_factor: f32) -> u64 {
		self.reset(duration.duration(num_players).mul_f32(scale_factor))
	}
	
	/*pub fn reset(&mut self, duration: Duration) -> f32 {
		self.as_mut().reset(Instant::now() + duration);
		duration.as_secs_f32()
	}
	pub fn reset_scaled(&mut self, duration: Duration, scale_factor: f32) -> f32 {
		self.reset(duration.mul_f32(scale_factor))
	}
	pub fn reset_dynamic(&mut self, duration: DynamicDuration, num_players: usize) -> f32 {
		self.reset(duration.duration(num_players))
	}
	pub fn reset_dynamic_scaled(&mut self, duration: DynamicDuration, num_players: usize, scale_factor: f32) -> f32 {
		self.reset(duration.duration(num_players).mul_f32(scale_factor))
	}*/
	pub fn remaining(&self) -> Duration {
		self.deadline() - tokio::time::Instant::now()
	}
	pub fn remaining_secs(&self) -> f32 {
		self.remaining().as_secs_f32()
	}
	
	fn end_duration(&self) -> Duration {
		use std::time::{SystemTime, UNIX_EPOCH};
		let end_time = SystemTime::now() + self.remaining();
		let end_duration = end_time.duration_since(UNIX_EPOCH);
		
		match end_duration {
			Ok(duration) => duration,
			Err(err) => {
				tracing::error!("error getting deadline timestamp (somehow): {err}");
				Duration::default() // this is a bad default, but this error will never ever happen
			}
		}
	}
	/*pub fn end_secs(&self) -> u64 {
		self.end_duration().as_secs()
	}
	pub fn end_millis(&self) -> u128 {
		self.end_duration().as_millis()
	}*/
	pub fn end_millis(&self) -> u64 {
		self.end_duration()
			.as_millis()
			.try_into()
			.unwrap_or(0_u64) // this is also a bad default, but again, this error will never ever happen
	}
	
	
	/*pub fn deadline_secs(&self) -> u64 {
		use std::time::{SystemTime, UNIX_EPOCH};
		
		let end_time = SystemTime::now() + self.remaining();
		let end_duration = end_time.duration_since(UNIX_EPOCH);
		
		match end_duration {
			Ok(duration) => duration.as_secs(),
			Err(err) => {
				tracing::error!("error getting deadline timestamp (somehow): {err}");
				0 // this is probably a bad default, but this error will never happen
			}
		}
	}*/
}
impl std::ops::Deref for Timeout {
	type Target = Pin<Box<Sleep>>;
	fn deref<'a>(&'a self) -> &'a Pin<Box<Sleep>> {
		&self.0
	}
}
impl std::ops::DerefMut for Timeout {
	fn deref_mut<'a>(&'a mut self) -> &'a mut Pin<Box<Sleep>> {
		&mut self.0
	}
}
/* A duration that varies based on the number of players present */
pub struct DynamicDuration {
	base_millis: u64,
	per_player_millis: u64
}
#[allow(dead_code)]
impl DynamicDuration {
	pub const fn from_secs(base_secs: u64, per_player_secs: u64) -> Self {
		Self::from_millis(base_secs * 1000, per_player_secs * 1000)
	}
	pub const fn from_millis(base_millis: u64, per_player_millis: u64) -> Self {
		Self { base_millis, per_player_millis }
	}
	pub const fn secs(&self, num_players: usize) -> u64 {
		self.millis(num_players).div_ceil(1000)
	}
	pub const fn millis(&self, num_players: usize) -> u64 {
		self.base_millis + (num_players as u64) * self.per_player_millis
	}
	pub const fn duration(&self, num_players: usize) -> Duration {
		Duration::from_millis(self.millis(num_players))
	}
}
