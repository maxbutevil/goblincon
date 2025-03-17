


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
	"Goblins",
	"Mischief Makers",
	"Abstract Concepts",
	"Sea Creatures",
	"Birds",
	"Muscular",
	"Hairy",
	"Bald",
	"Sinister",
	"Good Kissers",
	"Ghosts",
	"Spirits",
	"Devils",
	"Demons",
	"Cute",
	"Squishy",
	"Fluffy",
	"Soft",
	"Large",
	"Small",
	"Western",
	"Vampires",
	
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

