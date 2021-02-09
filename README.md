# Excel 配置表数据导出工具

将 Excel 配置表中的数据导出为方便程序读取和使用的数据。

## 支持将Excel配置表导出为:
- [x] JSON 数据文件
- [x] YAML 数据文件
- [x] C# 类型声明
- [x] TypeScript interface类型声明、class类型定义（可用 `instanceof` 进行类型检查）
- [x] 能够扩展导出其他数据格式和代码声明

## 表格格式说明

* 每个 xlsl 文件中可以有多张表（Sheet），每张表会都导出一份数据文件，表名必须符合标识符规范
* 表名为 `@skip` 或以 `@skip` 开头的表会被忽略，不会导出数据文件
* 第一列值为 `@skip` 的行会被忽略，视为无效数据行
* 整行所有列为空的行会被忽略，视为无效数据行
* 第一列名为`@field`的行用作字段名，决定了导出数据所拥有的属性，**字段名必须符合标识符命名规范**；该行中不填名称的列视为空字段，该列的数据在导出时会被忽略，可以用于辅助数据列
* 第一列名为`@comment`的行用作字段注释文档，用于描述其底下对应的字段
* 相同名称的字段导出时会被合并为数组
* 导出属性的数据类型由**整列所填写的数据类型**决定，支持以下数据类型
	* 字符串
	* 数值（优先使用整形）
	* 布尔值
	* 空(`null`)
* 该工具设计原则是简单易用，表格字段可由策划自由调整，不支持数据引用

### 表格式示例
![](screentshot-sheet-example.png)
以 TypeScript 为例，上图所示的表格将被导出为下面的数据格式，每行数据可被表示为一个 `EffectSequenceData` 类型的对象
```ts
export class EffectSequenceData {
	readonly id: number;
	/** 关键帧 */
	readonly frames: readonly {
		/** 时间 */
		readonly time: number;
		/** 事件 */
		readonly event: string;
		/** 特效 */
		readonly effect: string;
		/** 音效 */
		readonly audio: string;
	}[];
	/** 动作 */
	readonly animation: string;
	/** 时长 */
	readonly length: number;

	static $bind_rows(rows: object[]) {
		for (const row of rows) {
			Object.setPrototypeOf(row, EffectSequenceData.prototype);
		}
	}
}
```


## 安装
- 安装 NodeJS 和 NPM, 注意将 Node 和 NPM 添加到环境变量 `PATH` 中
- 执行下面的命令构建项目，将生成的 `dist` 复制到到您的项目中
```
npm run build
```

## 使用
- 按照上面介绍的规则填写 Excel 配置表
- 修改 `excel-exporter.yaml` 修改工具配置，配置要读取的 Excel 文件列表，配置你需要的导出器
- Windows 下双击 `转表.bat` 执行转换工作
- Linux/macOS 下执行 `转表.sh` 执行转换工作

### 配置示例

```yaml
input:
  - 特效表.xlsx
parser:
  first_column_as_id: true # 第一列用作 ID 列
  constant_array_length: [
    # 这里填入需要固定数组长度的表名称
  ]
output:
  json:
    enabled: false
    directory: "../../project/Assets/res/data/excel"
    indent: "\t"
  yaml:
    enabled: true
    directory: "../../project/Assets/res/data/excel"
    indent: 2
  typescript:
    enabled: true
    declaration: false
    type: class
    class_name_prefix: ''
    class_name_extension: Data
    directory: "../../project/Scripts/src/game/configs"
    file_name: excel
```