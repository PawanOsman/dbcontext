import fs from "fs";
import DbSet from "../classes/db-set.js";
import Options from "../models/options.js";
import Wait from "../utils/wait.js";

class DbContext {
	private options: Options;
	private path = "./db.json";
	private intervalId: NodeJS.Timeout;
	private loaded: boolean = false;

	constructor(path: string = "./db.json", options?: Options) {
		this.options = {
			saveInterval: options?.saveInterval || 1000 * 5,
		};
		this.path = path;
		this.load();
		this.intervalId = setInterval(() => {
			this.save();
		}, this.options.saveInterval);
	}

	public async WaitForLoad() {
		while (!this.loaded) {
			await Wait(100);
		}
	}

	private async load() {
		if (!fs.existsSync(this.path)) return;
		let data = await fs.promises.readFile(this.path, "utf8");
		let json = JSON.parse(data);

		for (let key in json) {
			this[key] = new DbSet(json[key].name, json[key].rows);
		}

		await Wait(1000);
		this.loaded = true;
	}

	public async save() {
		let result: any = {};
		for (let key in this) {
			if (this[key] instanceof DbSet) {
				result[key] = this[key];
			}
		}
		await fs.promises.writeFile(this.path, JSON.stringify(result, null, 4));
	}

	public async close() {
		clearInterval(this.intervalId);
		await this.save();
	}
}

export default DbContext;
