
use std::pin::Pin;
use tokio::time::{sleep, Sleep, Instant, Duration};
pub struct Timeout(Pin<Box<Sleep>>);
//struct Heartbeat(Timeout);
impl Timeout {
	pub fn new(duration: Duration) -> Self {
		Self(Box::pin(sleep(duration)))
	}
	pub fn reset(&mut self, duration: Duration) {
		self.as_mut().reset(Instant::now() + duration)
	}
	pub fn scaled(duration: Duration, scale_factor: f32) -> Duration {
		duration.mul_f32(scale_factor)
	}
	pub fn dynamic(duration: DynamicDuration, num_players: usize) -> Duration {
		Duration::from_millis(duration.millis(num_players))
	}
	pub fn scaled_dynamic(duration: DynamicDuration, scale_factor: f32, num_players: usize) -> Duration {
		Duration::from_millis(duration.millis(num_players)).mul_f32(scale_factor)
	}
	
	pub fn remaining(&self) -> Duration {
		self.deadline() - tokio::time::Instant::now()
	}
	pub fn remaining_secs(&self) -> f32 {
		self.remaining().as_secs_f32()
	}
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
