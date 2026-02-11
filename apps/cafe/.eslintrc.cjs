module.exports = {
  // ... 其他配置
  settings: {
    'import/resolver': {
      typescript: {
        project: ['./tsconfig.json', './apps/*/tsconfig.json', './packages/*/tsconfig.json'],
      },
      node: true,
    },
  },
};