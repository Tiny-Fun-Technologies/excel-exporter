import { TableExporter, ExporterConfigs } from "excel-exporter/TableExporter";
import { TableData, DataType, Field } from "excel-exporter/TableParser";
import * as colors from "colors";
import { path } from "tiny/path";

interface TypeScriptExporterConfigs extends ExporterConfigs {
	type: "interface" | "class",
	declaration: boolean,
	file_name: string,
	class_name_prefix: string,
	class_name_extension: string,
}

export class TypeScriptExporter extends TableExporter {

	classes: string[] = [];
	get extension(): string { return 'ts'}

	constructor(configs: TypeScriptExporterConfigs) {
		super(configs);
		configs.class_name_prefix = configs.class_name_prefix || "";
		configs.class_name_extension = configs.class_name_extension || "";
	}

	export (name: string, table: TableData) {
		this.export_table(
			name,
			table,
			(this.configs as TypeScriptExporterConfigs).type,
			(this.configs as TypeScriptExporterConfigs).declaration,
		);
	}

	protected export_field(field: Field, indent = 0, ignore_root = false) {
		let body = "";
		let type = "any";
		switch (field.type) {
			case DataType.bool:
				type = "boolean";
				break;
			case DataType.string:
				type = "string";
				break;
			case DataType.float:
			case DataType.int:
				type = "number";
				break;
			case DataType.struct: {
				type = '{\n';
				let ignoreArrays = new Set<string>();
				for (const c of field.children) {
					if (ignoreArrays.has(c.name)) continue;
					type += this.indent_text(this.export_field(c, indent + 1), indent);
					if (c.is_array) {
						ignoreArrays.add(c.name);
					}
				}
				type += ignore_root ? '' : this.indent_text('}', indent);
			} break;
			default:
				type = "any";
				break;
		}
		if (field.is_array) type = `readonly ${type}[]`;
		if (field.comment) {
			if (field.comment.trim().length) {
				let comments = field.comment.split("\n");
				if (comments.length > 1) {
					body += this.line("/** ", 1);
					for (const comment of comments) {
						body += this.line(" * " + comment.trim() + "  ", 1);
					}
					body += this.line(" */", 1);
				} else {
					body += this.line(`/** ${comments[0].trim()} */`, 1);
				}
			}
		}
		body += ignore_root ? this.line(`${type}`, indent) : this.line(`readonly ${field.name}: ${type};`, indent);
		return body;
	}

	protected export_table(name: string, table: TableData, export_type: "class" | "interface", declaration: boolean) {
		let configs = (this.configs as TypeScriptExporterConfigs);
		let class_name = `${configs.class_name_prefix}${name}${configs.class_name_extension}`;

		let body = this.export_field(table.struct, 0, true);
		if (export_type == "class" && !declaration) {
			body += this.line(`static $bind_rows(rows: object[]) {`, 1);
			body += this.line(`for (const row of rows) {`, 2);
			body += this.line(`Object.setPrototypeOf(row, ${class_name}.prototype);`, 3);
			body += this.line("}", 2);
			body += this.line("}", 1);
		} else {
			export_type = 'interface';
		}
		let class_text = this.line(`export ${export_type} ${class_name} ${body}\n}`);
		this.classes.push(class_text);
	}

	finalize() {
		let configs = (this.configs as TypeScriptExporterConfigs);
		const extension = configs.declaration ? ".d.ts" : ".ts";
		let class_text = this.line("// Tool generated file DO NOT MODIFY");
		class_text += this.line();

		for (const cls of this.classes) {
			class_text += cls;
			class_text += this.line();
		}
		let file = path.join(this.configs.directory, (this.configs as TypeScriptExporterConfigs).file_name);
		if (!file.endsWith(extension)) {
			file += extension;
		}
		this.save_text(file, class_text);
		console.log(colors.green(`\t${file}`));
	}

}