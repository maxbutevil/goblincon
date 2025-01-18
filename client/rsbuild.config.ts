import { defineConfig } from '@rsbuild/core';

export default defineConfig({
	source: {
		entry: {
			//testing: "./src/testing.ts",
			host: "./src/host/host.ts",
			play: "./src/play/play.ts",
			//howto: "./src/pages/howto.ts"
		}
	},
	html: {
		title: "GoblinCon",
		//favicon: "./favicons/01.ico",
		meta: {
			charset: { charset: 'UTF-8' },
			viewport: "width=device-width, initial-scale=1",
			//"theme-color": "#ccccc0",
			//viewport: "width=device-width, initial-scale=1, maximum-scale=1"
		},
		favicon: "./icons/01/favicon.ico",
		/*appIcon: {
			name: "GoblinCon",
			icons: [
				
			],
		},*/
	}
});
