const path = require("path");
const fs = require('fs');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { CleanWebpackPlugin } = require('clean-webpack-plugin');
const appDirectory = fs.realpathSync(process.cwd());
const WebpackPwaManifest = require('webpack-pwa-manifest');
const webpack = require('webpack');

const isLocal = process.env.TERM_PROGRAM == 'vscode' && process.env.OS.includes("Windows");
console.log("Build for local webpack-dev-server: ", isLocal);

module.exports = {
    entry: path.resolve(appDirectory, "src/app.ts"),
    output: {
        //name for the js file that is created/compiled in memory
        filename: 'js/SotF-bundle.js'
    },
    resolve: {
        // extensions: [".ts"]
        extensions: [".tsx", ".ts", ".js"]
    },
    devServer: {
        host: 'localhost',
        port: 8080,
        disableHostCheck: true,
        historyApiFallback: true,
        watchOptions: { aggregateTimeout: 300, poll: 1000 },
        disableHostCheck: true,
        contentBase: path.resolve(appDirectory, "public"), //tells webpack to serve from the public folder
        publicPath: '/',
        hot: true,
        https: true,
        headers: {
          "Access-Control-Allow-Origin": "*",
          "Access-Control-Allow-Credentials": "true",
          "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, PATCH, OPTIONS",
          "Access-Control-Allow-Headers": "X-Requested-With, content-type, Authorization"
        }
    },
    module: {
        rules: [
            // {test: /\.tsx?$/,
            // loader: "ts-loader"}
            {
                test: /\.worker\.ts$/,
                use: [
                    {
                      loader: "worker-loader",
                    },
                    /*{
                      loader: "babel-loader",
                      options: {
                        presets: ["@babel/preset-env"],
                        esModule: false,
                      },
                    },*/
                ],
                exclude: /node_modules/
            },
            {
              test: /\.tsx?$/,
              use: "ts-loader",
              exclude: /node_modules/
            },
        ]
    },
    plugins: [
        new HtmlWebpackPlugin({
            inject: true,
            template: path.resolve(appDirectory, "public/index.html")
        }),
        new webpack.DefinePlugin({
          'process.env.sveAPI': (isLocal) ? "'media.felixlehner.de'" : "undefined",
          'process.env.authAPI': (isLocal) ? "'accounts.felixlehner.de/auth'" : "undefined",
          'process.env.accountsAPI': (isLocal) ? "'accounts.felixlehner.de'" : "undefined",
          'process.env.gameAPI': (isLocal) ? "'games.felixlehner.de'" : "undefined",
          'process.env.aiAPI': (isLocal) ? "'ai.felixlehner.de'" : "undefined",
        }),
        new CleanWebpackPlugin(),
        new WebpackPwaManifest({
          name: 'Survival of the Fittest',
          short_name: 'SotF',
          description: 'A card game',
          background_color: '#36465d',
          crossorigin: 'use-credentials',
          filename: "manifest.json",
          orientation: "landscape",
          display: "standalone",
          start_url: "/",
          fingerprints: true,
          theme_color: '#36465d',
          inject: true,
          ios: {
            "apple-mobile-web-app-capable": "yes",
            "apple-mobile-web-app-status-bar-style": "black-translucent",
            "apple-mobile-web-app-title": "Survival of the Fittest",
          },
          includeDirectory: true,
          icons: [
            {
                src: path.resolve('public/icons/icon.png'),
                sizes: [120, 152, 167, 180, 1024],
                destination: path.join('icons', 'ios'),
                ios: true
            },
            {
                src: path.resolve('public/icons/icon.png'),
                size: 1024,
                destination: path.join('icons', 'ios'),
                ios: 'startup'
            },
            {
                src: path.resolve('public/icons/icon.png'),
                sizes: [36, 48, 72, 96, 144, 192, 512],
                destination: path.join('icons', 'android')
            }
          ]
        }),
    ],
    mode: "development"
};