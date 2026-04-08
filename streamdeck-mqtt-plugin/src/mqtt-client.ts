import mqtt, { MqttClient } from "mqtt";

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

export class MqttService {
    private client: MqttClient | null = null;
    private connectedUrl: string | null = null;

    async connect(opts: MqttConnectOptions): Promise<any> {
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

        return new Promise((resolve, reject) => {
            if (!this.client) return reject(new Error("mqtt.connect failed"));

            const timeoutMs = opts.connectTimeout ?? 5000;
            const timeout = setTimeout(() => {
                cleanup();
                this.client?.end(true, {}, () => {
                    this.connectedUrl = null;
                });
                reject(new Error(`MQTT connect timed out after ${timeoutMs}ms`));
            }, timeoutMs);

            const onConnect = (connack: any) => {
                clearTimeout(timeout);
                // track which URL we're connected to and clear on close/end
                this.connectedUrl = url;
                this.client?.on("close", () => { this.connectedUrl = null; });
                this.client?.on("end", () => { this.connectedUrl = null; });
                cleanup();
                resolve(connack);
            };

            const onError = (err: Error) => {
                clearTimeout(timeout);
                cleanup();
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

    on(event: string, handler: (...args: any[]) => void): void {
        this.client?.on(event as any, handler as any);
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
