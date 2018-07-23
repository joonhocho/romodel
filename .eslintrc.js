module.exports = {
  extends: ["airbnb", "prettier", "prettier/standard"],
  plugins: [
    "prefer-object-spread",
    "prettier"
  ],
  parser: "babel-eslint",
  parserOptions: {
    ecmaVersion: 2018,
    sourceType: "module",
    ecmaFeatures: {
      impliedStrict: true,
    }
  },
  env: {
    node: true,
  },
  rules: {
    "arrow-parens": ["error", "always"],
    "no-cond-assign": ["error", "except-parens"],
    "no-multi-assign": 0,
    "no-plusplus": ["error", { allowForLoopAfterthoughts: true }],
    "no-underscore-dangle": 0,
    "prettier/prettier": ["error", "fb"],
    curly: ["error", "multi-line"]
  }
};
