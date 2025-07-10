import { exec } from 'child_process';
import { readdirSync, existsSync } from 'fs';
import { getSteamMainLocation } from 'getsteamfolders';
import { join } from 'path';
export class WallpaperEngine {

	constructor() {
	}

	// Returns a list of connected monitors
	public async get_monitors(): Promise<Array<string>> {
		let command;

		if (process.platform === 'win32') {
			// Windows command to list display devices with more detailed info
			command = 'powershell -command "Get-CimInstance -Namespace root\\wmi -ClassName WmiMonitorBasicDisplayParams | Select-Object -Property InstanceName"';
		} else {
			// Wallpaper engine does not support other platforms.
			command = '';
		}

		return new Promise<Array<string>>((resolve, reject) => {
			exec(command, (error, stdout, stderr) => {
				if (error) {
					// Try fallback method if PowerShell command fails
					this.getMonitorsFallback().then(resolve).catch(reject);
				} else {
					try {
						// Process the stdout to find monitor IDs
						let lines = stdout.split('\n')
							.filter(line => line.trim() !== "" && !line.includes("----") && !line.includes("InstanceName"));
						
						// If we have monitor IDs, format them for display
						if (lines.length > 0) {
							const monitorList = lines.map((line, index) => {
								return `Monitor ${index}`;
							});
							resolve(monitorList);
						} else {
							// Try fallback if no monitors found
							this.getMonitorsFallback().then(resolve).catch(reject);
						}
					} catch (e) {
						// Try fallback if parsing fails
						this.getMonitorsFallback().then(resolve).catch(reject);
					}
				}
			});
		});
	}
	
	// Fallback method to get monitors using simpler commands
	private async getMonitorsFallback(): Promise<Array<string>> {
		return new Promise<Array<string>>((resolve, reject) => {
			// Try a different command to at least get display count
			const command = process.platform === 'win32' 
				? 'wmic path Win32_VideoController get CurrentHorizontalResolution, CurrentVerticalResolution'
				: '';
				
			exec(command, (error, stdout, stderr) => {
				if (error) {
					reject(new Error("Error detecting monitors: " + error.message));
				} else {
					try {
						// Count non-empty, non-header lines that have resolution data
						const lines = stdout.split('\n')
							.filter(line => line.trim() !== "" && 
									!line.includes("CurrentHorizontal") && 
									/\d+\s+\d+/.test(line));
						
						// Create numbered list of monitors
						if (lines.length > 0) {
							const monitorList = Array.from({ length: lines.length }, (_, i) => `Monitor ${i + 1}`);
							resolve(monitorList);
						} else {
							// Last resort - assume at least one monitor (the one running the app)
							resolve(['Monitor 0']);
						}
					} catch (e) {
						// Last resort - assume at least one monitor
						resolve(['Monitor 0']);
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

					// Filter to only include valid paths
					const validPaths = paths.filter(p => existsSync(p));

					// Parse Wallpapers from valid paths only
					validPaths.forEach(p => {
						const files = readdirSync(p);
						files.forEach(file => {
							wallpapers.push(join(p, file));
						});
					});
					
					resolve(wallpapers);
				} else {
					resolve([]); // Return empty array if Steam location not found
				}
			}).catch(error => {
				console.error("Error finding Steam location:", error);
				resolve([]); // Return empty array on error
			});
		});
	}
}
