export enum AccessType {
	ACCESS_RESOURCES,
	ACCESS_USERDATA,
	ACCESS_FILESYSTEM,
	ACCESS_MAX
};

export enum ModeFlags {
	READ = 1,
	WRITE = 2,
	READ_WRITE = 3,
	WRITE_READ = 7,
};

export class FileAccess {

	protected path: string;

	/** close a file */
	close(): void {};
	/** true when file is open */
	is_open(): boolean { return false; }

	/** returns the path for the current open file */
	get_path(): string { return ""; }
	/** returns the absolute path for the current open file */
	get_path_absolute(): string { return ""; }

	/** seek to a given position */
	seek(p_position: number) {}
	/** seek from the end of file */
	seek_end(p_position: number) {}

	/* get position in the file */
	get_position(): number { return -1; }
	/* get size of the file */
	get_len(): number { return -1; }

	/** reading passed EOF */
	eof_reached(): boolean { return false; }


	get_as_utf8_string(): string { return ""; }
	save_as_utf8_string(text: string) {}

	get_as_array(): Uint8Array { return null; }
	save_as_array(buffer: Uint8Array) {}

	store_string(text: string) {}

	static create(path: string): FileAccess {
		return null;
	}

	static open(path: string, mode_flags: ModeFlags): FileAccess {
		switch (get_runtime()) {
			case JavaScriptRuntime.NodeJS:
				return NodeJSFileAccess.open(path, mode_flags);
			default:
				return null;
		}
	}

	static exists(path: string): boolean {
		switch (get_runtime()) {
			case JavaScriptRuntime.NodeJS:
				return NodeJSFileAccess.exists(path);
			default:
				return false;
		}
	}
}

export class DirAccess {
	static exists(path: string): boolean {
		switch (get_runtime()) {
			case JavaScriptRuntime.NodeJS:
				return NodeJSFileAccess.exists(path);
			default:
				return false;
		}
	}

	static make_dir(p_dir: string, recursive: boolean = false) {
		switch (get_runtime()) {
			case JavaScriptRuntime.NodeJS:
				return NodeJSDirAccess.make_dir(p_dir, recursive);
			default:
				return false;
		}
	};
}

import * as fs from "fs";
import {O_RDONLY, O_WRONLY, O_RDWR, O_CREAT } from 'constants';
import { get_runtime, JavaScriptRuntime } from "./env";

class NodeJSFileAccess extends FileAccess {

	protected fd: number = -1;
	protected pos: number = 0;

	constructor(path, flags: number) {
		super();
		this.fd = fs.openSync(path, flags);
		this.path = path;
	}

	close(): void {
		fs.closeSync(this.fd);
	};

	static exists(path: string): boolean {
		return fs.existsSync(path);
	}

	static open(path: string, mode_flags: ModeFlags): NodeJSFileAccess {
		let flags = 0;
		switch (mode_flags) {
			case ModeFlags.READ:
				flags = O_RDONLY;
				break;
			case ModeFlags.WRITE:
				flags = O_CREAT | O_WRONLY;
				break;
			case ModeFlags.READ_WRITE:
				flags = O_CREAT | O_RDWR;
				break;
			case ModeFlags.WRITE_READ:
				flags = O_CREAT | O_RDWR;
				break;
			default:
				break;
		}
		return new NodeJSFileAccess(path, flags);
	}

	get_len(): number {
		return fs.statSync(this.path).size;
	}

	get_as_utf8_string(): string {
		return fs.readFileSync(this.path, {encoding: 'utf-8'});
	}

	save_as_utf8_string(text: string) {
		return fs.writeFileSync(this.path, text, {encoding: 'utf-8'});
	}

	get_as_array(): Uint8Array {
		let buff = fs.readFileSync(this.path);
		return buff;
	}

	save_as_array(buffer: Uint8Array) {
		fs.writeFileSync(this.path, buffer);
	}

}

export class NodeJSDirAccess extends DirAccess {
	static exists(path: string): boolean {
		return fs.statSync(path).isDirectory();
	}

	static make_dir(p_dir: string, recursive: boolean = false) {
		fs.mkdirSync(p_dir, {recursive: true});
	}
}