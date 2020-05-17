/**
 * JavaScript 运行环境
 */
export enum JavaScriptRuntime {
	/** 未知 */
	Unknown,
	/** NodeJS 运行时 */
	NodeJS,
	/** 浏览器 */
	Browser,
}

/**
 * 获取当前的运行环境
 */
export function get_runtime(): JavaScriptRuntime {
	if (typeof window == 'object' && typeof document == 'object') {
		return JavaScriptRuntime.Browser;
	} else if (typeof process == 'object' && process.release.name == 'node') {
		return JavaScriptRuntime.NodeJS;
	}
	return JavaScriptRuntime.Unknown;
}

/**
 * 获取启动参数
 */
export function get_startup_arguments(): string[] {
	switch (get_runtime()) {
		case JavaScriptRuntime.NodeJS:
			return process.argv;
		default:
			return [];
	}
}

