import { TableExporter, ExporterConfigs } from "excel-exporter/TableExporter";
import { TableData, DataType } from "excel-exporter/TableParser";
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

	protected export_table(name: string, table: TableData, export_type: "class" | "interface", declaration: boolean) {
		let configs = (this.configs as TypeScriptExporterConfigs);
		let class_name = `${configs.class_name_prefix}${name}${configs.class_name_extension}`;

		let body = "";
		for (const field of table.headers) {
			let type = "any";
			switch (field.type) {
				case DataType.bool:
					type = "boolean";
				case DataType.string:
					type = "string";
					break;
				case DataType.float:
				case DataType.int:
					type = "number";
					break;
				default:
					type = "any";
					break;
			}
			if (field.is_array) {
				type += "[]";
			}
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
			body += this.line(`${field.name}: ${type};`, 1);
		}
		if (export_type == "class" && !declaration) {
			body += this.line();
			body += this.line(`static $bind_rows(rows: object[]) {`, 1);
			body += this.line(`for (const row of rows) {`, 2);
			body += this.line(`Object.setPrototypeOf(row, ${class_name}.prototype);`, 3);
			body += this.line("}", 2);
			body += this.line("}", 1);
		}
		let export_method = declaration ? "declare" : "export";
		let class_text = this.line(`${export_method} ${export_type} ${class_name} {\n${body}\n}`);
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