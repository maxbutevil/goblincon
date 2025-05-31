


use super::*;

pub fn generate(count: usize) -> Box<[&'static str]> {
	THEMES
		.choose_multiple(&mut rand::rng(), count)
		.map(|t| *t)
		.collect()
}

const THEMES: &[&str] = &[
	/* Adjectives */
	"Sad",
	"Happy",
	"Cute",
	"Squishy",
	"Fluffy",
	"Soft",
	"Friendly",
	"Beautiful",
	
	"Bald",
	"Hairy",
	"Muscular",
	"Tough",
	"Scary",
	"Sinister",
	
	"Loud",
	"Musical",
	
	"Microscopic",
	"Small",
	"Large",
	"Gigantic",
	
	/* Jobs */
	"Detectives",
	"Doctors",
	"CEOs",
	"Pirates",
	"Heroes",
	"Villains",
	
	/* Supernatural */
	"Goblins",
	"Ghosts",
	"Spirits",
	"Devils",
	"Demons",
	"Vampires",
	"Zombies",
	"Wizards",
	"Witches",
	
	/* Nature */
	"Trees",
	"Plants",
	"Bugs",
	"Fish",
	"Birds",
	"Reptiles",
	"Amphibians",
	"Zoo Animals",
	"Farm Animals",
	"Sea Creatures",
	
	/* Genre */
	"Western",
	"Sci-Fi",
	"Mystery",
	"Comedy",
	"Cartoon",
	"Fantasy",
	
	/* Abstract */
	"Abstract Concepts",
	"Personified Emotions",
	"Imaginary Friends",
	"Inanimate Objects",
	"Mythical Creatures",
	
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

