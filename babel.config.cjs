const ignore = process.env.IGNORE_FILES ? ['**/*.test.ts', '**/*.d.ts'] : [];

module.exports = {
  presets: [['@babel/preset-env', { targets: { node: 'current' } }], '@babel/preset-typescript'],
  env: {
    dist: {
      presets: [
        [
          '@babel/preset-env',
          {
            modules: false,
            targets: { node: 'current' },
          },
        ],
      ],
      plugins: ['babel-plugin-add-import-extension'],
    },
  },
  ignore,
};
