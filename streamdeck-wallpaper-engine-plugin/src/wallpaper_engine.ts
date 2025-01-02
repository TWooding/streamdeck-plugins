import { exec } from 'child_process';
import {  readdirSync } from 'fs';
import { getSteamMainLocation } from 'getsteamfolders';
import {  join } from 'path';
export class WallpaperEngine {

	constructor() {
	}

	// Returns a list of connected monitors
	public async get_monitors(): Promise<Array<string>> {
		let command;

		if (process.platform === 'win32') {
			// Windows command to list monitors
			command = 'wmic desktopmonitor get Name';
		} else {
			// Wallpaper engine does not support other platforms.
			command = '';
		}

		return new Promise<Array<string>>((resolve, reject) => {
			exec(command, (error, stdout, stderr) => {
				if (error) {
					// If there's an error executing the command, reject the Promise with a specific error message
					reject(new Error("Error executing command: " + error.message));
				} else {

					// Process the stdout to find the executable path
					let output = stdout.split('\n')
					output = output.filter(line => line.trim() !== "")

					// Remove `Name` field from results
					if (process.platform === 'win32') {
						output.shift()
					}
					if (output.length > 0) {
						resolve(output)
					} else {
						reject(new Error("Cannot detect connected monitors"));

					}


				}
			});
		});

	}

	public async get_process(): Promise<string> {
		let command;

		if (process.platform === 'win32') {
			// Windows command to list processes
			command = 'tasklist /fi "IMAGENAME eq wallpaper*" /NH | findstr /R /C:\"^[^ ]*\"';
		} else {
			// Wallpaper engine does not support other platforms.
			command = '';
		}

		return new Promise<string>((resolve, reject) => {

			exec(command, (error, stdout, stderr) => {
				let result;

				if (error) {
					// If there's an error executing the command, reject the Promise with a specific error message
					reject(new Error("Error executing command: " + error.message));
				} else {
					// Process the stdout to find the executable path
					let output = stdout.toLowerCase().split(' ')[0].trim();

					if (!output.includes('wallpaper')) {
						output = ''
					}
					// If the output is valid, resolve the Promise with the executable path
					getSteamMainLocation().then((loc) => {
						if (output.length > 1) {
							if (loc) {
								result = join(`${loc}/steamapps/common/wallpaper_engine`, output);
								resolve(result)
							} else {
								reject(new Error("Cannot find wallpaper engine executable"));

							}
						} else {
							reject(new Error("Cannot find wallpaper engine executable"));
						}
					})

				}
			});

		});
	}

	public async get_wallpapers(): Promise<string[]> {

		return new Promise<string[]>((resolve, reject) => {
			let paths: string[];
			let wallpapers: string[] = [];

			getSteamMainLocation().then((loc) => {
				if (loc) {
					// Wallpaper Paths
					paths = [`${loc}/steamapps/common/wallpaper_engine/projects/defaultprojects`, `${loc}/steamapps/common/wallpaper_engine/projects/myprojects`, `${loc}/steamapps/workshop/content/431960`]

					// Parse Wallpapers
					paths.forEach(p => {
						const files = readdirSync(p)
						files.forEach(file => {
							wallpapers.push(join(p, file))

						});
					});
				}
			})
			resolve(wallpapers)
		})

	}
}
