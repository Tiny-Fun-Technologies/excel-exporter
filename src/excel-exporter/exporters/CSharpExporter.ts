import { TableExporter, ExporterConfigs } from "excel-exporter/TableExporter";
import { TableData, DataType } from "excel-exporter/TableParser";
import { path } from "tiny/path";
import * as colors from "colors";

interface CSharpExporterConfigs extends ExporterConfigs {
	namespace: string,
	base_type: string,
	file_name: string,
	ignore_id: boolean
}

export class CSharpExporter extends TableExporter {
	protected declear_content = "";
	protected classes: string[] = [];

	constructor(configs: ExporterConfigs) {
		super(configs);
		if ( typeof ((this.configs as CSharpExporterConfigs).namespace) != 'string') {
			(this.configs as CSharpExporterConfigs).namespace = "game.data";
		}
		if ( typeof ((this.configs as CSharpExporterConfigs).base_type) != 'string') {
			(this.configs as CSharpExporterConfigs).namespace = "object";
		}
		if ( typeof ((this.configs as CSharpExporterConfigs).file_name) != 'string') {
			(this.configs as CSharpExporterConfigs).file_name = "data";
		}

		this.declear_content += this.line("// Tool generated file DO NOT MODIFY");
		this.declear_content += this.line("using System;");
		this.declear_content += this.line();
		this.declear_content += this.line("namespace " + (this.configs as CSharpExporterConfigs).namespace + " {")
		this.declear_content += this.line("%CLASSES%");
		this.declear_content += this.line("}");
	}


	export(name: string, table: TableData) {
		const base_type = (this.configs as CSharpExporterConfigs).base_type;
		let body = "";
		for (const field of table.headers) {
			if (field.name == 'id' && (this.configs as CSharpExporterConfigs).ignore_id) {
				continue;
			}
			let type = "object";
			switch (field.type) {
				case DataType.bool:
				case DataType.float:
				case DataType.string:
				case DataType.int:
					type = field.type;
					break;
				default:
					type = "object";
					break;
			}
			if (field.is_array) {
				type += "[]";
			}
			if (field.comment) {
				let comment = field.comment.split("\r\n").join("\t");
				comment = comment.split("\n").join("\t");
				body += this.line(`/// <summary>${comment}</summary>`, 1);
			}
			body += this.line(`public ${type} ${field.name};`, 1);
		}
		let class_text = this.line(`public class ${name} : ${base_type} {\n${body}\n}`);
		this.classes.push(class_text);
	}

	finalize() {
		let class_text = "";
		for (const cls of this.classes) {
			class_text += cls;
			class_text += this.line();
		}

		let file = path.join(this.configs.directory, (this.configs as CSharpExporterConfigs).file_name);
		if (!file.endsWith(".cs")) {
			file += ".cs";
		}
		this.save_text(file, this.declear_content.replace("%CLASSES%", class_text));
		console.log(colors.green(`\t${file}`));
	}
}