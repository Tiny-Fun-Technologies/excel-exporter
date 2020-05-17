# Excel 配置表数据导出工具

将 Excel 配置表中的数据导出为方便程序读取和使用的数据。

## 目前支持的导出格式有:
* JSON 文件
* C# 类型声明
~~* TypeScript 声明文件（需要配合 JSON 使用）~~
~~* Godot 引擎的 GDScript 脚本文件~~

## 表格格式说明

* 每个 xlsl 文件中可以有多张表（Sheet），每张表会都导出一份数据文件，表名必须符合标识符规范
* 表名为 `@skip` 或以 `@skip` 开头的表会被忽略，不会导出数据文件
* 第一列值为 `@skip` 的行会被忽略，视为无效数据行
* 整行所有列为空的行会被忽略，视为无效数据行
* 每张表的**第一个有效数据行**用作字段名，决定了导出数据所拥有的属性，**字段名必须符合标识符命名规范**
* 字段名所在的行中不填名称的列视为空字段，该列的数据在导出时会被忽略
* 相同名称的字段导出时会被合并为数组
* 导出属性的数据类型由**整列所填写的数据类型**决定，支持以下数据类型
	* 字符串
	* 数值（优先使用整形）
	* 布尔值
	* 空(`null`)
* 该工具设计原则是简单易用，表格字段可由策划自由调整， 不支持数据引用，暂不支持结构体

## Windows 安装
安装 NodeJS, 注意勾选将 Node 添加到环境变量 `PATH` 中

## 使用
	修改配置表
	修改 excel-exporter.json 修改工具配置
	双击 转表.bat 执行转换工作

### 配置示例

```json
{
	"input": [
		{ "file": "装备表.xlsx", "encode": "GBK"},
		{ "file": "关卡表.xlsx", "encode": "GBK"},
	],
	"parser": {
		"first_row_as_field_comment": true
	},
	"output": {
		"json": {
			"enabled": true,
			"directory": "../../client/Assets/Resources/data/json",
			"indent": "\t"
		},
		"csharp": {
			"enabled": true,
			"directory": "../../client/Assets/Resources/data/csharp",
			"namespace": "game.data",
			"base_type": "tiny.data.UniqueIDObject",
			"file_name": "data",
			"ignore_id": true
		}
	}
}
```