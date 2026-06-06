# Latte 工程治理与许可证策略

本文记录当前架构演进中需要继续推进的治理事项，以及面向未来商业化的包级开源协议建议。

说明：本文不是法律意见。许可证、商业授权、贡献者协议和企业客户条款在正式发布前应由专业律师确认。

## 工程治理待办

### P0：先把边界锁住

1. Mutation policy 覆盖审计

   扫描所有已注册 service/system 的公开方法。除明确 allowlist 外，要求每个会写数据的方法声明 mutation policy，避免新增 API 默默绕过 worker 自动事务。

2. NodeCursor 写入卡口

   用户编辑写入必须发生在 active transaction、`writeNoHistory` 或 `manual` scope 内。派生流水线写入单独归类，避免矩阵、AABB 等计算结果污染历史。

3. RPC 协议治理

   增加 protocol version、capabilities、标准 JSON-RPC error code/data，并统一 notification 错误观测方式。这样主线程、插件和 worker 升级时不会靠隐式约定。

4. 许可证元数据一致性

   当前仓库存在 `package.json` license、包内 `LICENSE`、根 `LICENSE`、README 描述不一致的问题。正式发布 npm 包前必须收口，否则商业用户和贡献者都会无法判断真实授权边界。

### P1：把能力补完整

1. create/delete/reparent history

   为节点结构变更增加序列化快照与精确 sibling order 回放，然后把 `NodeService` 的结构性写入从 `writeNoHistory` 迁移到可撤销历史。

2. 更强 e2e smoke

   覆盖 transform 后 undo/redo、多文档 session 切换、active interaction 冲突拒绝、严格 pageerror/console 检查。

3. CI/Turbo 治理

   固化 type-check/test/build/e2e/diff-check 流水线，处理 test outputs、coverage、playwright-report 等 Turbo 输出警告。

4. 包边界文档

   为 `bean`、`espresso`、`barista`、`art`、`syrup`、`crema` 写清楚 public API、internal API 和跨线程协议责任。

### P2：规模化与合规

1. 并发模型升级

   当前全局顺序队列安全但保守。后续可演进为 per-document queue，并允许 readonly RPC 并发。

2. 生产 SAB 头治理

   为部署模板和健康检查补齐 COOP/COEP 配置，确保 `SharedArrayBuffer` 在 preview、self-host、SaaS 环境都可用。

3. 性能基线

   建立大文档加载、Matrix/AABB tick、拖拽通知频率、undo/redo replay 的可重复性能基线。

4. License compliance 自动化

   增加包级 license 检查、第三方依赖 license 审计、NOTICE 生成和发布前校验。

## 许可证设计原则

Latte 的目标是“Figma 的图形能力 + VSCode 的扩展模型”。这意味着协议策略不宜简单地把所有包都设成 GPL。

推荐方向是开放生态、保护核心、保留商业授权：

- 协议、类型、SDK、工具包使用宽松协议，降低插件作者和第三方应用接入门槛。
- 核心引擎、worker 计算、运行时编排、内置业务逻辑使用 AGPL 开源版 + 商业授权。
- 商业客户如果不想承担 AGPL 义务，可以购买商业授权。
- 对外贡献需要配套 CLA 或等效贡献者授权，否则未来双授权会受贡献者版权限制。

为什么不是全 GPL：

- GPL 对“分发”场景更敏感；AGPL 额外覆盖网络交互，更贴近 SaaS/在线编辑器场景。
- GPL/AGPL 放在基础类型包或插件 SDK 上，会让第三方插件、闭源扩展、企业集成方产生链接和派生作品风险，从而阻碍生态。
- 宽松协议放在协议层不会削弱核心商业化，反而会扩大 API 标准和插件生态。

## 推荐包级矩阵

| 包 | 角色 | 建议开源协议 | 商业策略 | 原因 |
| --- | --- | --- | --- | --- |
| root monorepo | 仓库入口 | 许可证总览，不作为唯一授权边界 | 指向各包 LICENSE | monorepo 多协议时，根 LICENSE 容易误导，应明确“以包为准”。 |
| `@latte-js/bean` | 类型、schema、RPC 协议 | `Apache-2.0`，或保持 `MIT` | 免费开放 | 协议层越开放越容易成为生态标准；Apache-2.0 额外提供专利授权条款。 |
| `@latte-js/kit` | 通用工具 | `Apache-2.0`，或 `MIT` | 免费开放 | 工具包不应把强 copyleft 传播给所有上层包。 |
| `@latte-js/syrup` | 命令、键绑定、菜单、扩展基础设施 | `Apache-2.0`，或 `MIT` | 免费开放 | 这是 VSCode 风格扩展生态的入口，插件作者需要低风险依赖。 |
| `@latte-js/milk` | React/UI 绑定 | `Apache-2.0` 或 `MPL-2.0` | 可按组件商业化拆分 | 如果希望第三方应用接入，避免 GPL；如果想保护组件修改，可选文件级 copyleft 的 MPL-2.0。 |
| `@latte-js/espresso` | SAB/SoA 数据内核 | `AGPL-3.0-or-later` | 商业双授权 | 这是性能和数据模型核心，适合用 AGPL 防止闭源 SaaS 直接改造后托管竞争。 |
| `@latte-js/barista` | Worker 计算、service/system、历史 | `AGPL-3.0-or-later` | 商业双授权 | 这是服务语义、事务、计算调度核心，是商业护城河。 |
| `@latte-js/art` | 渲染器 | `AGPL-3.0-or-later`，可备选 `MPL-2.0` | 商业双授权 | 如果渲染器是核心能力，随核心双授权；如果希望它成为通用嵌入式 renderer，可降到 MPL/Apache。 |
| `@latte-js/crema` | Editor runtime 编排 | `AGPL-3.0-or-later` | 商业双授权 | 它连接主线程、worker、renderer，是完整编辑器产品边界的一部分。若未来只提供很薄的 client SDK，可拆出宽松包。 |
| `@latte-js/counter` | 内置工具和业务逻辑 | `AGPL-3.0-or-later` | 商业双授权或私有 | 内置能力属于产品功能，不建议作为基础生态协议层。 |
| `apps/cafe` | 示例/演示应用 | 不发布 npm；可 `UNLICENSED` 或随 AGPL 示例 | SaaS/演示另行授权 | app 是产品集成，不应被下游当作库依赖。 |

## 当前仓库已执行的收口

已按“少惊动、先一致”的策略落地：

- `packages/art`、`packages/barista`、`packages/counter`、`packages/crema`、`packages/espresso` 的 `package.json` 统一为 `AGPL-3.0-or-later`。
- `packages/bean`、`packages/kit`、`packages/milk`、`packages/syrup` 的 `package.json` 统一为 `MIT`。
- `packages/crema` 补齐包内 `LICENSE`。
- `apps/cafe` 标记为私有 app 与 `UNLICENSED`。
- 根 README 与 `apps/README*` 已改成包级许可证说明。
- 新增 `pnpm licenses:check`，检查 `package.json` 与包内 `LICENSE` 文本大类是否匹配，并接入 CI quality gate 与 `prepublishOnly`。

剩余注意点：

- `@latte-js/syrup` 当前仍直接依赖 `@latte-js/barista`。因此虽然 `syrup` 自身是 MIT，实际安装/组合使用时仍会引入 AGPL 核心依赖。若未来希望提供真正低风险的插件 SDK，应拆出不依赖核心引擎的 SDK 包，或把 `syrup` 中启动 worker/editor 的部分迁移到 AGPL runtime 包。
- 若决定把生态包从 MIT 升级为 Apache-2.0，需要统一替换包内 LICENSE 文本和检查脚本策略。

## 双授权注意事项

如果采用 `AGPL-3.0-or-later + Commercial License`：

- 公共 npm 包可以先标记为 `AGPL-3.0-or-later`，商业授权通过单独合同提供。
- README、包文档和官网需要清楚说明商业授权入口。
- 所有外部贡献必须有 CLA 或等效版权/再授权许可，否则项目方未必有权把外部贡献纳入商业授权版本。
- 需要保留第三方依赖 NOTICE 和 license 审计记录，避免商业发行时引入不兼容依赖。

## 参考资料

- GNU AGPLv3：<https://www.gnu.org/licenses/agpl.html>
- GNU GPL FAQ：<https://www.gnu.org/licenses/gpl-faq.en.html>
- Apache License 2.0：<https://www.apache.org/licenses/LICENSE-2.0.html>
- Mozilla MPL 2.0 FAQ：<https://www.mozilla.org/en-US/MPL/2.0/FAQ/>
