import * as path from "path";
import * as webpack from "webpack";
import NodemonPlugin from "nodemon-webpack-plugin";
import TerserPlugin from "terser-webpack-plugin";

const { NODE_ENV = "production" } = process.env;

const isDev = NODE_ENV === "development";

const config: webpack.Configuration = {
  mode: isDev ? "development" : "production",
  target: "node",
  entry: { main: "./src/main.ts" },
  output: {
    filename: "[name].js",
    path: path.resolve(__dirname, "dist"),
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: ["ts-loader"],
      },
    ],
  },
  plugins: [new NodemonPlugin()],
  optimization: {
    minimizer: [
      new TerserPlugin({
        terserOptions: {
          keep_classnames: /AbortSignal/,
          keep_fnames: /AbortSignal/,
          ecma: 2020,
          module: true,
          toplevel: true,
        },
      }),
    ],
  },
};

export default config;
