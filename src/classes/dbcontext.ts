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
			inMemory: options?.inMemory || false,
		};
		this.path = path;
		if (this.options.inMemory) this.loaded = true;
		else {
			this.load();
			let saving = false;
			this.intervalId = setInterval(async () => {
				if (!this.loaded) return;
				if (saving) return;
				saving = true;
				await Wait(100);
				await this.save();
				saving = false;
			}, this.options.saveInterval);
		}
	}

	public async WaitForLoad() {
		while (!this.loaded) {
			await Wait(100);
		}
	}

	private getTmpPath(path: string): string {
		if (path.indexOf(".") === -1) {
			return `${path}.tmp`;
		}

		const pathParts = path.split(".");
		const extension = pathParts.pop();
		const newPath = `${pathParts.join(".")}.tmp.${extension}`;
		return newPath;
	}

	private isJSON(str: string): boolean {
		try {
			JSON.parse(str);
		} catch (e) {
			return false;
		}
		return true;
	}

	private async load() {
		if (this.options.inMemory) return;
		try {
			let tmpFilePath = this.getTmpPath(this.path);
			if (fs.existsSync(tmpFilePath)) {
				let tmpFileData = await fs.promises.readFile(tmpFilePath, "utf8");
				if (this.isJSON(tmpFileData)) {
					await fs.promises.rename(tmpFilePath, this.path);
					console.log("Recovered from a crash.");
				}
			}
			if (!fs.existsSync(this.path)) {
				this.loaded = true;
				return;
			}
			let data = await fs.promises.readFile(this.path, "utf8");
			if (!this.isJSON(data)) {
				this.loaded = true;
				return;
			}
			let json = JSON.parse(data);

			for (let key in json) {
				if (json[key].rows) {
					this[key] = new DbSet(json[key].name, json[key].rows);
				} else {
					this[key] = json[key];
				}
			}
		} catch (e: any) {
			console.log(`Failed to load db from ${this.path}. make sure you have read access to ${this.path}. Error: ${e.message}`);
		}

		await Wait(1000);
		this.loaded = true;
	}

	public async save() {
		if (this.options.inMemory) return;
		let tmpFilePath = this.getTmpPath(this.path);
		let result: any = {};
		for (let key in this) {
			if (key === "options") continue;
			if (key === "path") continue;
			if (key === "intervalId") continue;
			if (key === "loaded") continue;

			if (this[key] instanceof DbSet || this[key] instanceof Object || typeof this[key] === "string" || typeof this[key] === "number" || typeof this[key] === "boolean") {
				result[key] = this[key];
			}
		}
		try {
			await fs.promises.writeFile(tmpFilePath, JSON.stringify(result, null, 4));
			if (fs.existsSync(tmpFilePath)) {
				let tmpFileData = await fs.promises.readFile(tmpFilePath, "utf8");
				if (this.isJSON(tmpFileData)) {
					await fs.promises.rename(tmpFilePath, this.path);
				}
			} else {
				console.log(`Failed to save db to ${this.path}. make sure you have write access to ${this.path}.`);
			}
		} catch (e: any) {
			console.log(`Failed to save db to ${this.path}. make sure you have write access to ${this.path}. Error: ${e.message}}`);
		}
	}

	public async close() {
		clearInterval(this.intervalId);
		await this.save();
	}
}

export default DbContext;
