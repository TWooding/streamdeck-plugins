import streamDeck from "@elgato/streamdeck";

import { mqttService } from "./mqtt-client";
import { MqttPublishAction } from "./actions/mqtt-publish-action";

// We can enable "trace" logging so that all messages between the Stream Deck, and the plugin are recorded. When storing sensitive information
streamDeck.logger.setLevel("trace");

// Register the increment action and the MQTT publish action.
streamDeck.actions.registerAction(new MqttPublishAction());

// Export mqttService for actions/other modules to use.
export { mqttService };

// Finally, connect to the Stream Deck.
streamDeck.connect();
