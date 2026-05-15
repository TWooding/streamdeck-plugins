import streamDeck, { KeyDownEvent, KeyUpEvent, SingletonAction, DidReceiveSettingsEvent, PropertyInspectorDidAppearEvent, SendToPluginEvent, WillAppearEvent, WillDisappearEvent, action } from "@elgato/streamdeck";
import { mqttService } from "../mqtt-client";

type MqttToggleSettings = {
    brokerUrl?: string;
    mqttVersion?: "3" | "3-legacy" | "5" | number;
    clientId?: string;
    username?: string;
    password?: string;
    reconnectPeriod?: number;
    topic?: string;
    subscribeTopic?: string;
    commandOn?: string;
    commandOff?: string;
    matchPatternOn?: string;
    matchPatternOff?: string;
    qos?: number;
    autoConnect?: boolean;
};

function generateClientId(): string {
    return `sd-${Math.random().toString(16).slice(2, 10)}`;
}

@action({ UUID: "com.twooding.streamdeck-mqtt-plugin.mqtttoggle" })
export class MqttToggleAction extends SingletonAction<MqttToggleSettings> {
    private activeInstances = new Map<string, { action: any; settings: MqttToggleSettings }>();

    constructor() {
        super();
        this.setupMqttListener();
    }

    private setupMqttListener() {
        // Listen to MQTT messages to update button states
        mqttService.on("message", async (topic: string, message: Buffer) => {
            await this.updateStatesForTopic(topic, message);
        });
    }

    private async updateStatesForTopic(topic: string, message: Buffer) {
        const msgStr = message.toString();

        for (const [id, instanceData] of this.activeInstances.entries()) {
            const settings = instanceData.settings;
            const actionInstance = instanceData.action;
            const subTopic = settings.subscribeTopic || settings.topic;
            
            if (subTopic === topic) {
                let newState: 0 | 1 | null = null;

                streamDeck.logger.debug(`Matching patterns against Topic: ${topic} / ID: ${id}`);
                streamDeck.logger.debug(`On Pattern: ${settings.matchPatternOn} | Off Pattern: ${settings.matchPatternOff}`);

                try {
                    if (settings.matchPatternOn && new RegExp(settings.matchPatternOn).test(msgStr)) {
                        newState = 1;
                    } else if (settings.matchPatternOff && new RegExp(settings.matchPatternOff).test(msgStr)) {
                        newState = 0;
                    }
                } catch (e) {
                    streamDeck.logger.error("Regex matching error", e);
                }

                if (newState !== null) {
                    try {
                        // Action state update
                        await actionInstance.setState(newState);
                    } catch (e) {
                        streamDeck.logger.error(`Failed to set state for ${id}`, e);
                    }
                }
            }
        }
    }

    private async ensureClientId(actionInstance: any, settings: any) {
        if (!settings.clientId || (typeof settings.clientId === 'string' && settings.clientId.trim() === '')) {
            settings.clientId = generateClientId();
            try {
                await actionInstance.setSettings(settings);
            } catch (e) {
                // ignore
            }
            (streamDeck.ui as any).current?.sendToPropertyInspector(settings);
        }
        return settings;
    }

    override async onPropertyInspectorDidAppear(ev: PropertyInspectorDidAppearEvent<MqttToggleSettings>): Promise<void> {
        (streamDeck.ui as any).current?.sendToPropertyInspector(await ev.action.getSettings());
    }

    override async onSendToPlugin(ev: SendToPluginEvent<any, MqttToggleSettings>): Promise<void> {
        if (ev.payload) {
            const current = await ev.action.getSettings();
            const settings = { ...current, ...ev.payload };
            settings.qos ??= 0;
            settings.reconnectPeriod ??= 0;

            try {
                await ev.action.setSettings(settings);
            } catch (e) {}

            const instance = this.activeInstances.get(ev.action.id);
            if (instance) {
                instance.settings = settings;
            }

            (streamDeck.ui as any).current?.sendToPropertyInspector(settings);
        }
    }

    override async onDidReceiveSettings(ev: DidReceiveSettingsEvent<MqttToggleSettings>): Promise<void> {
        const settings = ev.payload.settings ?? {};
        settings.qos ??= 0;
        settings.reconnectPeriod ??= 0;

        await this.ensureClientId(ev.action, settings);

        const instance = this.activeInstances.get(ev.action.id);
        if (instance) {
            instance.settings = settings;
        }

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

                const subTopic = settings.subscribeTopic || settings.topic;
                if (subTopic) {
                    await mqttService.subscribe(subTopic);
                }
            } catch (err) {
                await ev.action.showAlert();
            }
        } else if (!settings.autoConnect && mqttService.getConnectedUrl && mqttService.getConnectedUrl() === settings.brokerUrl) {
            try {
                await mqttService.end();
            } catch (e) {}
        }
    }

    override async onWillAppear(ev: WillAppearEvent<MqttToggleSettings>): Promise<void> {
        const settings = ev.payload.settings ?? {};
        this.activeInstances.set(ev.action.id, { action: ev.action, settings });
        
        if (settings?.autoConnect && settings.brokerUrl) {
            try {
                if (!mqttService.isConnected()) {
                    await this.ensureClientId(ev.action, settings);
                    await mqttService.connect({
                        url: settings.brokerUrl,
                        mqttVersion: settings.mqttVersion ?? "3",
                        clientId: settings.clientId,
                        username: settings.username,
                        password: settings.password,
                        reconnectPeriod: settings.reconnectPeriod ?? 0,
                    });
                }
                const subTopic = settings.subscribeTopic || settings.topic;
                if (subTopic) {
                    await mqttService.subscribe(subTopic);

                    // Grab retained cache immediately in case it was missed during fast boot sequences spanning multiple configs
                    const cachedMsg = mqttService.getCachedMessage(subTopic);
                    if (cachedMsg) {
                        streamDeck.logger.debug(`Applying cached message for topic: ${subTopic}`);
                        await this.updateStatesForTopic(subTopic, cachedMsg);
                    }
                }
            } catch (err) {
                await ev.action.showAlert();
            }
        }
    }

    override async onWillDisappear(ev: WillDisappearEvent<MqttToggleSettings>): Promise<void> {
        this.activeInstances.delete(ev.action.id);
    }

    override async onKeyDown(ev: KeyDownEvent<MqttToggleSettings>): Promise<void> {
        // ALWAYS pull settings from activeInstances so we have the absolute latest configured in UI
        const instance = this.activeInstances.get(ev.action.id);
        const settings = instance ? instance.settings : ev.payload.settings ?? {};
        
        const brokerUrl = settings.brokerUrl;
        const topic = settings.topic;
        
        // In onKeyDown, ev.payload.state is the CURRENT state of the action.
        const currentState = ev.payload.state ?? 0; 
        
        // If it is currently 0 (Off), we want to turn it On (send commandOn).
        // If it is currently 1 (On), we want to turn it Off (send commandOff).
        const payload = currentState === 0 ? (settings.commandOn ?? "") : (settings.commandOff ?? "");

        streamDeck.logger.info(`Sending MQTT Command to ${topic}: ${payload} (Current State: ${currentState})`);

        if (!brokerUrl || !topic) {
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
            }

            await mqttService.publish(topic, String(payload), { qos: Number(settings.qos ?? 0), retain: true, publishTimeout: 5000 });
            await ev.action.showOk();
        } catch (err) {
            streamDeck.logger.error("MQTT Publish failed", err);
            await ev.action.showAlert();
        }
    }

    override async onKeyUp(ev: KeyUpEvent<MqttToggleSettings>): Promise<void> {
        // Ensure state is extracted. In onKeyUp for a multi-state action, ev.payload.state is the NEW (optimistic) state.
        const toggledState = ev.payload.state ?? 0; 
        const previousState = toggledState === 1 ? 0 : 1;
        
        // Revert the action state immediately so it only changes when the actual MQTT message is received
        // and matches the configured on/off patterns.
        try {
            await ev.action.setState(previousState);
        } catch (e) {
            // ignore
        }
    }
}