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
  // probe ships with the bot: the image carries no node_modules, so checking a
  // live source on the server is only possible if it is bundled too
  entry: { main: "./src/main.ts", probe: "./scripts/probe.ts" },
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
    // puppeteer's optional accelerators and proxy support: each is required
    // inside a try/catch, so a require that throws is what they already expect
    bufferutil: "commonjs bufferutil",
    "utf-8-validate": "commonjs utf-8-validate",
    "proxy-agent": "commonjs proxy-agent",
  },
  // yargs assembles a require path at runtime for the @puppeteer/browsers cli,
  // which nothing here calls; webpack cannot see that and warns regardless
  ignoreWarnings: [{ module: /node_modules\/yargs/ }],
  module: {
    rules: [
      {
        test: /\.ts$/,
        use: ["ts-loader"],
      },
    ],
  },
  // two entries, but only one of them is the bot nodemon should restart
  plugins: [new NodemonPlugin({ script: "./dist/main.cjs" })],
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
