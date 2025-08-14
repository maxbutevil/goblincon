import { defineConfig, RsbuildEntryDescription } from '@rsbuild/core';
import { pluginSass } from '@rsbuild/plugin-sass';



export default defineConfig(({ env }) => ({
	source: {
		entry: {
			"test/host": { html: env === "development", import: "./src/testing/test_host.ts" },
			"test/play": { html: env === "development", import: "./src/testing/test_play.ts" },
			"test/draw": { html: env === "development", import: "./src/testing/test_draw.ts" },
			"test/gen": { html: env === "development", import: "./src/testing/gen.ts" },
			//"test/playground": { html: env === "development", import: "./src/testing/playground.ts" },
			
			host: "./src/host/index.ts",
			play: "./src/play/index.ts",
		}
	},
	html: {
		title: "GoblinCon",
		favicon: "./icons/01/favicon.ico",
		
		
		meta: {
			"charset": { charset: 'UTF-8' },
			"viewport": "width=device-width, initial-scale=1",
			"theme-color": "#f7cab7",
			"description": "A goblin-drawing party game for 3-16 players! One player hosts on a laptop or PC, then everyone joins from their mobile devices.",
			//"theme-color": "#d2b48c",
			//viewport: "width=device-width, initial-scale=1, maximum-scale=1"
		},
		tags: [
			{
				tag: "link",
				attrs: { rel: "preconnect", href: "https://fonts.googleapis.com" }
			},
			{
				tag: "link",
				attrs: { rel: "preconnect", href: "https://fonts.gstatic.com", crossorigin: true }
			},
			{
				tag: "link",
				attrs: { rel: "stylesheet", href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&family=Roboto:ital,wght@0,100..900;1,100..900&display=swap" }
			}
		],
		
		inject: "body",
		scriptLoading: "blocking",
		
		/*appIcon: {
			name: "GoblinCon",
			icons: [
				
			],
		},*/
	},
	plugins: [pluginSass()],
	output: {
		copy: [
			{ from: "./src/assets/misc/background.png", to: "static/background.png" }
		]
		//minify: false,
	},
}));
