const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const WebpackBar = require('webpackbar');


module.exports = {
  entry: './src/main.ts',
  infrastructureLogging: {
    level: 'error',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'cditor.bundle.js',
    clean: true,
    publicPath: '/',
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
    extensionAlias: {
      ".js": [".js", ".ts"],
      ".cjs": [".cjs", ".cts"],
      ".mjs": [".mjs", ".mts"]
    },
    alias: {
      'Cditor': path.resolve(__dirname, "src")
    }
  },
  module: {
    rules: [
      {
        test: /\.([cm]?ts|tsx)$/, use: [
          {
            loader: 'ts-loader',
            options: {
              transpileOnly: true
            }
          }
        ]
      }
    ]
  },
  stats: 'errors-only',
  plugins: [
    new HtmlWebpackPlugin(),
    new WebpackBar()
  ],
}