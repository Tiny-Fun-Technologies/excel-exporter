import { ExporterConfigs } from "excel-exporter/TableExporter";
import { TableData } from "excel-exporter/TableParser";
import { path } from "tiny/path";
import * as colors from "colors";
import { JSONExporter } from "./JSONExporter";
import * as yaml from "js-yaml";

interface YAMLExporterConfigs extends ExporterConfigs {
	/** 缩进字符 */
	indent: number;
}

export class YAMLExporter extends JSONExporter {

	get extension(): string { return 'yaml'}

	constructor(configs: ExporterConfigs) {
		super(configs);
		if ( typeof ((this.configs as YAMLExporterConfigs).indent) != 'number') {
			(this.configs as YAMLExporterConfigs).indent = 2;
		}
	}

	export(name: string, table: TableData) {
		const file = path.join(this.configs.directory, `${name}.${this.extension}`);
		const text = yaml.dump(
			this.export_json_object(name, table),
			{
				indent: this.indent.length,
				sortKeys: true,
			}
		);
		this.save_text(file, text);
		console.log(colors.green(`\t ${name} ==> ${file}`));
	}
}