

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
	/*const fn unweighted(values: &'static [T]) -> Self {
		Self::new([(1, values)])
	}*/
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
	/*(96, &[
		
	]),*/
	(64, &[
		|| format!("{PREFIX} {ROOT}"),
		|| format!("{ROOT} the {ADJECTIVE}"),
		|| format!("{ROOT}{SUFFIX}"),
	]),
	/*(32, &[
		
	]),*/
	(16, &[
		|| format!("{ROOT}"),
		|| format!("{PREFIX} {ROOT}, {COMMA_SUFFIX}"),
		|| format!("{PREFIX} {ROOT} the {ADJECTIVE}"),
	]),
	(8, &[
		|| format!("{ADJECTIVE} {ROOT}"),
		|| format!("{PREFIX} {ROOT} {STANDARD_SUFFIX}"),
	]),
	(4, &[
		|| format!("{ADJECTIVE} {ROOT}{SUFFIX}")
	]),
	(2, &[
		|| format!("{LEGENDARY}"),
	]),
	(1, &[	
		|| format!("{LEGENDARY}{SUFFIX}")
	]),
]);

const LEGENDARY: StrTable = Table::new(&[
	(1, &[
		"The Audiovisual Homunculus",
		"Steamroller Victim",
		"The Great Worm",
		"The Squinge",
		"Poboigh' Krakenstool",
		"Her Majesty the Wumplord",
		"Leopard Skin Clamatomorg",
		"Herb Partridge-Toad",
		"Calamitous Wreak",
	]),
]);

//const COMPOUND: 
/*const COMPOUND_PRE: StrTable = StrTable::new(&[
	(1, &[
		"Hel",
		"Bal",
		"Ar",
		"Com",
		"Wolf",
		"Crug",
		"Lar"
	]),
]);
const COMPOUND_POST: StrTable = StrTable::new(&[
	(1, &[
		"bolge",
		"grug",
		"puter",
		"lord",
		"crug"
	]),
]);*/

const ROOT: StrTable = Table::new(&[
	(1, &[
		/* Goblinsonas */
		"Mikmak",
		"Gatthew",
		"Jobnis",
		"Glarsom",
		"Burger",
		"Bibi Bano",
		
		/* Bicons */
		"Mobi",
		"Clungo",
		"Quirko",
		"Wackine",
		"Milburt",
		//"Chrysanthorp",
		"Graggle",
		"Mindoid",
		"Twisselton",
		
		/* Epithets */
		"Kills People",
		"Boy Melter",
		"Fry Frencher",
		
		/* Misc */
		"Wonk",
		"Thimbel",
		"Smelmer",
		"Torpedo",
		"Walter",
		"Jimmy",
		"Chuck",
		//"Gaylord",
		//"Gerson",
		"Bindle",
		//"Grim",
		//"Gnarlie",
		"Pockets",
		//"Orinboringor",
		
		//"Romble Gomper",
		//"Gomp Rombler",
		//"Torso Joe",
		//"Nilbog",
		//"Wattelglot",
		"Mingle",
		//"The Sniff",
		//"Londo Moneir",
		//"Chin Steve",
		"Chin",
		"Chindle",
		
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
		"Devious",
		//"Joe",
		//"Donny",
		//"Kreibert",
		//"Greeb",
		"Screeble",
		//"Comedius",
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
		//"Oculus",
		"Chunk",
		"Swinkle",
		"Spew",
		"Flaps",
		"Homuncules",
		"Glug",
		"Lasanga",
		//"Tom",
		"Butterlord",
		//"Garfield",
		//"Dixon",
		//"Teddy",
		"Fingers",
		"Bones",
		"Knees",
		"Toes",
		"Chompers",
		//"Nab",
		//"Jaxon",
		"Baldo",
		"Dingus",
		"Smooch",
		//"Grin",
		"Bigfoot",
		"Gimmsby",
		"Wrangle",
		"Gub",
						
		/* C's Contributions */
		//"Jorm",
		//"Klum",
		"Lumpis",
		"Crink",
		"Nubbs",
		"Phlemble",
		"Flirm",
		//"Squigius",
		//"Quelq",
		"Grinkles",
		"Toadus",
		"Fleam",
		"Cruggle",
		//"Minch",
		//"Mindle",
		"Squeakom",
		//"The Squinge",
		"Fluppis",
		"Flog",
		"Mandiblo",
		"Plogg",
		"Jopple",
		//"Wendom",
		"Tubo",
		//"Yurn",
		//"Agmor",
		"Dimp",
		//"Tuggules",
		"Uncle Pete",
		"Slobbo",
		"Splunck",
		"Bubblo",
		//"Torso Glunn",
		//"Plopi Grosse",
		"Murt",
		"Crinkle",
		"Flappold",
		//"Goremack McClundis",
		//"Toto Swinki",
		"Teef",
		"Poddle",
		"Clog",
		"Flapple",
		//"Oom",
		//"Emunceo",
		//"Vinmor",
		"Fockle",
		//"Mogum",
		//"Gobbi Loach",
		//"King Tundis",
		
		/* P's */
		"Loopus",
		"Frundick",
		
		/* V's */
		
		/* C's Contributions */
		"Schplorples",
		"Geeblesmorp",
		"Bringlesnop",
		"Pongel",
		"Greegle",
		"Lumpsucker",
		
		"Crunglespborp"
	]),
]);
const ADJECTIVE: StrTable = Table::new(&[
	(8, &[
		"Hairy",
		"Bald",
		"Magnificent",
		//"Ominous",
		"Devilish",
		"Colossal",
		//"Puny",
		"Scrawny",
		//"Average",
		"Lazy",
		"Curious",
		"Chubby",
		"Glamorous",
		"Handsome",
		"Bold",
		//"Victorious",
		//"Obnoxious",
		//"Fierce",
		"Devious",
		"Devilish",
		"Beautiful",
		"Repulsive",
		"Sinister",
		"Small",
	]),
	(2, &[
		"Pompous",
	]),
	(1, &[
		"Goblinistic",
		"Vainglorious"
	]),
]);
/*const PRE_TITLES: StrTable = Table::new(&[
	(1, &[
		"Son of ",
	])
]);
const POST_TITLES: StrTable = Table::new(&[
	(1, &[
		"'s Evil Twin"
	]),
]);*/
const SUFFIX: FnTable = Table::new(&[
	(4, &[
		|| format!(" {STANDARD_SUFFIX}")
	]),
	(1, &[
		|| format!(", {COMMA_SUFFIX}")
	]),
]);
const STANDARD_SUFFIX: StrTable = Table::new(&[
	(8, &[
		"Jr.",
	]),
	(4, &[
		"Sr.",
	]),
	(1, &[
		"the Third",
	])
]);
const COMMA_SUFFIX: StrTable = Table::new(&[
	(2, &[
		"PhD",
		"MD",
	]),
	(1, &[
		"Esq.",
	])
]);
const PREFIX: StrTable = Table::new(&[
	/*(16, &[
		
	]),*/
	(8, &[
		"Mr.",
		"Dr."
	]),
	(4, &[
		"Mrs.",
		"Ms.",
		"Uncle",
		"Aunt",
	]),
	(2, &[
		"Professor",
		"Senator",
		"Captain",
		"Mayor",
		"Coach",
		"Agent",
		
		/* Gendered Pairs */
		"King",
		"Queen",
		"Sir",
		"Madam",
		"Lord",
		"Lady",
	]),
	(1, &[
		"Major",
		"Colonel",
		"General",
		"Admiral",
		"Old Man",
		"Madame",
	])
]);

fn generate(count: usize, table: &FnTable) -> Box<[String]> {
	(0..count).map(|_| format!("{table}")).collect()
}

pub fn generate_names(count: usize) -> Box<[String]> {
	return generate(count, &TEMPLATES);
}

#[test]
fn name_dump() {
	println!("{:?}", generate_names(100));
}
