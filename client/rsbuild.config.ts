import { defineConfig, RsbuildEntryDescription } from '@rsbuild/core';
import { pluginSass } from '@rsbuild/plugin-sass';



export default defineConfig(({ env }) => ({
	source: {
		entry: {
			"testing/gen": { html: env === "development", import: "./src/testing/gen.ts" },
			"testing/host": { html: env === "development", import: "./src/testing/testing_host.ts" },
			"testing/play": { html: env === "development", import: "./src/testing/testing_play.ts" },
			host: "./src/host/host.ts",
			play: "./src/play/play.ts",
		}
	},
	html: {
		title: "GoblinCon",
		favicon: "./icons/01/favicon.ico",
		meta: {
			charset: { charset: 'UTF-8' },
			viewport: "width=device-width, initial-scale=1",
			//"theme-color": "#ccccc0",
			//viewport: "width=device-width, initial-scale=1, maximum-scale=1"
		},
		
		/*appIcon: {
			name: "GoblinCon",
			icons: [
				
			],
		},*/
	},
	plugins: [pluginSass()],
	output: {
		//minify: false,
	},
}));
