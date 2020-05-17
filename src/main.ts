import { get_startup_arguments } from "./tiny/env";
import { ExcelExporterApplication } from "excel-exporter/ExcelExporterApplication";
import { FileAccess } from "tiny/io";
import * as colors from "colors";

(async function main(argv: string[]) {

	let config_file = argv[argv.length - 1];
	if (config_file.endsWith(".json") && FileAccess.exists(config_file)) {
		let app = new ExcelExporterApplication(config_file);
		app.parse();
		app.export();
		console.log(colors.green("All Done"));
	} else {
		console.log(colors.red("请传入配置文件作为参数"));
	}

})(get_startup_arguments());
