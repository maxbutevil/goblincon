import { defineConfig } from '@rsbuild/core';

export default defineConfig({
	source: {
		entry: {
			testing: "./src/testing.ts",
			host: "./src/host.ts",
			play: "./src/play.ts",
		}
	},
	html: {
		title: "GoblinCon",
		meta: {
			charset: { charset: 'UTF-8' },
			viewport: "width=device-width, user-scalable=no"
		}
	}
});
