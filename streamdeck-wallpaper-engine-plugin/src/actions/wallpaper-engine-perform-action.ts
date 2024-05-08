import { WallpaperEngine } from "../wallpaper_engine";
import streamDeck, { KeyDownEvent, SingletonAction, DidReceiveSettingsEvent, PropertyInspectorDidAppearEvent, JsonValue, SendToPluginEvent, action } from "@elgato/streamdeck";
import { exec, } from "child_process";

@action({ UUID: "com.twooding.github-streamdeck-wallpaper-engine-plugin.wallpaper-engine-perform-action", })
export class WallpaperAction extends SingletonAction<WallpaperActionSettings> {

	wallpaper_engine: WallpaperEngine = new WallpaperEngine()

	async onSendToPlugin(ev: SendToPluginEvent<JsonValue, WallpaperActionSettings>): Promise<void> {

		if (ev.payload) {
			const settings = ev.payload as WallpaperActionSettings
			ev.action.setSettings(settings ? settings : (await ev.action.getSettings()))
		}
	}

	async onPropertyInspectorDidAppear(ev: PropertyInspectorDidAppearEvent<WallpaperActionSettings>): Promise<void> {
		ev.action.sendToPropertyInspector((await ev.action.getSettings()))
	}


	async onDidReceiveSettings(ev: DidReceiveSettingsEvent<WallpaperActionSettings>): Promise<void> {
		const settings = ev.payload.settings
		settings.widget_type = settings.widget_type ? settings.widget_type : 'PerformAction'
		settings.action = settings.action ? settings.action : 'play'
		ev.action.setSettings(settings)
	}

	async onKeyDown(ev: KeyDownEvent<WallpaperActionSettings>): Promise<void> {
		this.wallpaper_engine.get_process()
			.then(result => {
				exec(`"${result}" -control ${ev.payload.settings.action}`, (error, stdout, stderr) => {
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
			})
	}
}

/**
 * Settings for {@link WallpaperSwitch}.
 */
type WallpaperActionSettings = {
	widget_type: string
	action: string
};
