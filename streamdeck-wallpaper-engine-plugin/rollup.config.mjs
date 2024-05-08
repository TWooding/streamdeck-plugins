import commonjs from "@rollup/plugin-commonjs";
import nodeResolve from "@rollup/plugin-node-resolve";
import typescript from "@rollup/plugin-typescript";
import copy from 'rollup-plugin-copy';
import esbuild from 'rollup-plugin-esbuild';
import path from "node:path";
import url from "node:url";

const isWatching = !!process.env.ROLLUP_WATCH;
const sdPlugin = "com.twooding.github-streamdeck-wallpaper-engine-plugin.sdPlugin";

/**
 * @type {import('rollup').RollupOptions}
 */
const config = {
	input: "src/plugin.ts",

	output: {
		format: 'esm',
		file: `${sdPlugin}/bin/plugin.js`,
		sourcemap: isWatching,
		sourcemapPathTransform: (relativeSourcePath, sourcemapPath) => {
			return url.pathToFileURL(path.resolve(path.dirname(sourcemapPath), relativeSourcePath)).href;
		}
	},
	plugins: [
		copy({
			targets: [
				{ src: 'src/css/**/*', dest: `${sdPlugin}/css` },
				{ src: 'src/imgs/**/*', dest: `${sdPlugin}/imgs` },
				{ src: ['src/index.html'], dest: `${sdPlugin}/` },
				{ src: ['manifest.json'], dest: `${sdPlugin}/` }
			]
		}),
		{
			name: "watch-externals",
			buildStart: function () {
				this.addWatchFile(`manifest.json`);
				this.addWatchFile('src/index.html');
			},
		},
		typescript({
			mapRoot: isWatching ? "./" : undefined
		}),
		nodeResolve({
			browser: false,
			exportConditions: ["node"],
			preferBuiltins: true
		}),
		commonjs(),
		esbuild({
			minify: true,
			target: 'es2015', // default, or 'es20XX', 'esnext'
			jsx: 'preserve', // default, or 'preserve'
		}),
		{
			name: "emit-module-package-file",
			generateBundle() {
				this.emitFile({ fileName: "package.json", source: `{ "type": "module" }`, type: "asset" });
			}
		},
	]
};

export default config;