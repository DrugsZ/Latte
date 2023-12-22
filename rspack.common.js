const path = require('path');
const WebpackBar = require('webpackbar');
const rspack = require("@rspack/core");


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
    },
    tsConfigPath: path.resolve(__dirname, "tsconfig.json")
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: {
          loader: "builtin:swc-loader",
          options: {
            sourceMap: true,
            jsc: {
              parser: {
                syntax: "typescript"
              },
              externalHelpers: true,
              preserveAllComments: false
            }
          }
        },
        type: 'javascript/auto',
      },
      {
        test: /\.css$/i,
        type: "css",
      },
    ]
  },
  stats: 'errors-only',
  plugins: [
    new rspack.HtmlRspackPlugin({
      template: "./index.html"
    }),
    new WebpackBar()
  ],
}
