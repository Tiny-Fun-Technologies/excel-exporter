import { TableData } from "./TableParser";
import { FileAccess, ModeFlags, DirAccess } from "tiny/io";
import { path } from "tiny/path";

export interface ExporterConfigs {
	enabled: boolean,
	directory: string,
}

export class TableExporter {
	configs: ExporterConfigs = null;
	name: string = "";

	constructor(configs: ExporterConfigs) {
		this.configs = configs;
	}

	get extension(): string { return ''}

	protected line(text = "", indent = 0) {
		let line = "";
		for (let i = 0; i < indent; i++) {
			line += "\t";
		}
		line += text;
		line += "\n";
		return line;
	}

	protected save_text(file_path: string, text: string) {
		let dir = path.dirname(file_path);
		if (!DirAccess.exists(dir)) {
			DirAccess.make_dir(dir, true);
		}
		let file = FileAccess.open(file_path, ModeFlags.WRITE);
		file.save_as_utf8_string(text);
		file.close();
	}
	/**
	 * 导出配置表数据
	 * @param name 表名称
	 * @param table 表数据
	 */
	export(name: string, table: TableData) { }

	/** 全部配置表导出完毕后保存文件 */
	finalize() {}
}