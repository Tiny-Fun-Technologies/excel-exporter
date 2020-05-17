const path = require('path');
const webpack = require('webpack');
const TsconfigPathsPlugin = require('tsconfig-paths-webpack-plugin');
const workSpaceDir = path.resolve(__dirname);

module.exports = (env) => {
	if (!env) { env = {production: false};}
	console.log("Compile environment:", env);
	return ({
		target: 'node',
		entry: path.join(workSpaceDir, 'src/main.ts'),
		output: {
			path: path.join(workSpaceDir, 'dist'),
			filename: 'binary.js'
		},
		module: {
			rules: [
				{ test: /\.tsx?$/, use: 'ts-loader', exclude: /node_modules/ },
				{ test:/\.ya?ml$/, use: [ "json-loader", "yaml-loader" ] },
				{ test:/\.(html|txt|md)$/, use: "raw-loader" },
			]
		},
		resolve: {
			extensions: [
				'.tsx', '.ts', '.js',
				".yaml", ".html", ".md", ".txt"
			],
			plugins: [
				new TsconfigPathsPlugin({configFile: path.join(workSpaceDir, 'tsconfig.json')})
			]
		},
		externals: {},
		plugins: [
		],
		devtool: env.production ? "" : "source-map",
		mode: "development",
	});
};