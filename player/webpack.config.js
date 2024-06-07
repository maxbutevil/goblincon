
const path = require("path");

//const CopyPlugin = require("copy-webpack-plugin");


const extensions = ['.tsx', '.ts', '.js'];
const rules = [
  {
    test: /\.tsx?$/,
    use: 'ts-loader',
    exclude: /node_modules/,
  }
];

module.exports = [
  /*{
    target: 'node',
    entry: './src/server',
    resolve: { extensions },
    module: { rules },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'server.js'
    }
  },*/
  {
    entry: './src/index',
    resolve: { extensions },
    module: { rules },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'index.js'
    },
  }
];


/*
module.exports = [
  {
    // Public
    mode: "development",

    entry: "./src/app.tsx",
    output: {
      filename: "index.js",
      path: path.resolve(__dirname, "dist/src/"),
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: "ts-loader",
          exclude: /node_modules/,
        },
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
          },
        },
      ],
    },
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
    },

    plugins: [
      
      new CopyPlugin({
        patterns: [
          {
            from: "./src",
            globOptions: {
              ignore: ["**.ts", "**.tsx"],
            },
          },
        ],
      }),
      
    ],
  },
  {
    // Public
    mode: "development",
    target: "node",
    entry: "./src/app.tsx",
    output: {
      filename: "index.js",
      path: path.resolve(__dirname, "dist/"),
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: "ts-loader",
          exclude: /node_modules/,
        },
        {
          test: /\.(js|jsx)$/,
          exclude: /node_modules/,
          use: {
            loader: "babel-loader",
          },
        },
      ],
    },
    resolve: {
      extensions: [".tsx", ".ts", ".js"],
    },
    externals: ["bufferutil", "utf-8-validate"],
  },
];
*/
