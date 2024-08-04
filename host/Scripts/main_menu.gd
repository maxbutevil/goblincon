class_name MainMenu
extends Control


func _on_drawblins_button_pressed():
	Client.connect_to_server(Drawblins);


