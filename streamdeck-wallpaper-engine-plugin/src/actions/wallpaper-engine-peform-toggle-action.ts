import { WallpaperEngine } from "../wallpaper_engine";
import streamDeck, { KeyDownEvent, SingletonAction, DidReceiveSettingsEvent, PropertyInspectorDidAppearEvent,SendToPluginEvent, action, JsonObject } from "@elgato/streamdeck";
import { exec, } from "child_process";

@action({ UUID: "com.twooding.github-streamdeck-wallpaper-engine-plugin.wallpaper-engine-perform-toggle-action", })
export class WallpaperToggleAction extends SingletonAction<WallpaperToggleActionSettings> {

	wallpaper_engine: WallpaperEngine = new WallpaperEngine()
	async onSendToPlugin(ev: SendToPluginEvent<JsonObject, WallpaperToggleActionSettings>): Promise<void> {

		if (ev.payload) {
			const settings = ev.payload as WallpaperToggleActionSettings
			ev.action.setSettings(settings ? settings : (await ev.action.getSettings()))
		}
	}

	async onPropertyInspectorDidAppear(ev: PropertyInspectorDidAppearEvent<WallpaperToggleActionSettings>): Promise<void> {
		streamDeck.ui.current?.sendToPropertyInspector(await ev.action.getSettings())
	}

	async onDidReceiveSettings(ev: DidReceiveSettingsEvent<WallpaperToggleActionSettings>): Promise<void> {
		const settings = ev.payload.settings
		settings.widget_type = settings.widget_type ? settings.widget_type : 'PerformToggleAction'
		settings.action = settings.action ? settings.action : 'muteUnmute'
		ev.action.setSettings(settings)
	}

	async onKeyDown(ev: KeyDownEvent<WallpaperToggleActionSettings>): Promise<void> {
		let action = ''
		this.wallpaper_engine.get_process()
			.then(result => {

				switch (ev.payload.settings.action) {
					case 'muteUnmute':
						if (ev.payload.state == 0) {
							action = 'mute'
						} else {
							action = 'unmute'
						}
						break;
					case 'playStop':
						if (ev.payload.state == 0) {
							action = 'stop'
						} else {
							action = 'play'
						}
					default:
						break;
				}

				exec(`"${result}" -control ${action}`, (error, stdout, stderr) => {
					if (error) {
						ev.action.setState(0)
						streamDeck.logger.error(error.message);
					}

				});
			}, error => {
				ev.action.setState(0)
				streamDeck.logger.error(error.message);
			})

	}

}

/**
 * Settings for {@link WallpaperSwitch}.
 */
type WallpaperToggleActionSettings = {
	widget_type: string
	action: string
};
