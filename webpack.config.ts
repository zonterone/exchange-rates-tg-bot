import * as path from "path";
import * as webpack from "webpack";
import NodemonPlugin from "nodemon-webpack-plugin";
import TerserPlugin from "terser-webpack-plugin";
import { fileURLToPath } from "url";

const { NODE_ENV = "production" } = process.env;

const isDev = NODE_ENV === "development";
const dir = path.dirname(fileURLToPath(import.meta.url));

const config: webpack.Configuration = {
  mode: isDev ? "development" : "production",
  target: "node",
  entry: { main: "./src/main.ts" },
  output: {
    filename: "[name].cjs",
    path: path.resolve(dir, "dist"),
  },
  resolve: {
    extensions: [".ts", ".js"],
  },
  // a native addon cannot be bundled, it is copied into the image instead
  externals: {
    "@resvg/resvg-js": "commonjs @resvg/resvg-js",
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
