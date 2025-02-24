


use super::*;

pub fn generate(count: usize) -> Box<[String]> {
	THEMES.generate_count(count)
}

const THEMES: StrTable = StrTable::new(&[
	(1, &[
		"Goblins",
		"Mischief Makers",
		"Abstract Concepts",
		
	])
]);

#[test]
fn check_duplicates() {
	[THEMES]
		.iter()
		.for_each(|t| t.check_duplicates())
}

/*const TEMPLATES: FnTable = Table::new(&[
	(1, &[
		|| "wacky".to_string()
	])
]);*/

