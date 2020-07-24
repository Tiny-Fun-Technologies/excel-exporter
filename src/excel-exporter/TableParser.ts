import * as xlsl from "xlsx";
import { FileAccess, ModeFlags } from "tiny/io";
import * as colors from "colors";

type RawTableData = xlsl.CellObject[][];

export interface ParserConfigs {
	/** 第一行作为注释 */
	first_row_as_field_comment: boolean;
	/** 固定数组长度 */
	constant_array_length: boolean;
}

export enum DataType {
	null = 'null',
	int = 'int',
	bool = 'bool',
	float = 'float',
	string = 'string',
}

const TypeCompatibility = {
	string: 5,
	float: 4,
	int: 3,
	bool: 2,
	null: 1
};

export interface ColumnDescription {
	type: DataType;
	name: string;
	is_array?: boolean;
	comment?: string;
}

export interface TableData {
	headers: ColumnDescription[],
	values: any[][]
}

const SKIP_PREFIX = "@skip";

export class TableParser {

	configs: ParserConfigs = null;

	constructor(configs: ParserConfigs) {
		this.configs = configs;
	}

	public parse_xlsl(path) {
		return this.load_raw_xlsl_data(path);
	}

	protected load_raw_xlsl_data(path: string): { [key: string]: TableData } {
		var file = FileAccess.open(path, ModeFlags.READ);
		let wb = xlsl.read(file.get_as_array());
		file.close();
		let raw_tables: { [key: string]: RawTableData } = {};
		for (const name of wb.SheetNames) {
			let sheet_name = name.trim();
			if (sheet_name.startsWith(SKIP_PREFIX)) continue;
			raw_tables[sheet_name] = this.parse_sheet(wb.Sheets[name]);
		}

		let tables: { [key: string]: TableData } = {};
		for (const name in raw_tables) {
			console.log(colors.grey(`\t解析配置表 ${name}`));
			tables[name] = this.process_table(raw_tables[name]);
		}
		return tables;
	}

	protected parse_sheet(sheet: xlsl.WorkSheet): RawTableData {
		let range = xlsl.utils.decode_range(sheet['!ref']);
		var rows: RawTableData = [];
		for (let r = range.s.r; r <= range.e.r; r++) {
			let R = xlsl.utils.encode_row(r);
			let row: xlsl.CellObject[] = [];
			for (let c = range.s.c; c <= range.e.c; c++) {
				let C = xlsl.utils.encode_col(c);
				let cell = sheet[`${C}${R}`] as xlsl.CellObject;
				row.push(cell);
			}
			rows.push(row);
		}
		return rows;
	}

	protected process_table(raw: RawTableData): TableData {
		const type_order = [ DataType.string, DataType.float, DataType.int, DataType.bool, DataType.null];
		let headers: ColumnDescription[] = [];

		let column_values: xlsl.CellObject[][] = [];
		let ignored_columns = new Set<number>();
		// 去除无用的列
		let rows: RawTableData = [];
		for (const row of raw) {
			if (this.is_valid_row(row)) {
				rows.push(row);
			}
		}

		let column = 0;
		for (let c = 0; c < rows[0].length; c++) {
			let first = rows[0][c];
			if (this.get_data_type(first) != DataType.string) {
				ignored_columns.add(c);
				continue;
			}
			const start_raw = 1;
			let column_cells = this.get_column(rows, c, start_raw);
			let type = DataType.null;
			for (let i = 0; i < column_cells.length; i++) {
				const cell = column_cells[i];
				var t = this.get_data_type(cell);
				if (type_order.indexOf(t) < type_order.indexOf(type)) {
					if (type != DataType.null) {
						console.log(colors.yellow(`\t\t${first.v} 的数据类型被提升为 ${t}\n\t\t  ${this.dump_row_values(rows[start_raw + i])}`));
					}
					type = t;
				}
			}
			let comment: string = undefined;
			if (this.configs.first_row_as_field_comment) {
				comment = this.get_cell_value(raw[0][c], DataType.string) as string;
			}
			headers.push({
				type,
				comment,
				name: first.v as string,
			});

			column_values.push([]);
			for (const cell of column_cells) {
				column_values[column].push(cell);
			}
			column += 1;
		}

		let values: RawTableData = [];
		for (let r = 0; r < rows.length - 1; r++) {
			let row: any = [];
			for (let c = 0; c < column_values.length; c++) {
				row.push(column_values[c][r])
			}
			values.push(row);
		}
		return this.parse_values(headers, values);
	}


	protected parse_values(raw_headers : ColumnDescription[], raw_values: RawTableData) {
		type FiledInfo = {
			column: ColumnDescription,
			start: number,
			indexes: number[]
		};
		let field_maps = new Map<string, FiledInfo>();
		let field_list: FiledInfo[] = [];
		let c_idx = 0;
		for (const column of raw_headers) {
			if (!field_maps.has(column.name)) {
				const field = {
					column,
					start: c_idx,
					indexes: [ c_idx ]
				};
				field_list.push(field);
				field_maps.set(column.name, field);
			} else {
				let field = field_maps.get(column.name);
				field.column.is_array = true;
				field.indexes.push(c_idx);
				if (TypeCompatibility[column.type] > TypeCompatibility[field.column.type]) {
					field.column.type = column.type;
				}
			}
			c_idx += 1;
		}
		let headers: ColumnDescription[] = [];
		for (const filed of field_list) {
			headers.push(filed.column);
		}
		let values: any[][] = [];
		for (const raw_row of raw_values) {
			let row: any[] = [];
			for (const filed of field_list) {
				if (filed.column.is_array) {
					let arr = [];
					for (const idx of filed.indexes) {
						const cell = raw_row[idx];
						if (cell || this.configs.constant_array_length) {
							arr.push(this.get_cell_value(cell, filed.column.type));
						}
					}
					row.push(arr);
				} else {
					const cell = raw_row[filed.start];
					row.push(this.get_cell_value(cell, filed.column.type));
				}
			}
			values.push(row);
		}

		return {
			headers,
			values
		}
	}

	protected is_valid_row(row: xlsl.CellObject[]) {
		let first = row[0];
		if (this.get_data_type(first) == DataType.string && (first.v as string).trim().startsWith(SKIP_PREFIX)) {
			return false;
		}
		let all_empty = true;
		for (const cell of row) {
			let current_empty = this.get_data_type(cell) == DataType.null;
			if (!current_empty) {
				current_empty = this.get_data_type(cell) == DataType.string && (cell.v as string).trim().length == 0;
			}
			all_empty = all_empty && current_empty;
		}
		if (all_empty) return false;
		return true;
	}

	protected get_column(table: RawTableData, column: number, start_row: number = 0): xlsl.CellObject[] {
		let cells: xlsl.CellObject[] = [];
		for (let r = start_row; r < table.length; r++) {
			const row = table[r];
			cells.push(row[column]);
		}
		return cells;
	}

	protected get_data_type(cell: xlsl.CellObject): DataType {
		if (!cell) return DataType.null;
		switch (cell.t) {
			case 'b':
				return DataType.bool;
			case 'n':
				return Number.isInteger(cell.v as number) ? DataType.int : DataType.float;
			case 's':
			case 'd':
				return DataType.string;
			case 'e':
			case 'z':
			default:
				return DataType.null;
		}
	}

	protected get_cell_value(cell: xlsl.CellObject, type: DataType) {
		switch (type) {
			case DataType.bool:
				return cell.v as boolean == true;
			case DataType.int:
				return cell ? cell.v as number : 0;
			case DataType.float:
				return cell ? cell.v as number : 0;
			case DataType.string:
				return cell ? cell.v + '' : '';
			default:
				return null;
		}
	}

	protected dump_row_values(row: xlsl.CellObject[]) {
		let ret = [];
		for (const cell of row) {
			ret.push(this.get_cell_value(cell, this.get_data_type(cell)));
		}
		return ret;
	}
}