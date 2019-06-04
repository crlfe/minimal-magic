module.exports = {
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module"
  },
  env: {
    browser: true,
    es6: true
  },
  extends: ["plugin:compat/recommended", "plugin:prettier/recommended"],
  settings: {
    browsers: [
      // Browsers that support <script type="module"> (from caniuse.com).
      // Others may eventually be supported via an ES5 bundle and nomodule.
      "and_chr >= 71",
      "and_ff >= 64",
      "android >= 67",
      "edge >= 16",
      "chrome >= 61",
      "firefox >= 60",
      "ios_saf >= 11",
      "opera >= 48",
      "safari >= 11",
      "samsung >= 8.2"
    ]
  }
};