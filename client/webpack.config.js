
const path = require("path");
const HtmlWebpackPlugin = require("html-webpack-plugin");

//const CopyPlugin = require("copy-webpack-plugin");


const extensions = ['.tsx', '.ts', '.js'];
const rules = [
  {
    test: /\.tsx?$/,
    use: 'ts-loader',
    exclude: /node_modules/,
  }
];

function page(pageName, title) {
  return {
    entry: `./src/${pageName}`,
    resolve: { extensions },
    module: { rules },
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: `${pageName}.js`
    },
    plugins: [
      new HtmlWebpackPlugin({
        template: './src/template.html',
        filename: `${pageName}.html`,
        title,
      })
    ]
  };
}

module.exports = [
  //page('index', 'GoblinCon'),
  page('host', 'GoblinCon | Host'),
  page('play', 'GoblinCon | Play')
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
