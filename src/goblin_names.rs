



const NAMES: &[&str] = &[
	"Dipshit",
	"Dumbass",
	"Quirko",
	"Wackine"
];

pub fn get_names(count: usize) -> Vec<&'static str> {
	
	let mut rng = rand::thread_rng();
	rand::seq::index::sample(&mut rng, NAMES.len(), count)
		.iter()
		.filter_map(|i| NAMES.get(i))
		.map(|i| *i)
		.collect()
	
}

