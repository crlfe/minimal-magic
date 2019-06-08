module.exports = {
  extends: ["eslint:recommended", "plugin:prettier/recommended"],
  env: {
    es6: true
  },
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module"
  },
  rules: {
    eqeqeq: "error",
    "no-floating-decimal": "error",
    "no-throw-literal": "error"
  }
};
