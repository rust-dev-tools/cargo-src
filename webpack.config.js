module.exports = {
  entry: "./static/rustw.ts",
  output: {
    filename: "./static/rustw.out.js",
    libraryTarget: 'var',
    library: 'Rustw'
  },
  resolve: {
    extensions: [".js", ".ts", ".tsx"]
  },
  module: {
    loaders: [
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
