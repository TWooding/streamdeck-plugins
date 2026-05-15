import mqtt, { MqttClient } from "mqtt";
import { EventEmitter } from "events";

export type MqttConnectOptions = {
    url: string;
    mqttVersion?: "3" | "3-legacy" | "5" | number;
    clientId?: string;
    username?: string;
    password?: string;
    reconnectPeriod?: number;
    connectTimeout?: number;
    [k: string]: any;
};

export class MqttService extends EventEmitter {
    private client: MqttClient | null = null;
    private connectedUrl: string | null = null;
    private messageCache: Map<string, Buffer> = new Map();
    private connectPromise: Promise<any> | null = null;

    getCachedMessage(topic: string): Buffer | undefined {
        return this.messageCache.get(topic);
    }

    async connect(opts: MqttConnectOptions): Promise<any> {
        // If already connected, do not reconnect.
        if (this.client && this.client.connected) {
            return Promise.resolve();
        }

        // If a connection is currently being established, wait for it instead of spanning multiple clients
        if (this.connectPromise) {
            return this.connectPromise;
        }

        const { url, mqttVersion, clientId, username, password, reconnectPeriod, ...rest } = opts;

        const connectOptions: any = {
            clientId,
            username,
            password,
            reconnectPeriod: reconnectPeriod ?? 1000,
            connectTimeout: opts.connectTimeout ?? 5000,
            ...rest,
        };

        if (typeof mqttVersion === "number") {
            connectOptions.protocolVersion = mqttVersion;
        } else {
            switch (mqttVersion) {
                case "3-legacy":
                    connectOptions.protocolVersion = 3;
                    connectOptions.protocolId = "MQIsdp";
                    break;
                case "3":
                    connectOptions.protocolVersion = 4; // MQTT 3.1.1
                    break;
                case "5":
                    connectOptions.protocolVersion = 5;
                    break;
                default:
                    connectOptions.protocolVersion = 4;
            }
        }

        this.client = mqtt.connect(url, connectOptions);

        this.client.on("message", (topic, message, packet) => {
            this.messageCache.set(topic, message);
            this.emit("message", topic, message, packet);
        });

        this.connectPromise = new Promise((resolve, reject) => {
            if (!this.client) {
                this.connectPromise = null;
                return reject(new Error("mqtt.connect failed"));
            }

            const timeoutMs = opts.connectTimeout ?? 5000;
            const timeout = setTimeout(() => {
                cleanup();
                this.connectPromise = null;
                this.client?.end(true, {}, () => {
                    this.connectedUrl = null;
                });
                reject(new Error(`MQTT connect timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            const onConnect = (connack: any) => {
                clearTimeout(timeout);
                // track which URL we're connected to and clear on close/end
                this.connectedUrl = url;
                this.client?.on("close", () => { this.connectedUrl = null; this.connectPromise = null; });
                this.client?.on("end", () => { this.connectedUrl = null; this.connectPromise = null; });
                cleanup();
                this.connectPromise = null;
                resolve(connack);
            };

            const onError = (err: Error) => {
                clearTimeout(timeout);
                cleanup();
                this.connectPromise = null;
                reject(err);
            };

            const cleanup = () => {
                clearTimeout(timeout);
                this.client?.off("connect", onConnect as any);
                this.client?.off("error", onError as any);
            };

            this.client.on("connect", onConnect as any);
            this.client.on("error", onError as any);
        });

        return this.connectPromise;
    }

    isConnected(): boolean {
        return !!this.client && this.client.connected === true;
    }

    getConnectedUrl(): string | null {
        return this.connectedUrl;
    }

    publish(topic: string, message: string | Buffer, options?: any): Promise<void> {
        if (!this.client) return Promise.reject(new Error("MQTT client not connected"));
        return new Promise((resolve, reject) => {
            const timeoutMs = options?.publishTimeout ?? 5000;
            const timeout = setTimeout(() => {
                reject(new Error(`MQTT publish timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            this.client!.publish(topic, message, options || {}, (err) => {
                clearTimeout(timeout);
                err ? reject(err) : resolve();
            });
        });
    }

    subscribe(topic: string | string[], options?: any): Promise<any> {
        if (!this.client) return Promise.reject(new Error("MQTT client not connected"));
        return new Promise((resolve, reject) => {
            this.client!.subscribe(topic as any, options || {}, (err, granted) => (err ? reject(err) : resolve(granted)));
        });
    }

    async end(force?: boolean): Promise<void> {
        if (!this.client) return;
        return new Promise((resolve) => {
            this.client!.end(force, {}, () => {
                this.connectedUrl = null;
                resolve();
            });
        });
    }
}

export const mqttService = new MqttService();
