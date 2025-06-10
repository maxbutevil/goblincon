import { defineConfig, RsbuildEntryDescription } from '@rsbuild/core';
import { pluginSass } from '@rsbuild/plugin-sass';



export default defineConfig(({ env }) => ({
	source: {
		entry: {
			"test/gen": { html: env === "development", import: "./src/testing/gen.ts" },
			"test/playground": { html: env === "development", import: "./src/testing/playground.ts" },
			"test/host": { html: env === "development", import: "./src/testing/test_host.ts" },
			"test/play": { html: env === "development", import: "./src/testing/test_play.ts" },
			host: "./src/host/index.ts",
			play: "./src/play/index.ts",
		}
	},
	html: {
		title: "GoblinCon",
		favicon: "./icons/01/favicon.ico",
		
		
		meta: {
			charset: { charset: 'UTF-8' },
			viewport: "width=device-width, initial-scale=1",
			"theme-color": "#e0cab6",
			//"theme-color": "#d2b48c",
			//viewport: "width=device-width, initial-scale=1, maximum-scale=1"
		},
		
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
