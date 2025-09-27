


use super::*;

pub fn generate(count: usize) -> Box<[&'static str]> {
	THEMES
		.choose_multiple(&mut rand::rng(), count)
		.map(|t| *t)
		.collect()
}

const THEMES: &[&str] = &[
	
	/* Misc. Adjectives */
	"Sad", // Opposing pairs
	"Happy",
	"Soft",
	"Tough",
	"Loud",
	"Quiet",
	"Bald",
	"Hairy",
	"Friendly",
	"Unpleasant",
	
	"Cute", // 'Cute Little Guy' Descriptors
	"Weak",
	"Round",
	"Silly",
	"Clumsy",
	"Fluffy",
	"Pretty",
	"Squishy",
	"Playful",
	"Adorable",
	
	"Scary", // 'Scary Big Guy' Descriptors'
	"Tough",
	"Spooky",
	"Strong",
	"Sinister",
	"Muscular",
	"Powerful",
	
	"Tiny", // Sizes
	"Small",
	"Large",
	"Gigantic",
	"Microscopic",
	
	/* Nature */
	"Dogs",
	"Cats",
	"Worm",
	"Bugs",
	"Fish",
	"Birds",
	
	"Trees",
	"Plants",
	"Reptiles",
	"Amphibians",
	
	"Pets",
	"Zoo Animals",
	"Farm Animals",
	"Sea Creatures",
	
	/* Environments */
	"Beach",
	"Forest",
	"Desert",
	"Underwater",
	"Outer Space",
	
	/* Jobs */
	"Detectives",
	"Doctors",
	"CEOs",
	"Pirates",
	"Heroes",
	"Villains",
	
	/* Supernatural / Fictional */
	"Aliens",
	"Wizards",
	"Witches",
	
	"Elves", // Fantasy Races
	"Gnomes",
	"Dwarves",
	"Goblins",
	
	"Ghosts", // Spooky Creatures
	"Demons",
	"Zombies",
	"Spirits",
	"Vampires",
	
	/* Genres */
	"Sci-Fi",
	"Comedy",
	"Mystery",
	"Cartoon",
	//"Western",
	//"Fantasy",
	
	/* Abstract/Conceptual */
	"Abstract Concepts", // Abstract
	"Imaginary Friends",
	"Personified Emotions",
	
	"Inanimate Objects", // Categories
	"Mythical Creatures",
	
	/* Other Traits */
	"Celebrities", // Pop Culture
	"World Leaders",
	"Historical Figures",
	
	"The 1%",
	"Vehicles",
	"Good Kissers",
	"Mischief Makers",
];



/*#[test]
fn check_duplicates() {
	
	[THEMES]
		.iter()
		.for_each(|t| t.check_duplicates())
}*/

/*const TEMPLATES: FnTable = Table::new(&[
	(1, &[
		|| "wacky".to_string()
	])
]);*/

