

/*const PREFIXES: &[&str] = &[
	"The Great",
	"The Eponymous",
	
];
const SUFFIXES: &[&str] = &[
	""
];*/

const NAMES: &[&str] = &[
	
	/* Goblinsonas */
	"Mobi",
	"Gatthew",
	"Jobnis",
	"Glarsom",
	
	/* Misc */
	"Clungo",
	"Quirko",
	"Wackine",
	"Milburt",
	
	"Wonk",
	"Thimbel",
	"Smelmer",
	"Torpeed",
	"Walter",
	"Jimmy",
	"Gaylord",
	"Gerson",
	"Bindle",
	"Grim",
	"Gnarlie",
	
	"Orinboringor",
	
	"Romble Gomper",
	"Gomp Rombler",
	"Kills People",
	"Boy Melter",
	//"The Girl Reading This",
	"Torso Joe",
	"Nilbog",
	"Wattelglot",
	"Mingle",
	"The Sniff",
	"Londo Moneir",
	"Dehydrus",
	
	"Fangle",
	"Wilford",
	"Mullet",
	"Shades",
	"Chad",
	"Bruce",
	"Milko",
	"Mingus",
	
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
	"Wendom",
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
	"Vinmor",
	"Fockle",
	"Mogum",
	"Gobbi Loach",
	"King Tundis",
	
	/* Charlie's Contributions */
	"Schplorples",
	"Geeblesmorp",
	"Bringlesnop",
	
];

enum NameGen {
	
}


pub fn get_names(count: usize) -> Vec<&'static str> {
	
	let mut rng = rand::thread_rng();
	rand::seq::index::sample(&mut rng, NAMES.len(), count)
		.iter()
		.filter_map(|i| NAMES.get(i).map(|i| *i))
		.collect()
	
}

