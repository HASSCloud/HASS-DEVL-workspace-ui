const path = require('path');
const webpack = require('webpack');
const MiniCssExtractPlugin = require('mini-css-extract-plugin');
const CleanWebpackPlugin = require('clean-webpack-plugin');
const HtmlWebPackPlugin = require('html-webpack-plugin');
const GenerateJsonPlugin = require('generate-json-webpack-plugin');

const pkgConfig = require('../package.json');
const appConfig = require('./config.json');


function resolve(dest) {
  return path.resolve(path.basename(__dirname), '..', dest);
}


const paths = {
  root: resolve(''),
  src: resolve('src'),
  dist: resolve('dist'),
  assets: resolve('src/assets'),
  nodeModules: resolve('node_modules'),
};


module.exports = (env, options) => {
  // set NODE_ENV based on webpack mode option
  process.env.NODE_ENV = (options && options.mode) || 'production';
  // some variables to dhelp with conditional build options
  const debug = process.env.NODE_ENV === 'development';

  return {

    // input modules
    entry: [
      resolve('src/main.jsx'),
    ],
    // output bundles
    output: {
      filename: 'main.js',
      path: paths.dist,
      publicPath: '/',
    },

    resolve: {
      // This allows you to set a fallback for where Webpack should look for modules.
      // We read `NODE_PATH` environment variable in `paths.js` and pass paths here.
      // We use `fallback` instead of `root` because we want `node_modules` to "win"
      // if there any conflicts. This matches Node resolution mechanism.
      modules: [paths.nodeModules, paths.src],
      // treat .js, .json, .jsx, .. as potenital js modules
      extensions: ['.js', '.json', '.jsx'],
      alias: {
        assets: paths.assets,
      },
    },

    // build plugins
    module: {
      rules: [
        // First, run the linter.
        // It's important to do this before Babel processes the JS.
        {
          enforce: 'pre',
          test: /\.(js|jsx)$/,
          include: paths.src,
          use: [
            'eslint-loader',
          ],
        },
        // Process JS with Babel.
        {
          test: /\.(js|jsx)$/,
          include: paths.src,
          exclude: /(node_modules|bower_components)/,
          use: {
            loader: 'babel-loader',
            options: {
              // This is a feature of `babel-loader` for webpack (not Babel itself).
              // It enables caching results in ./node_modules/.cache/babel-loader/
              // directory for faster rebuilds.
              cacheDirectory: true,
              // reduce babel loader bloat
              plugins: [
                '@babel/plugin-transform-runtime',
              ],
              // babel presets to enable
              presets: [
                [
                  '@babel/preset-env',
                  {
                    env: {
                      targets: {
                        browsers: [
                          'last 2 versions',
                        ],
                      },
                    },
                    modules: false,
                  },
                ],
                '@babel/preset-react',
                [
                  '@babel/preset-stage-2',
                  {
                    decoratorsLegacy: true,
                  },
                ],
              ],
            },
          },
        },
        {
          test: /\.(scss|css)$/,
          use: [
            //  use style-loader for dev, and extract css for build
            debug ?
              { loader: 'style-loader', options: { sourceMap: true } } :
              { loader: MiniCssExtractPlugin.loader },
            {
              loader: 'css-loader',
              options: {
                sourceMap: true,
                //   CSS-modules
                // modules: true,
                importLoaders: 1,
                // localIdentName: debug ? '[name]_[local]_[hash:base64:3]' : '[hash:base64:4]',
                //   CSS Nano
                minimize: !debug,
              },
            },
            {
              loader: 'sass-loader',
              options: {
                sourceMap: true,
              },
            },
          ],
        },
        {
          test: /\.(jpg|jpeg|png|ico|svg)(\?.*)?$/,
          use: [
            {
              loader: 'file-loader',
              options: {
                name: '[name].[ext]',
                outputPath: 'images/',
                publicPath: '/images/',
              },
            },
          ],
        },
        {
          test: /\.(html)$/,
          use: {
            loader: 'html-loader',
            options: {
              minimize: debug,
            },
          },
        },
      ],
    },

    // webpack plugins
    plugins: [
      new webpack.DefinePlugin({
        'process.env': {
          NODE_ENV: JSON.stringify(process.env.NODE_ENV),
        },
      }),
      new CleanWebpackPlugin(
        [paths.dist],
        {
          root: paths.root,
        },
      ),
      new MiniCssExtractPlugin({
        // Options similar to the same options in webpackOptions.output
        // both options are optional
        filename: '[name].css',
        chunkFilename: '[id].css',
      }),
      new HtmlWebPackPlugin({
        template: resolve('src/index.html'),
        filename: 'index.html',
      }),
      new GenerateJsonPlugin('config.json', {
        version: pkgConfig.version,
        ...appConfig,
      }),
    ],

    externals: {
      'react/addons': true,
      'react/lib/ExecutionEnvironment': true,
      'react/lib/ReactContext': true,
    },

    // see https://webpack.js.org/configuration/devtool/
    // eval-source-map may be better for development, but is slower
    devtool: debug ? 'cheap-module-eval-source-map' : 'source-map',
    // configure dev server
    devServer: {
      contentBase: paths.dist,
      historyApiFallback: true, // serve index.html from any sub url
      inline: true,
      port: 5000,
      host: 'localhost', // Change to '0.0.0.0' for external facing server
      // watchContentBase: true,
      public: 'localhost:5000',
      publicPath: '/',
      proxy: [
        {
          context: ['/api', '/oidc'],
          changeOrigin: true,
          headers: {
            'X-Dev-Server-Proxy': 'http://localhost:6543',
          },
          target: 'http://localhost:6543',
        },
      ],
    },
  };
};
