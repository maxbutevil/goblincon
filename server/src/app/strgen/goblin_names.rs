
use super::*;

pub fn generate(count: usize) -> Box<[String]> {
	TEMPLATES.generate_count(count)
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
	]),
	(4, &[
		|| format!("{ADJECTIVE} {ROOT}{SUFFIX}"),
		|| format!("{PREFIX} {ROOT} {STANDARD_SUFFIX}"),
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
		//"Help I'm Stuck In The GoblinCon Server",
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

const ADJECTIVE: StrTable = Table::new(&[
	(4, &[
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
		//"Curious",
		"Chubby",
		"Glamorous",
		"Handsome",
		//"Bold",
		//"Victorious",
		//"Obnoxious",
		//"Fierce",
		"Devious",
		"Beautiful",
		"Repulsive",
		"Sinister",
		"Small",
		"Villainous",
		"Heroic",
		"Deranged",
		"Kissable",
		"Adorable",
		"Muscular",
		"Cruel",
	]),
	(1, &[
		"Pompous",
		"Goblinistic",
		"Vainglorious",
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
		"Ms.", // "Mrs." and "Ms." are together as common as "Mr."
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
		"Prince",
		"Princess",
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

const ROOT: StrTable = Table::new(&[
	(1, &[
		/* Goblinsonas */
		"Mikmak",
		"Gatthew",
		//"Jobnis",
		"Glarsom",
		"Burger",
		"Bibi Bano",
		
		/* Bicons */
		"Mobi",
		"Clungo",
		"Quirko",
		"Wackine",
		"Milburt",
		"Graggle",
		"Mindoid",
		"Twisselton",
		
		/* Epithets */
		"Kills People",
		"Boy Melter",
		"Fry Frencher",
		
		/* Epithets-ish */
		"Moneylaunder",
		"Bankrob",
		"Dumpsterdive",
		"Leg Lord",
		"Legs Lord",
		"Butterlord",
		"Megadog",
		"Doubledog",
		"Snakelegs",
		"Horsehead",
		"Divorceo",
		
		/* Adjective-ish */
		"Baldo",
		"Hairyus",
		
		/* Misc */
		"Wonk",
		"Thimbel",
		"Smelmer",
		"Torpedo",
		//"Walter",
		//"Jimmy",
		//"Chuck",
		"Huell",
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
		//"Chindle",
		"Fangle",
		"Wilford",
		"Mullet",
		"Shades",
		"Chad",
		//"Bruce",
		"Milko",
		"Mingus",
		//"Kilter",
		//"Kilbert",
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
		"Lazanya",
		//"Tom",
		//"Garfield",
		//"Dixon",
		//"Teddy",
		"Fingers",
		"Bones",
		"Knees",
		"Toes",
		"Chompers",
		//"Nab",
		"Dingus",
		"Smooch",
		//"Grin",
		"Bigfoot",
		"Gimmsby",
		"Wrangle",
		//"Gub",
		"Bluntus",
		"Bongus",
		"Cowlick",
		"Cupcake",
		"Gullet",
		"Giggles",
		"Crunglespborp",
		"Crabs",
		"Snart",
		"Freaky",
		"Sticky",
		"Rug",
		"Wazoo",
		"Timmy",
		"Krebs",
		"Morgle",
		"Omnom",
		"Wiggles",
		"Wobbler",
		"Gug",
		"Foofles",
		"Orbo",
		
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
		//"Grinkles",
		"Toadus",
		//"Fleam",
		//"Cruggle",
		//"Minch",
		//"Mindle",
		"Squeakom",
		//"The Squinge",
		"Fluppis",
		"Flog",
		//"Mandiblo",
		"Plogg",
		//"Jopple",
		//"Wendom",
		//"Tubo",
		//"Yurn",
		//"Agmor",
		"Dimp",
		//"Tuggules",
		//"Uncle Pete",
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
		//"Poddle",
		"Clog",
		//"Flapple",
		//"Oom",
		//"Emunceo",
		//"Vinmor",
		//"Fockle",
		//"Mogum",
		//"Gobbi Loach",
		//"King Tundis",
		
		/* P's */
		"Loopus",
		//"Frundick",
		"Peablar",
		
		/* V's */
		
		/* C's Contributions */
		"Schplorples",
		"Geeblesmorp",
		"Bringlesnop",
		//"Pongel",
		"Greegle",
		"Lumpsucker", // N's
	]),
]);

#[test]
fn check_duplicates() {
	[ROOT, LEGENDARY, ADJECTIVE, PREFIX, COMMA_SUFFIX, STANDARD_SUFFIX]
		.iter()
		.for_each(|t| t.check_duplicates())
}


#[test]
fn goblin_name_dump() {
	println!("{:?}", generate(100));
}
