# IRenderBackend 接口设计分析

## 📊 与 Canvas2D API 的对比

### 现有差距与改进

#### 1. **混合模式 (Blend Modes)** ✅ 已补充

- **Canvas2D**: `globalCompositeOperation` 支持 28 种混合模式
- **WebGL/WebGPU**: 通过 `blendFunc` 和 `blendEquation` 实现
- **改进**: 新增 `BlendMode` 枚举和 `setBlendMode()` 方法

#### 2. **线条样式 (Line Styles)** ✅ 已补充

- **Canvas2D**: `lineCap`, `lineJoin`, `miterLimit`, `setLineDash()`
- **WebGL/WebGPU**: 需要在几何生成阶段处理（更复杂）
- **改进**:
  - 新增 `LineCap` 和 `LineJoin` 枚举
  - 新增 `setLineStyle()` 和 `setLineDash()` 方法

#### 3. **阴影效果 (Shadows)** ✅ 已补充

- **Canvas2D**: `shadowOffsetX/Y`, `shadowBlur`, `shadowColor`
- **WebGL/WebGPU**: 需要额外的渲染 Pass（性能开销大）
- **改进**: 新增 `setShadow()` 和 `clearShadow()` 方法，返回 boolean 表示支持度

#### 4. **渐变填充 (Gradients)** ✅ 已补充

- **Canvas2D**: `createLinearGradient()`, `createRadialGradient()`, `createConicGradient()`
- **WebGL/WebGPU**: 可通过 Shader 或纹理实现
- **改进**:
  - 新增 `Gradient` 和 `GradientStop` 类型定义
  - 新增 `createGradient()` 和 `deleteGradient()` 方法
  - 绘制方法支持 `number | Gradient` 类型

#### 5. **图案填充 (Patterns)** ✅ 已补充

- **Canvas2D**: `createPattern()`
- **WebGL/WebGPU**: 通过纹理平铺实现
- **改进**: 新增 `drawPattern()` 方法

#### 6. **文本测量 (Text Metrics)** ✅ 已补充

- **Canvas2D**: `measureText()` 返回详细的文本度量信息
- **WebGL/WebGPU**: 需要预计算或查表
- **改进**: 新增 `measureText()` 方法返回 `[width, height]`

#### 7. **离屏渲染 (Offscreen Rendering)** ✅ 已补充

- **Canvas2D**: `OffscreenCanvas`
- **WebGL/WebGPU**: `FrameBuffer Object (FBO)`
- **改进**:
  - 新增 `createRenderTarget()`, `deleteRenderTarget()`
  - 新增 `setRenderTarget()`, `blitRenderTarget()`

#### 8. **精灵图/图片裁剪 (Sprite Sheets)** ✅ 已优化

- **Canvas2D**: `drawImage()` 支持 9 参数模式
- **改进**: `drawImage()` 方法支持可选的源矩形参数 (sx, sy, sw, sh)

#### 9. **性能监控 (Performance Monitoring)** ✅ 已补充

- **WebGL/WebGPU**: 需要追踪 draw calls, 顶点数等
- **改进**:
  - 新增 `getStats()` 方法返回渲染统计
  - 新增 `resetStats()` 方法

#### 10. **后端识别 (Backend Detection)** ✅ 已补充

- **改进**: 新增 `getBackendType()` 方法，便于上层做差异化处理

---

## 🎯 设计原则总结

### 1. **API 抹平原则**

```typescript
// ✅ 好的设计：使用枚举抹平差异
setBlendMode(BlendMode.MULTIPLY)

// ❌ 避免：直接暴露平台特定 API
ctx.globalCompositeOperation = 'multiply'
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA)
```

### 2. **类型化数据传输**

```typescript
// ✅ 使用类型化数组，便于 SharedArrayBuffer 共享
pushTransform(matrix: Float32Array)
drawPath(commands: Uint8Array, data: Float32Array)

// ❌ 避免：对象传递（序列化开销）
pushTransform({a, b, c, d, tx, ty})
```

### 3. **可选特性标识**

```typescript
// ✅ 返回 boolean 表示是否支持
setShadow(...): boolean

// 上层可以根据返回值做降级处理
if (!backend.setShadow(2, 2, 4, 0x80000000)) {
  console.warn('当前后端不支持阴影')
}
```

### 4. **资源生命周期管理**

```typescript
// ✅ 明确的创建/删除接口
const gradientId = createGradient(...)
deleteGradient(gradientId)

const targetId = createRenderTarget(800, 600)
deleteRenderTarget(targetId)
```

---

## 🔄 Canvas2D vs WebGL/WebGPU 实现差异

| 特性         | Canvas2D                   | WebGL/WebGPU              | IRenderBackend 抹平方式               |
| ------------ | -------------------------- | ------------------------- | ------------------------------------- |
| **变换矩阵** | `transform()` 立即生效     | CPU 维护栈，Shader 中应用 | `pushTransform/popTransform` 栈式管理 |
| **裁剪**     | `clip()` 原生支持          | 使用 Stencil Buffer       | `pushClip/popClip` 统一接口           |
| **圆角矩形** | `arcTo()` 逐段绘制         | Shader 中 SDF 计算        | `drawRect(cornerRadius)`              |
| **路径绘制** | `moveTo/lineTo` 即时绘制   | Earcut 三角剖分后批量提交 | `drawPath(commands, data)` 统一格式   |
| **文本**     | `fillText()` 原生渲染      | Glyph Atlas + SDF         | `drawText()` 统一接口，后端自行实现   |
| **渐变**     | `createLinearGradient()`   | Shader 计算或纹理采样     | `createGradient()` 返回 ID            |
| **阴影**     | `shadowBlur` 原生支持      | 需要额外 Pass（昂贵）     | `setShadow()` 返回是否支持            |
| **混合模式** | `globalCompositeOperation` | `blendFunc/blendEquation` | `setBlendMode(enum)`                  |
| **离屏渲染** | `OffscreenCanvas`          | `FrameBuffer Object`      | `createRenderTarget()`                |

---

## 🚀 实现建议

### Canvas2D Backend

```typescript
// 直接映射，性能最优
setBlendMode(mode: BlendMode) {
  this.ctx.globalCompositeOperation = BlendModeMap[mode]
}
```

### WebGL Backend

```typescript
// 需要批处理优化
drawRect(...) {
  // 1. 生成顶点数据
  const vertices = generateRoundedRectVertices(...)

  // 2. 加入 Batch
  this.batcher.addQuad(vertices, color)

  // 3. 达到阈值时 Flush
  if (this.batcher.isFull()) {
    this.batcher.flush()
  }
}
```

### WebGPU Backend

```typescript
// Command Buffer 模式
beginFrame() {
  this.commandEncoder = this.device.createCommandEncoder()
  this.renderPass = this.commandEncoder.beginRenderPass(...)
}

endFrame() {
  this.renderPass.end()
  this.device.queue.submit([this.commandEncoder.finish()])
}
```

---

## ⚠️ 注意事项

### 1. **性能陷阱**

- Canvas2D 的 `save/restore` 开销较大，避免过度嵌套
- WebGL 的状态切换（纹理绑定、Shader 切换）成本高，需要 Batch
- WebGPU 的 Command Buffer 录制需要在 CPU 侧完成

### 2. **功能降级**

```typescript
// 阴影在 WebGL 中实现成本高，可以选择不支持
setShadow(...): boolean {
  if (this.isWebGL) {
    console.warn('WebGL 后端不支持阴影')
    return false
  }
  // Canvas2D 实现
  return true
}
```

### 3. **文本渲染复杂度**

- Canvas2D: 直接使用系统字体渲染
- WebGL: 需要 Glyph Atlas（复杂度高，需要字体解析、光栅化、纹理打包）
- 建议：初期版本 WebGL 可以使用 Canvas2D 离屏渲染文本，再作为纹理上传

### 4. **颜色格式统一**

```typescript
// 统一使用 0xAARRGGBB (32位整数)
const color = 0xFF0000FF // 不透明红色

// Canvas2D 转换
colorToStyle(color: number): string {
  const a = ((color >> 24) & 0xff) / 255
  const r = (color >> 16) & 0xff
  const g = (color >> 8) & 0xff
  const b = color & 0xff
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

// WebGL 转换
colorToVec4(color: number): Float32Array {
  return new Float32Array([
    ((color >> 16) & 0xff) / 255,
    ((color >> 8) & 0xff) / 255,
    (color & 0xff) / 255,
    ((color >> 24) & 0xff) / 255
  ])
}
```

---

## 📈 后续优化方向

1. **指令录制模式**
   - 不直接绘制，而是录制绘制指令到 Command Buffer
   - 支持多线程并行录制（Web Worker）

2. **Dirty Rectangle 优化**
   - 只重绘变化区域
   - WebGL 可以通过 Scissor Test 实现

3. **Instancing 支持**
   - 批量绘制相同图形（如粒子系统）
   - WebGL/WebGPU 专用优化

4. **异步资源加载**
   - 图片、字体异步上传到 GPU
   - 避免主线程阻塞

5. **Shader 自定义**
   - 暴露 Shader 接口，支持自定义效果
   - Canvas2D 可以通过 Filter API 模拟部分效果

---

## ✅ 改进总结

经过补充，`IRenderBackend` 接口现在已经覆盖了：

✅ **完整的 Canvas2D 功能集**

- 变换、裁剪、透明度、混合模式
- 基础图形（矩形、椭圆、路径）
- 线条样式（端点、连接、虚线）
- 填充方式（纯色、渐变、图案）
- 文本渲染与测量
- 图片绘制（含精灵图裁剪）
- 阴影效果

✅ **WebGL/WebGPU 必需特性**

- 帧控制（beginFrame/endFrame）
- 资源管理（创建/删除纹理、渲染目标）
- 离屏渲染（FBO）
- 性能统计

✅ **跨后端统一抽象**

- 类型化数据传输（Float32Array、Uint8Array）
- 枚举抹平差异（BlendMode、LineCap 等）
- 可选特性标识（boolean 返回值）
- 后端类型识别

**现在这个接口可以很好地支持 Canvas2D、WebGL、WebGPU 三种后端的平滑切换！** 🎉
