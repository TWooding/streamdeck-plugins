import { WallpaperEngine } from "../wallpaper_engine";
import streamDeck, { KeyDownEvent, SingletonAction, DidReceiveSettingsEvent, PropertyInspectorDidAppearEvent, SendToPluginEvent, action } from "@elgato/streamdeck";
import { exec, } from "child_process";

@action({ UUID: "com.twooding.github-streamdeck-wallpaper-engine-plugin.wallpaper-engine-set-wallpaper", })
export class SetWallpaperAction extends SingletonAction<WallpaperSetActionSettings> {

	wallpaper_engine: WallpaperEngine = new WallpaperEngine()

	async onSendToPlugin(ev: SendToPluginEvent<Object, WallpaperSetActionSettings>): Promise<void> {

		if (ev.payload) {
			const settings = ev.payload as WallpaperSetActionSettings
			ev.action.setSettings(settings ? settings : (await ev.action.getSettings()))
		}
	}

	async onPropertyInspectorDidAppear(ev: PropertyInspectorDidAppearEvent<WallpaperSetActionSettings>): Promise<void> {
		ev.action.sendToPropertyInspector((await ev.action.getSettings()))
	}


	async onDidReceiveSettings(ev: DidReceiveSettingsEvent<WallpaperSetActionSettings>): Promise<void> {
		const settings = ev.payload.settings
		settings.widget_type = settings.widget_type ? settings.widget_type : 'SetWallpaperAction'
		await this.wallpaper_engine.get_wallpapers().then(wallpapers => {
			settings.wallpapers = wallpapers

		})
		await this.wallpaper_engine.get_monitors().then(monitors => {
			settings.monitors = monitors

		})
		
		settings.selected_monitor = settings.selected_monitor ? settings.selected_monitor : settings.monitors[0]
		settings.selected_monitor_index = settings.selected_monitor_index ? settings.selected_monitor_index : settings.monitors.indexOf(settings.selected_monitor)
		settings.selected_wallpaper = settings.selected_wallpaper ? settings.selected_wallpaper : settings.wallpapers[0]

		ev.action.setSettings(settings)
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
 * Settings for {@link WallpaperSwitch}.
 */
type WallpaperSetActionSettings = {
	widget_type: string
	selected_wallpaper: string
	selected_monitor: string
	selected_monitor_index: number
	wallpapers: string[]
	monitors: Array<string>
};
