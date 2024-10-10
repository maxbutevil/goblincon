

/*const PREFIXES: &[&str] = &[
	"The Great",
	"The Eponymous",
	
];
const SUFFIXES: &[&str] = &[
	""
];*/

use core::fmt;
use core::fmt::Display;

/*struct Table<T: Copy + 'static> {
	//entries: Box<[T]>
	entries: &'static [T]
}
impl<T: Copy + 'static> Table<T> {
	const fn new(entries: &'static [T]) -> Self {
		assert!(!entries.is_empty());
		Self { entries }
	}
	fn pick(&self) -> T {
		use rand::Rng;
		let idx = rand::thread_rng().gen_range(0..self.entries.len());
		self.entries[idx]
	}
}
impl<T: Copy + 'static + Display> Display for Table<T> {
	fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
		write!(f, "{}", self.pick())
	}
}*/

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
		use rand::Rng;
		self.pick_at(rand::thread_rng().gen_range(0..self.total_weight))
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

const TEMPLATES: FnTable = Table::new(&[
	(256, &[
		
	]),
	(128, &[
		|| format!("{ROOT}"),
		|| format!("{PREFIX} {ROOT}"),
		|| format!("{ROOT}{SUFFIX}"),
		|| format!("{ROOT} the {ADJECTIVE}"),
	]),
	(64, &[
		|| format!("{PREFIX} {ROOT} the {ADJECTIVE}"),
	]),
	(32, &[
		|| format!("{PREFIX} {ROOT}{SUFFIX}"),
	]),
	(16, &[
		|| format!("{ADJECTIVE} {ROOT}"),
	]),
	(8, &[
		|| format!("{ADJECTIVE} {ROOT}{SUFFIX}")
	]),
	(2, &[
		|| format!("{LEGENDARY}")
	]),
]);

const LEGENDARY: StrTable = Table::new(&[
	(1, &[
		"The Audiovisual Homunculus",
		"Steamroller Victim",
	]),
]);
const ROOT: StrTable = Table::new(&[
	(1, &[
		/* Goblinsonas */
		"Axmay",
		"Gatthew",
		"Jobnis",
		"Glarsom",
		
		/* Bicons */
		"Mobi",
		"Clungo",
		"Quirko",
		"Wackine",
		"Milburt",
		"Chrysanthorp",
		"Graggle",
		
		/* Epithets */
		"Kills People",
		"Boy Melter",
		"Fry Frencher",
		
		/* Misc */
		"Wonk",
		"Thimbel",
		"Smelmer",
		"Torpeed",
		"Walter",
		"Jimmy",
		//"Gaylord",
		//"Gerson",
		"Bindle",
		"Grim",
		"Gnarlie",
		"Pockets",
		
		//"Orinboringor",
		
		//"Romble Gomper",
		//"Gomp Rombler",
		//"The Girl Reading This",
		"Torso Joe",
		"Nilbog",
		"Wattelglot",
		"Mingle",
		"The Sniff",
		"Londo Moneir",
		//"Dehydrus",
		"Chin Steve",
		
		"Fangle",
		"Wilford",
		"Mullet",
		"Shades",
		"Chad",
		"Bruce",
		"Milko",
		"Mingus",
		"Kilter",
		"Kilbert",
		"Dimples",
		"Devio",
		"Joe",
		"Donny",
		"Kreibert",
		"Greeb",
		"Screeble",
		"Comedius",
		"Fink",
		"Hamper",
		"Trundle",
		"Wrinkle",
		"Crease",
		"Splinky",
		"Jingle",
		"Chip",
		"Bucky",
		"Cootie",
		"Quag",
		"Munch",
		"Nom",
		//"Lactoid",
		"Toothless",
		"Oculus",
		"Chunk",
		"Swinkle",
		"Spew",
		"Flaps",
		"Homuncules",
		"Glug",
		"Lasanga",
		"Milburt",
		
		/* Carson's Contributions */
		//"Jorm",
		//"Klum",
		"Lumpis",
		"Crink",
		"Nubbs",
		"Phlemble",
		"Flirm",
		"Squigius",
		"Quelq",
		"Grinkles",
		"Toadus",
		"Fleam",
		"Cruggle",
		"Minch",
		"Mindle",
		"Squeakom",
		"Mindoid",
		"The Squinge",
		"Fluppis",
		"Flog",
		"Mandiblo",
		"Plogg",
		"Jopple",
		//"Wendom",
		"Tubo",
		"Yurn",
		"Agmor",
		"Dimp",
		"Tuggules",
		"Uncle Pete",
		"Slobbo",
		"Splunck",
		"Bubblo",
		"Torso Glunn",
		"Plopi Grosse",
		"Murt",
		"Crinkle",
		"Flappold",
		"Goremack McClundis",
		"Toto Swinki",
		"Teef",
		"Poddle",
		"The Great Worm",
		"Clog",
		"Flapple",
		"Oom",
		"Emunceo",
		//"Vinmor",
		"Fockle",
		"Mogum",
		"Gobbi Loach",
		"King Tundis",
		
		/* Charlie's Contributions */
		"Schplorples",
		"Geeblesmorp",
		"Bringlesnop",
		"Pongel",
		"Greegle",
		"Lumpsucker",
	]),
]);
const ADJECTIVE: StrTable = Table::new(&[
	(1, &[
		"Hairy",
		"Magnificent",
		"Ominous",
		"Devilish",
		"Colossal",
		"Puny",
		"Scrawny",
		"Average",
		"Lazy",
		"Curious",
		"Chubby",
		"Glamorous",
		"Handsome",
		"Bold",
		"Victorious",
		"Obnoxious",
		"Fierce"
	]),
]);
const SUFFIX: FnTable = Table::new(&[
	(3, &[
		|| format!(" {NORMAL_SUFFIX}")
	]),
	(1, &[
		|| format!(", {COMMA_SUFFIX}")
	])
]);
const NORMAL_SUFFIX: StrTable = Table::new(&[
	(4, &[
		"Jr."
	]),
	(2, &[
		"Sr.",
		"the Third"
	])
]);
const COMMA_SUFFIX: StrTable = Table::new(&[
	(1, &[
		"Esq."
	])
]);
const PREFIX: StrTable = Table::new(&[
	(16, &[
		"Mr.",
		"Dr."
	]),
	(8, &[
		"Mrs.",
		"Ms."
	]),
]);


pub fn generate(count: usize) -> Box<[String]> {
	(0..count).map(|_| format!("{TEMPLATES}")).collect()
}

#[test]
fn test() {
	println!("{:?}", generate(100));
	//assert!(false);
}

/*fn pick<T>(choices: &[T]) -> T {
	if choices.is_empty() {
		panic!();
	}
	use rand::Rng;
	let mut rng = rand::thread_rng();
	let idx = rand::thread_rng().gen_range(0..choices.len());
	choices[idx]
}*/
/*pub fn generate(count: usize) -> Box<[&'static str]> {
	let mut rng = rand::thread_rng();
	rand::seq::index::sample(&mut rng, NAMES.len(), count)
		.iter()
		.filter_map(|i| NAMES.get(i).map(|i| *i))
		.collect()
}*/

