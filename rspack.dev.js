const { merge } = require('webpack-merge');
const common = require('./rspack.common.js');
const FriendlyErrorsWebpackPlugin = require('@soda/friendly-errors-webpack-plugin');


module.exports = merge(common, {
  mode: 'development',
  devtool: 'inline-source-map',
  devServer: {
    hot: true
  },
  plugins: [
    new FriendlyErrorsWebpackPlugin({
      compilationSuccessInfo: {
        messages: ['You application is running here http://localhost:8080'],
        notes: ['Some additional notes to be displayed upon successful compilation']
      },
    })
  ]
});