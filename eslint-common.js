module.exports = {
  extends: [
    "eslint:recommended",
    "plugin:jsdoc/recommended",
    "plugin:prettier/recommended"
  ],
  env: {
    es6: true
  },
  parser: "babel-eslint",
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module"
  },
  plugins: ["jsdoc", "prettier"],
  rules: {
    eqeqeq: "error",
    "no-floating-decimal": "error",
    "no-throw-literal": "error",
    "jsdoc/no-undefined-types": [
      "error",
      {
        definedTypes: ["ParentNode", "void"]
      }
    ],
    "jsdoc/require-description": [
      "error",
      {
        contexts: [
          /* exclude "ArrowFunctionExpression", */
          "ClassDeclaration",
          "FunctionDeclaration",
          "FunctionExpression"
        ]
      }
    ],
    "jsdoc/require-description-complete-sentence": "error",
    "jsdoc/require-param-description": "off",
    "jsdoc/require-returns": "error",
    "jsdoc/require-returns-description": "off"
  }
};
