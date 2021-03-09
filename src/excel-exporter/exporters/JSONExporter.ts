import { TableExporter, ExporterConfigs } from "excel-exporter/TableExporter";
import { TableData } from "excel-exporter/TableParser";
import { path } from "tiny/path";
import * as colors from "colors";

interface JSONExporterConfigs extends ExporterConfigs {
	/** 缩进字符 */
	indent: string;
}

export class JSONExporter extends TableExporter {

	constructor(configs: ExporterConfigs) {
		super(configs);
		if ( typeof ((this.configs as JSONExporterConfigs).indent) != 'string') {
			(this.configs as JSONExporterConfigs).indent = "  ";
		}
	}

	get extension(): string { return this.configs.extension || 'json'; }

	protected recursively_order_keys(unordered: object | Array<object>) {
		// If it's an array - recursively order any
		// dictionary items within the array
		if (Array.isArray(unordered)) {
			unordered.forEach((item, index) => {
				unordered[index] = this.recursively_order_keys(item);
			});
			return unordered;
		}
		// If it's an object - let's order the keys
		if (typeof unordered === 'object' && unordered != null) {
			var ordered = {};
			Object.keys(unordered).sort().forEach((key) => {
				ordered[key] = this.recursively_order_keys(unordered[key]);
			});
			return ordered;
		}
		return unordered;
	}

	protected get indent(): string {
		let indent = "";
		const configs = (this.configs as JSONExporterConfigs);
		if (configs.indent) {
			if (typeof (configs.indent) == 'number') {
				for (let i = 0; i < configs.indent; i++) {
					indent += " ";
				}
			} else if (typeof configs.indent == 'string') {
				indent = configs.indent;
			}
		}
		return indent;
	}

	export_json_object(name: string, table: TableData) {
		return this.recursively_order_keys(table.data);
	}

	export(name: string, table: TableData) {
		const file = path.join(this.configs.directory, `${name}.${this.extension}`);
		const text = JSON.stringify(this.export_json_object(name, table), null, this.indent);
		this.save_text(file, text);
		console.log(colors.green(`\t ${name} ==> ${file}`));
	}
}