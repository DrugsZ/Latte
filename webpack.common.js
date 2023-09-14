const path = require('path');
const WebpackBar = require('webpackbar');
const HtmlWebpackPlugin = require('html-webpack-plugin');


module.exports = {
  entry: './src/main.ts',
  infrastructureLogging: {
    level: 'error',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'cditor.bundle.js',
    clean: true,
    publicPath: './',
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js"],
    extensionAlias: {
      ".js": [".js", ".ts"],
      ".cjs": [".cjs", ".cts"],
      ".mjs": [".mjs", ".mts"]
    },
    alias: {
      'Latte': path.resolve(__dirname, "src")
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
      },
      {
        test: /\.css$/i,
        use: ["style-loader", "css-loader"],
      },
    ]
  },
  stats: 'errors-only',
  plugins: [
    new HtmlWebpackPlugin(),
    new WebpackBar()
  ],
}
