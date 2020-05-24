import { FileAccess, ModeFlags } from "tiny/io";
import { ParserConfigs, TableParser, TableData } from "./TableParser";
import { ExporterConfigs, TableExporter } from "./TableExporter";
import { JSONExporter } from "./exporters/JSONExporter";
import { CSharpExporter } from "./exporters/CSharpExporter";
import * as colors from "colors";
import { TypeScriptExporter } from "./exporters/TypeScriptExporter";

export interface Configurations {
	/** 解析配置 */
	parser?: ParserConfigs,
	/** 要读取的 XLSL 文档 */
	input: {"file": string, encode: string}[],
	/** 导出配置 */
	output: { [key: string]: ExporterConfigs }
}


const exporters: {[key:string]: new(config: ExporterConfigs) => TableExporter } = {
	json: JSONExporter,
	csharp: CSharpExporter,
	typescript: TypeScriptExporter,
}


export class ExcelExporterApplication {

	configs: Configurations = null;
	parser: TableParser = null;
	tables: { [key: string]: TableData } = {};
	exporters: TableExporter[] = [];

	constructor(config_file: string) {
		let file = FileAccess.open(config_file, ModeFlags.READ);
		this.configs = JSON.parse(file.get_as_utf8_string()) as Configurations;
		file.close();
		this.parser = new TableParser(this.configs.parser);

		for (const key in this.configs.output) {
			let cls = exporters[key];
			if (cls) {
				const exporter = new cls(this.configs.output[key]);
				exporter.name = key;
				this.exporters.push(exporter);
			}
		}
	}

	parse() {
		for (const item of this.configs.input) {
			console.log(colors.grey(`解析配表文件: ${item.file}`));
			let sheets = this.parser.parse_xlsl(item.file);
			for (const name in sheets) {
				this.tables[name] = sheets[name];
			}
		}
		console.log(colors.green(`解析所有配表文件完成`));
		console.log();
	}

	export() {
		for (const exporter of this.exporters) {
			if (exporter.configs.enabled) {
				console.log(colors.white(`执行 ${exporter.name} 导出:`));
				for (const name in this.tables) {
					exporter.export(name, this.tables[name]);
				}
				exporter.finalize();
				console.log();
			}
		}
	}
}