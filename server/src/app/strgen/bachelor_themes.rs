


use super::*;

pub fn generate(count: usize) -> Box<[&'static str]> {
	//THEMES.generate_count(count)
	THEMES
		.choose_multiple(&mut rand::rng(), count)
		.map(|t| *t)
		.collect()
}

/*const THEMES: StrTable = StrTable::new(&[
	(1, &[
		//...
	])
]);*/

const THEMES: &[&str] = &[
	
	/* Adjectives */
	"Muscular",
	"Hairy",
	"Bald",
	"Sinister",
	"Cute",
	"Squishy",
	"Fluffy",
	"Soft",
	"Large",
	"Small",
	"Scary",
	"Musical",
	
	/* Jobs */
	"Detectives",
	"Doctors",
	"CEOs",
	"Pirates",
	
	/* Supernatural */
	"Goblins",
	"Ghosts",
	"Spirits",
	"Devils",
	"Demons",
	"Vampires",
	"Zombies",
		
	/* Nature */
	"Sea Creatures",
	"Birds",
	"Plants",
	
	/* Genre */
	"Western",
	"Sci-Fi",
	"Murder Mystery",
	"Medical Drama",
	"Comedy",
	"Cartoon",
	
	/* Abstract */
	"Abstract Concepts",
	"Personified Emotions",
	"Imaginary Friends",
	
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

