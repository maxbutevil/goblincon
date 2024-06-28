class_name VotingChoice
extends Drawing

var caption: String;

func initialize(drawing: ImageTexture, _name: String):
	set_texture(drawing);
	if !is_inside_tree():
		await tree_entered;
	$NameLabel.set_text(_name);
func set_vote_count(count: int):
	$VoteLabel.set_text("%s votes" % count);
