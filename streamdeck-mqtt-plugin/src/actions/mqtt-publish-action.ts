import streamDeck, { KeyDownEvent, SingletonAction, DidReceiveSettingsEvent, PropertyInspectorDidAppearEvent, SendToPluginEvent, WillAppearEvent, action } from "@elgato/streamdeck";
import { mqttService } from "../mqtt-client";

type MqttPublishSettings = {
    brokerUrl?: string;
    mqttVersion?: "3" | "3-legacy" | "5" | number;
    clientId?: string;
    username?: string;
    password?: string;
    reconnectPeriod?: number;
    topic?: string;
    payload?: string;
    qos?: number;
    retain?: boolean;
    autoConnect?: boolean;
};

function generateClientId(): string {
    return `sd-${Math.random().toString(16).slice(2, 10)}`;
}

@action({ UUID: "com.twooding.streamdeck-mqtt-plugin.mqttpublish" })
export class MqttPublishAction extends SingletonAction<MqttPublishSettings> {

    private async ensureClientId(action: any, settings: any) {
        if (!settings.clientId || (typeof settings.clientId === 'string' && settings.clientId.trim() === '')) {
            settings.clientId = generateClientId();
            try {
                await action.setSettings(settings);
            } catch (e) {
                // ignore setSettings errors
            }
            (streamDeck.ui as any).current?.sendToPropertyInspector(settings);
        }
        return settings;
    }

    override async onPropertyInspectorDidAppear(ev: PropertyInspectorDidAppearEvent<MqttPublishSettings>): Promise<void> {
        (streamDeck.ui as any).current?.sendToPropertyInspector(await ev.action.getSettings());
    }

    override async onSendToPlugin(ev: SendToPluginEvent<any, MqttPublishSettings>): Promise<void> {
        if (ev.payload) {
            // Get the current settings
            const current = await ev.action.getSettings();
            // Merge the incoming partial update with the current settings
            const settings = { ...current, ...ev.payload };

            settings.qos ??= 0;
            settings.reconnectPeriod ??= 0;

            try {
                await ev.action.setSettings(settings);
            } catch (e) {
                // ignore setSettings errors
            }

            (streamDeck.ui as any).current?.sendToPropertyInspector(settings);
        }
    }

    override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<MqttPublishSettings>): Promise<void> {
        const settings = ev.payload.settings ?? {};
        settings.qos ??= 0;
        settings.reconnectPeriod ??= 0;

        streamDeck.logger.debug("MQTT didReceiveSettings", settings);

        // Ensure a clientId exists (generate & persist when empty)
        await this.ensureClientId(ev.action, settings);


        if (settings.autoConnect && settings.brokerUrl) {
            try {
                await mqttService.connect({
                    url: settings.brokerUrl,
                    mqttVersion: settings.mqttVersion ?? "3",
                    clientId: settings.clientId,
                    username: settings.username,
                    password: settings.password,
                    reconnectPeriod: settings.reconnectPeriod ?? 0,
                });
            } catch (err) {
                await ev.action.showAlert();
            }
        } else if (!settings.autoConnect && mqttService.getConnectedUrl && mqttService.getConnectedUrl() === settings.brokerUrl) {
            try {
                await mqttService.end();
            } catch (e) {
                // ignore
            }
        }
    }

    override async onWillAppear(ev: WillAppearEvent<MqttPublishSettings>): Promise<void> {
        const settings = ev.payload.settings ?? {};

        if (settings?.autoConnect && settings.brokerUrl && !mqttService.isConnected()) {
            try {
                await this.ensureClientId(ev.action, settings);
                await mqttService.connect({
                    url: settings.brokerUrl,
                    mqttVersion: settings.mqttVersion ?? "3",
                    clientId: settings.clientId,
                    username: settings.username,
                    password: settings.password,
                    reconnectPeriod: settings.reconnectPeriod ?? 0,
                });
            } catch (err) {
                await ev.action.showAlert();
            }
        }
    }

    override async onKeyDown(ev: KeyDownEvent<MqttPublishSettings>): Promise<void> {
        const settings = ev.payload.settings ?? {};
        const brokerUrl = settings.brokerUrl;
        const topic = settings.topic;
        const payload = settings.payload ?? "";


        if (!brokerUrl || !topic) {
            streamDeck.logger.debug("MQTT Publish missing brokerUrl or topic", { brokerUrl, topic });
            await ev.action.showAlert();
            return;
        }


        try {
            if (!mqttService.isConnected()) {
                await this.ensureClientId(ev.action, settings);

                await mqttService.connect({
                    url: brokerUrl,
                    mqttVersion: settings.mqttVersion ?? "3",
                    clientId: settings.clientId,
                    username: settings.username,
                    password: settings.password,
                    reconnectPeriod: settings.reconnectPeriod ?? 0,
                });
                streamDeck.logger.debug("MQTT connected", { brokerUrl });
            }

            await mqttService.publish(topic, String(payload), { qos: Number(settings.qos ?? 0), retain: !!settings.retain, publishTimeout: 5000 });
            await ev.action.showOk();
        } catch (err) {
            streamDeck.logger.error("MQTT Publish failed", err);
            await ev.action.showAlert();
        }
    }
}
