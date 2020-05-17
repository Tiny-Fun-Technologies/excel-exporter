import { get_startup_arguments } from "./tiny/env";
(async function main(argv: string[]) {
	console.log(argv);
})(get_startup_arguments());
