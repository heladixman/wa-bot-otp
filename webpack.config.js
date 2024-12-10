const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");
const webpackNodeExternals = require('webpack-node-externals');
const Dotenv = require('dotenv-webpack')

module.exports = {
  // Entry point dari aplikasi
  entry: './server.js',

  // Output build
  output: {
    filename: "bundle.js",
    path: path.resolve(__dirname, "dist"),
  },

  // Mode pengembangan atau produksi
  mode: "production", // Ganti ke 'production' untuk build produksi

  target: 'node',
  externals: [webpackNodeExternals()],

  // Menggunakan dev server untuk pengembangan
  devServer: {
    contentBase: path.join(__dirname, "dist"),
    compress: true,
    port: 9000,
    hot: true, // Enable hot reloading
  },

  // Mengatur module rules untuk mengonversi file
  module: {
    rules: [
      {
        test: /\.css$/,  // Apply to .css files
        use: ['style-loader', 'css-loader'],  // Load CSS into JS
      },
      {
        test: /\.(jpg|jpeg|png|gif|svg)$/,  // Apply to image files
        use: ['file-loader'],  // Handle image files
      },
    ],
  },

  // Plugins untuk optimasi dan menambahkan HTML ke bundel
  plugins: [
    new Dotenv(),
    new CopyPlugin({
      patterns: [
        { from: "src/public", to: "public" }, // Copy CSS to dist/public
        { from: "src/views", to: "views" }, // Copy all EJS files
      ],
    }),
  ],
};
