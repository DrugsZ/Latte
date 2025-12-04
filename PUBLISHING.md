# 发布指南

## 发布前检查

在发布之前，请确保：

1. ✅ 所有测试通过
2. ✅ 代码已经过 lint 检查
3. ✅ 所有包已构建
4. ✅ 版本号已更新
5. ✅ CHANGELOG 已更新

## 发布步骤

### 1. 更新版本号

根据语义化版本规范更新版本号：

```bash
# 更新所有包的版本号到 patch 版本（例如 0.1.0 -> 0.1.1）
pnpm --filter "./packages/**" version patch

# 或者 minor 版本（例如 0.1.0 -> 0.2.0）
pnpm --filter "./packages/**" version minor

# 或者 major 版本（例如 0.1.0 -> 1.0.0）
pnpm --filter "./packages/**" version major
```

### 2. 构建所有包

```bash
pnpm run build
```

### 3. 运行测试和检查

```bash
pnpm run test
pnpm run lint
```

### 4. 发布到 npm

```bash
# 发布所有包
pnpm run publish:packages

# 或者单独发布某个包
cd packages/bean
pnpm publish --access public
```

### 5. 创建 Git 标签

```bash
git tag v0.1.0
git push origin v0.1.0
```

## 发布配置说明

### workspace 依赖处理

pnpm 会自动将 `workspace:*` 转换为实际的版本号，例如：
- `"@latte-js/bean": "workspace:*"` -> `"@latte-js/bean": "^0.1.0"`

### publishConfig

所有包都配置了 `publishConfig.access: "public"`，因为 `@latte-js` 作用域包默认是私有的。

### files 字段

每个包的 `files` 字段指定了发布时包含的文件：
- `dist/` - 构建产物
- `README.md` - 包说明文档

### exports 字段

使用现代化的 `exports` 字段支持：
- CommonJS: `require()`
- ES Modules: `import`
- TypeScript: 类型定义

## 注意事项

1. **首次发布**：确保你有 npm 账号并已登录
   ```bash
   npm login
   ```

2. **版本同步**：建议保持所有包的版本号同步

3. **依赖顺序**：发布时需要按照依赖顺序发布（pnpm 会自动处理）

4. **回滚**：如果需要撤销发布
   ```bash
   npm unpublish @latte/package-name@version
   ```

## 包依赖关系

```
@latte-js/bean (基础类型定义)
├── @latte-js/espresso (数据内核)
│   ├── @latte-js/art (渲染引擎)
│   ├── @latte-js/barista (调度引擎)
│   └── @latte-js/milk (UI 组件)
└── @latte-js/syrup (DI 系统)
    ├── @latte-js/counter (业务逻辑)
    └── @latte-js/milk (UI 组件)
```

建议发布顺序：
1. bean
2. espresso, syrup
3. art, barista
4. counter, milk
