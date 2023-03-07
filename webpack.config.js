const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const WebpackBar = require('webpackbar');
const FriendlyErrorsWebpackPlugin = require('@soda/friendly-errors-webpack-plugin');


module.exports = {
  entry: './src/main.ts',
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    static: './dist',
    hot: true
  },
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
      { test: /\.([cm]?ts|tsx)$/, use: [
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
    new WebpackBar(),
    new FriendlyErrorsWebpackPlugin({
      compilationSuccessInfo: {
        messages: ['You application is running here http://localhost:8080'],
        notes: ['Some additional notes to be displayed upon successful compilation']
      },
    })
  ],
}