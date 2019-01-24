const path = require('path');

module.exports = {
  entry: "./static/rustw.ts",
  output: {
    filename: "./static/rustw.out.js",
    path: path.resolve(__dirname),
    libraryTarget: 'var',
    library: 'Rustw'
  },
  resolve: {
    extensions: [".js", ".ts", ".tsx"]
  },
  module: {
    rules: [
    {
      test: /\.js$/,
      exclude: /node_modules/,
      loader: 'babel-loader'
    },
    {
      test: /\.tsx?$/,
      exclude: /node_modules/,
      loader: 'ts-loader'
    }]
  },
  devtool: 'source-map'
}
