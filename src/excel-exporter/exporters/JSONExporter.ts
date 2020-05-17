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

	export(name: string, table: TableData) {
		const file = path.join(this.configs.directory, name + ".json");
		let headers = table.headers;
		let values = [];
		for (const row of table.values) {
			let new_row = {};
			for (let i = 0; i < headers.length; i++) {
				const field = headers[i];
				new_row[field.name] = row[i];
			}
			values.push(new_row);
		}
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
		const text = JSON.stringify(this.recursively_order_keys(values), null, indent);
		this.save_text(file, text);
		console.log(colors.green(`\t ${name} ==> ${file}`));
	}
}