module.exports = {
  entry: "./static/rustw.js",
  output: {
    filename: "./static/rustw.out.js",
    libraryTarget: 'var',
    library: 'Rustw'
  },
  module: {
    loaders: [
    {
      test: /\.js$/,
      exclude: /node_modules/,
      loader: 'babel-loader'
    }]
  },
  resolve: {
    extensions: ['', '.js']
  },
  devtool: 'source-map'
}
