import { WallpaperEngine } from "../wallpaper_engine";
import streamDeck, { KeyDownEvent, SingletonAction, DidReceiveSettingsEvent, PropertyInspectorDidAppearEvent, SendToPluginEvent, action, JsonObject } from "@elgato/streamdeck";
import { exec } from "child_process";
import { existsSync, readFileSync } from "fs";
import { join } from "path";

@action({ UUID: "com.twooding.github-streamdeck-wallpaper-engine-plugin.wallpaper-engine-set-wallpaper" })
export class SetWallpaperAction extends SingletonAction<WallpaperSetActionSettings> {

	wallpaper_engine: WallpaperEngine = new WallpaperEngine()


	async onSendToPlugin(ev: SendToPluginEvent<JsonObject, WallpaperSetActionSettings>): Promise<void> {

		if (ev.payload) {
			const settings = ev.payload as WallpaperSetActionSettings
			ev.action.setSettings(settings ? settings : (await ev.action.getSettings()))
		}
	}

async onPropertyInspectorDidAppear(ev: PropertyInspectorDidAppearEvent<WallpaperSetActionSettings>): Promise<void> {
	streamDeck.ui.current?.sendToPropertyInspector(await ev.action.getSettings());
}

async onDidReceiveSettings(ev: DidReceiveSettingsEvent<WallpaperSetActionSettings>): Promise<void> {
	const settings = ev.payload.settings;
	settings.widget_type = settings.widget_type ? settings.widget_type : 'SetWallpaperAction';

	// Get wallpapers as paths
	const wallpaperPaths = await this.wallpaper_engine.get_wallpapers();
	// Map to array of { name, path }
	const wallpapers = wallpaperPaths.map(path => ({
		name: this.extractNameFromPath(path),
		path
	}));
	settings.wallpapers = wallpapers;

	// Get monitors
	settings.monitors = await this.wallpaper_engine.get_monitors();

	// Set defaults if not set
	settings.selected_monitor = settings.selected_monitor ? settings.selected_monitor : settings.monitors[0];
	settings.selected_monitor_index = settings.selected_monitor_index ? settings.selected_monitor_index : settings.monitors.indexOf(settings.selected_monitor);
	settings.selected_wallpaper = settings.selected_wallpaper ? settings.selected_wallpaper : (wallpapers[0]?.path || "");

	ev.action.setSettings(settings);
}

// Helper to extract wallpaper name from path
private extractNameFromPath(path: string): string {
    try {
        // Try to read the title from project.json
        const projectJsonPath = join(path, 'project.json');
        if (existsSync(projectJsonPath)) {
            const projectData = JSON.parse(readFileSync(projectJsonPath, 'utf8'));
            if (projectData.title) {
                return projectData.title;
            }
        }
    } catch (error: any) {
        // Type assertion to any to access error.message
        streamDeck.logger.warn(`Could not read project.json for ${path}: ${error.message || 'Unknown error'}`);
    }
    
    // Fallback: Get the name from the directory path
    const parts = path.replace(/[\\/]+$/, '').split(/[\\/]/);
    return parts[parts.length - 1];
}

	async onKeyDown(ev: KeyDownEvent<WallpaperSetActionSettings>): Promise<void> {
		this.wallpaper_engine.get_process()
			.then(result => {
				exec(`"${result}" -control openWallpaper -monitor ${ev.payload.settings.selected_monitor} -file "${ev.payload.settings.selected_wallpaper}/project.json"`, (error, stdout, stderr) => {
					if (error) {
						streamDeck.logger.error(error.message);
						ev.action.showAlert();
					} else {
						ev.action.showOk();
					}
				});
			}, error => {
				streamDeck.logger.error(error.message);
				ev.action.showAlert();
			});

	}
}

/**
 * Settings for {@link WallpaperSetAction}.
 */
type WallpaperSetActionSettings = {
	widget_type: string;
	selected_wallpaper: string;
	selected_monitor: string;
	selected_monitor_index: number;
	wallpapers: Array<{ name: string; path: string }>;
	monitors: Array<string>;
};
