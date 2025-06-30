


use super::*;

pub fn generate(count: usize) -> Box<[&'static str]> {
	THEMES
		.choose_multiple(&mut rand::rng(), count)
		.map(|t| *t)
		.collect()
}

const THEMES: &[&str] = &[
	
	/* Misc. Adjectives */
	"Sad",
	"Happy",
	
	"Soft",
	"Cute",
	"Fluffy",
	"Squishy",
	
	"Friendly",
	"Beautiful",
	
	"Bald",
	"Hairy",
	"Scary",
	"Tough",
	"Muscular",
	"Sinister",
	
	"Loud",
	"Musical",
	
	"Microscopic",
	"Tiny",
	"Small",
	"Large",
	"Gigantic",
	
	/* Nature */
	"Dogs",
	"Cats",
	//"Monkeys",
	
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
	
	/* Supernatural */
	"Ghosts",
	//"Devils",
	"Demons",
	"Goblins",
	"Zombies",
	"Wizards",
	"Witches",
	"Spirits",
	"Vampires",
	
	/* Genre */
	"Sci-Fi",
	"Comedy",
	"Mystery",
	"Western",
	"Cartoon",
	"Fantasy",
	
	/* Abstract */
	"Imaginary Friends",
	"Inanimate Objects",
	"Mythical Creatures",
	"Abstract Concepts",
	"Personified Emotions",
	
	/* Other Traits */
	"Mischief Makers",
	"Good Kissers",
	"World Leaders",
	"Historical Figures",
	"The 1%",
	
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

