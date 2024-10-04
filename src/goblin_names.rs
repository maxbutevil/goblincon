

/*const PREFIXES: &[&str] = &[
	"The Great",
	"The Eponymous",
	
];
const SUFFIXES: &[&str] = &[
	""
];*/

const NAMES: &[&str] = &[
	
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
	"Steamroller Victim",
	"The Audiovisual Homunculus",
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
	
];

enum NameGen {
	
}


pub fn generate(count: usize) -> Box<[&'static str]> {
	let mut rng = rand::thread_rng();
	rand::seq::index::sample(&mut rng, NAMES.len(), count)
		.iter()
		.filter_map(|i| NAMES.get(i).map(|i| *i))
		.collect()
}

