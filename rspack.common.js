const path = require('path');
const WebpackBar = require('webpackbar');
const rspack = require("@rspack/core");


module.exports = {
  entry: './src/main.tsx',
  infrastructureLogging: {
    level: 'error',
  },
  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'cditor.bundle.js',
    clean: true
  },
  resolve: {
    extensions: [".ts", ".tsx", ".js", "css"],
    extensionAlias: {
      ".js": [".js", ".ts"],
      ".cjs": [".cjs", ".cts"],
      ".mjs": [".mjs", ".mts"],
      ".css": [".css"],
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
      {
        test: /\.svg$/i,
        issuer: /\.[jt]sx?$/,
        use: ['@svgr/webpack'],
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
