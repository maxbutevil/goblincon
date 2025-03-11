

use crate::types::*;

use core::fmt;
use core::fmt::Display;

pub mod goblin_names;
pub mod bachelor_themes;

type FnTable = Table<fn() -> String>;
type StrTable = Table<&'static str>;
struct Table<T: Copy + 'static> {
	entries: &'static [(usize, &'static [T])],
	total_weight: usize,
}
impl<T: Copy + 'static> Table<T> {
	const fn new(entries: &'static [(usize, &[T])]) -> Self {
		let mut total_weight = 0_usize;
		let mut i = 0;
		loop {
			if i >= entries.len() {
				break;
			}
			let (weight, values) = entries[i];
			assert!(weight > 0);
			total_weight += weight * values.len();
			i += 1;
		}
		assert!(total_weight > 0, "Table cannot be empty");
		Self { total_weight, entries }
	}
	fn pick(&self) -> T {
		self.pick_at(rand::rng().random_range(0..self.total_weight))
	}
	fn pick_at(&self, mut i: usize) -> T {
		for &(weight, values) in self.entries.iter() {
			let total_weight = weight * values.len();
			if i < total_weight {
				let idx = i / weight;
				return values[idx];
			}
			i -= total_weight;
		}
		unreachable!();
	}
}
impl StrTable {
	fn generate(&self) -> String {
		format!("{self}")
	}
	fn generate_count(&self, count: usize) -> Box<[String]> {
		(0..count).map(|_| self.generate()).collect()
	}
	
	#[cfg(test)]
	fn check_duplicates(&self) {
		for (_, lha) in self.entries.iter() {
			for (_, rha) in self.entries.iter() {
				for lhs in lha.iter() {
					for rhs in rha.iter() {
						if !std::ptr::eq(lhs, rhs) {
							assert_ne!(lhs, rhs);
						}
					}
				}
			}
		}
	}
}

impl FnTable {
	fn generate(&self) -> String {
		format!("{self}")
	}
	fn generate_count(&self, count: usize) -> Box<[String]> {
		(0..count).map(|_| self.generate()).collect()
	}
}

impl Display for StrTable {
	fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
		write!(f, "{}", self.pick())
	}
}
impl Display for FnTable {
	fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
		write!(f, "{}", self.pick()())
	}
}



