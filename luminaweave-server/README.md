# LuminaWeave Dedicated Server Plugin

LuminaWeave 独占的服务器后端插件 (Full-Stack 模式补充)。
它负责为“全局作用域”提供独立 JSON 配置文件的存取支持（脱离默认的 ST `settings.json`），实现个人配置文件的绝对独立与多机同步便利。

## 安装与配置方法

由于这是一个运行在 NodeJS 内存中的底层读写（Server）插件，它的安装需要额外的开启权限（ST 默认禁止后门读写）。

### 1. 修改启动配置
请用文本编辑器打开你 SillyTavern 根目录下的 `config.yaml`。
找到下面这行，并将它的值修改为 `true`：

```yaml
enableServerPlugins: true
```

### 2. 重启服务器
修改配置文件并安装好软链接后，**必须彻底关闭 SillyTavern 并重新启动黑色命令行控制台** (`Start.bat` 或 `node server.js`) 才能使后端的 API 生效。

### 3. 在设置中验证
启动后，回到浏览器的 LuminaWeave 的【全景掌控设置 -> 所有插件概览】。
点击【全局引擎策略】中的 **独立 JSON 剥离 (Full-Stack 模式)**。
如果右下方没有弹出红色报错，并且在同级目录下成功生成了 `data/LuminaWeave.json` 文件，代表后端挂载成功！

## 开发与编译 (Maintenance)

> [!IMPORTANT]
> **源码唯一性**：本项目使用 TypeScript 编写，`index.ts` 是唯一的原始代码文件。
> **严禁直接修改 `index.js`**：该文件是由编译器生成的产物，任何手动修改都会在下次编译时被覆盖。

### 编译流程
如果您修改了 `index.ts`，请在当前目录下执行以下命令来刷新运行代码：

```bash
npm run build
```

编译成功后，Silly Tavern 会自动检测到加载文件的变更（或需手动重启 ST）。
