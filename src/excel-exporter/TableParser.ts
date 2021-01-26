import * as xlsl from "xlsx";
import { FileAccess, ModeFlags } from "tiny/io";
import * as colors from "colors";

export enum Keywords {
	SKIP = '@skip',
	FIELD = '@field',
	COMMENT = '@comment'
}

const SKIP_WORDS = [ Keywords.SKIP, Keywords.FIELD, Keywords.COMMENT ];

export enum DataType {
	null = 'null',
	int = 'int',
	bool = 'bool',
	float = 'float',
	string = 'string',
	struct = 'struct',
}


interface RawTableCell extends xlsl.CellObject {
	/** Column number */
	column: number;
	/** Row number */
	row: number;
};

type RawTableData = RawTableCell[][];

export interface ParserConfigs {
	/** 第一列作为ID */
	first_column_as_id: boolean;
	/** 固定数组长度的表名称 */
	constant_array_length: string[];
}

export class Field {

	static readonly TYPE_ORDER = [ DataType.struct, DataType.string, DataType.float, DataType.int, DataType.bool, DataType.null ];

	/** 该字段的列范围（下标从0开始，包含 start 和 end 所在的列） */
	columns: { start: number; end: number; }
	/** 字段名 */
	name: string;
	/** 注释 */
	comment?: string;
	/** 子字段 */
	children: ReadonlyArray<Field>;
	/** 数据类型 */
	type?: DataType;
	/** 保持数组长度和配置表中的列数量一致，没填的数据使用 null 填充 */
	constant_array_length?: boolean;
	/** 所属字段 */
	parent: Field;

	/** 添加子字段 */
	add_field(field: Field) {
		let target = this.get_inner_parent_field(field);
		if (target) {
			target.add_child_field(field);
		}
	}

	private add_child_field(field: Field) {
		if (!field) return;
		if (!this.children) this.children = [];
		(this.children as Field[]).push(field);
		this.type = DataType.struct;
	}

	private get_inner_parent_field(field: Field): Field {
		if (this.children) {
			for (const cf of this.children) {
				let target = cf.get_inner_parent_field(field);
				if (target) return target;
			}
		}
		if (this.is_parent_of(field)){
			return this;
		}
		return undefined;
	}

	private is_parent_of(field: Field) {
		return field.columns.start >= this.columns.start && field.columns.end <= this.columns.end;
	}

	get_atomic_field_at_column(column: number): Field {
		if (this.children) {
			for (const cf of this.children) {
				let target = cf.get_atomic_field_at_column(column);
				if (target) return target;
			}
		}
		if (!this.children && this.columns.start === this.columns.end && this.columns.start === column) {
			return this;
		}
		return undefined;
	}

	/** 是否为数组 */
	public get is_array() : boolean { return this._is_array; }
	private _is_array : boolean;

	public build() {
		if (this.children) {
			let named_fields: {[key: string]: Field[]} = {};
			for (const c of this.children) {
				let arr = named_fields[c.name] || [];
				arr.push(c);
				named_fields[c.name] = arr;
			}
			for (const [name, fields] of Object.entries(named_fields)) {
				if (fields.length > 1) { // 推断数组类型
					const type = this.infer_field_type(fields);
					for (const f of fields) {
						f._is_array = true;
						f.type = type;
						if (type === DataType.struct) { // 数组元素的类型
							for (const keys of fields.map( f => f.children.map(cf => cf.name) )) {
								for (const key of keys) {
									let same_name_fileds = fields.map( f => f.children.find( cf => cf.name === key));
									const ctype = this.infer_field_type(same_name_fileds);
									same_name_fileds.forEach( f => { f.type = ctype });
								}
							}
						}
					}
					if (type === DataType.null) {
						console.log(colors.red(`\t\t${name}(${xlsl.utils.encode_col(fields[0].columns.start)}列) 没有填入有效数据, 无法推断其数据类型`));
					}
				}
			}
			for (const c of this.children) {
				c.constant_array_length = this.constant_array_length;
				c.parent = this;
				c.build();
				if (c.type === DataType.null && !c._is_array) {
					console.log(colors.red(`\t\t${c.name}(${xlsl.utils.encode_col(c.columns.start)}列) 没有填入有效数据, 无法推断其数据类型`));
				}
			}
		}
	}

	protected infer_field_type(fields: Field[]) {
		let indeies = fields.map(f => Field.TYPE_ORDER.indexOf(f.type));
		indeies = indeies.filter(idx => idx >= 0);
		const type = Field.TYPE_ORDER[Math.min(...indeies)];
		return type;
	}

	/** 解析一条数据 */
	public parse_row(row: RawTableCell[]) {
		if (this.type != DataType.struct) {
			const cell = row[this.columns.start];
			let value = this.get_cell_value(cell, this.type);
			if (this.is_array && !this.constant_array_length && (!cell || cell.t === 'z')) {
				value = null;
			}
			return value;
		} else if (this.children && this.children.length) {
			let obj = {};
			let isAllNullish = true;
			for (const c of this.children) {
				const value = c.parse_row(row);
				const is_null = this.check_is_null(row);
				if (c.is_array) {
					let arr: any[] = obj[c.name] || [];
					if (this.constant_array_length || value !== null) {
						arr.push(value);
					}
					obj[c.name] = arr;
				} else {
					obj[c.name] = value;
				}
				isAllNullish = isAllNullish && is_null;
			}
			return isAllNullish ? null : obj;
		}
	}

	protected get_cell_value(cell: RawTableCell, type: DataType) {
		switch (type) {
			case DataType.bool:
				return cell ? cell.v as boolean == true : false;
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

	protected check_is_null(row: RawTableCell[]): boolean {
		if (this.children) {
			let isAllNullish = true;
			for (const c of this.children) {
				isAllNullish = isAllNullish && c.check_is_null(row);
				if (!isAllNullish) {
					return false;
				}
			}
			return isAllNullish;
		} else {
			let cell = row[this.columns.start];
			return !cell || cell.t === 'z';
		}
	}
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
	struct: Field;
	data: {[key: string]: any}[];
}

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
		let raw_tables: {[key: string]: RawTableData } = {};
		let table_fields: {[key: string]: Field} = {};
		for (const name of wb.SheetNames) {
			let sheet_name = name.trim();
			if (sheet_name.startsWith(Keywords.SKIP)) continue;
			raw_tables[sheet_name] = this.parse_sheet(wb.Sheets[name]);
			table_fields[sheet_name] = this.parse_struct(sheet_name, wb.Sheets[name]);
		}

		let tables: { [key: string]: TableData } = {};
		for (const name in raw_tables) {
			console.log(colors.grey(`\t解析配置表 ${name}`));
			tables[name] = this.process_table(table_fields[name], raw_tables[name]);
		}
		return tables;
	}

	protected parse_sheet(sheet: xlsl.WorkSheet): RawTableData {
		let range = xlsl.utils.decode_range(sheet['!ref']);
		var rows: RawTableData = [];
		for (let r = range.s.r; r <= range.e.r; r++) {
			let R = xlsl.utils.encode_row(r);
			let row: RawTableCell[] = [];
			for (let c = range.s.c; c <= range.e.c; c++) {
				let C = xlsl.utils.encode_col(c);
				let origin_cell = sheet[`${C}${R}`] as xlsl.CellObject;
				let cell: RawTableCell = origin_cell ? {
					...origin_cell,
					column: c,
					row: r,
				} : null;
				row.push(cell);
			}
			rows.push(row);
		}
		return rows;
	}

	protected parse_struct(name: string, sheet: xlsl.WorkSheet): Field {
		let range = xlsl.utils.decode_range(sheet['!ref']);
		const root = new Field();
		root.name = name;
		root.columns = { start: range.s.c, end: range.e.c };
		if (this.configs.first_column_as_id) {
			let id = new Field();
			id.name = 'id';
			id.columns = { start: 0, end: 0 };
			root.add_field(id);
		}

		const get_cell_range = (c: number, r: number): xlsl.Range => {
			let ranges = new Map<number, xlsl.Range>();
			const merges = sheet['!merges'];
			if (merges) {
				for (const m of merges) {
					if (c >= m.s.c && c <= m.e.c && r >= m.s.r && r <= m.e.r) {
						ranges.set(Math.pow(m.s.c - c, 2) + Math.pow(m.s.r - r, 2), m);
					}
				}
			}
			let range = ranges.get(Math.min( ...(ranges.keys()) ));
			if (!range) {
				range = {
					s: { c, r },
					e: { c, r }
				};
			}
			return range;
		};

		for (let r = range.s.r; r <= range.e.r; r++) {
			let R = xlsl.utils.encode_row(r);
			let first = sheet[`${xlsl.utils.encode_col(range.s.c)}${R}`] as xlsl.CellObject;
			if (!first || first.t !== 's' || (first.v as string).trim() !== Keywords.FIELD) {
				continue;
			}
			const upperROW = xlsl.utils.encode_row(r-1);
			const upper_first = sheet[`${xlsl.utils.encode_col(range.s.c)}${upperROW}`] as xlsl.CellObject;
			const has_comment = upper_first && upper_first.t === 's' && (upper_first.v as string).trim() === Keywords.COMMENT;

			for (let c = range.s.c + 1; c <= range.e.c; c++) {
				const C = xlsl.utils.encode_col(c);
				const cell = sheet[`${C}${R}`] as xlsl.CellObject;
				if (cell && cell.t == 's' && (cell.v as string).trim().length) {
					let field = new Field();
					field.name = (cell.v as string).trim();
					if (has_comment) {
						let comment_cell = sheet[`${C}${upperROW}`] as xlsl.CellObject;
						if (comment_cell && comment_cell.t === 's') {
							field.comment = (comment_cell.v as string).trim();
						}
					}
					let range = get_cell_range(c, r);
					field.columns = { start: range.s.c, end: range.e.c };
					root.add_field(field);
				}
			}
		}
		return root;
	}

	protected process_table(root: Field, raw: RawTableData) {

		// 去除无用的列
		let rows: RawTableData = [];
		let data_start_at_row = -1;
		for (let i = 0; i < raw.length; i++) {
			const row = raw[i];
			if (this.is_data_row(row)) {
				rows.push(row);
				if (data_start_at_row < 0) data_start_at_row = i;
			}
		}

		for (let c = 0; c < rows[0].length; c++) {
			let field = root.get_atomic_field_at_column(c);
			if (!field) {
				continue;
			}
			const column_cells = this.get_column(rows, c);
			let type = DataType.null;
			for (let i = 0; i < column_cells.length; i++) {
				const cell = column_cells[i];
				var t = this.get_data_type(cell);
				if (Field.TYPE_ORDER.indexOf(t) < Field.TYPE_ORDER.indexOf(type)) {
					if (type != DataType.null) {
						console.log(colors.yellow(`\t\t${field.name}(${xlsl.utils.encode_col(c)}列) 的数据类型被提升为 ${t} 因为 ${this.format_cell_position(cell)} 的值为 ${cell.w}`));
					}
					type = t;
				}
			}
			field.type = type;
		}
		root.constant_array_length = this.configs.constant_array_length && this.configs.constant_array_length.includes(root.name);
		root.build();
		return {
			struct: root,
			data: rows.map(row => root.parse_row(row))
		};
	}

	protected is_data_row(row: RawTableCell[]) {
		let first = row[0];
		if (this.get_data_type(first) == DataType.string && SKIP_WORDS.includes((first.v as string).trim() as Keywords)) {
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

	protected get_column(table: RawTableData, column: number): RawTableCell[] {
		let cells: RawTableCell[] = [];
		for (let r = 0; r < table.length; r++) {
			const row = table[r];
			cells.push(row[column]);
		}
		return cells;
	}

	protected get_data_type(cell: RawTableCell): DataType {
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

	protected get_cell_value(cell: RawTableCell, type: DataType) {
		switch (type) {
			case DataType.bool:
				return cell && cell.v as boolean == true;
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

	protected dump_row_values(row: RawTableCell[]) {
		let ret = [];
		for (const cell of row) {
			ret.push(this.get_cell_value(cell, this.get_data_type(cell)));
		}
		return ret;
	}

	protected format_cell_position(cell: RawTableCell): string {
		return xlsl.utils.encode_cell({c: cell.column, r: cell.row});
	}
}