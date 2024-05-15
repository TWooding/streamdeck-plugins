import streamDeck, {LogLevel} from "@elgato/streamdeck";

import { WallpaperAction } from "./actions/wallpaper-engine-perform-action";
import {SetWallpaperAction } from "./actions/wallpaper-engine-set-wallpaper";
import { WallpaperToggleAction } from "./actions/wallpaper-engine-peform-toggle-action";

// We can enable "trace" logging so that all messages between the Stream Deck, and the plugin are recorded. When storing sensitive information
streamDeck.logger.setLevel(LogLevel.TRACE);

// Register the actions.
streamDeck.actions.registerAction(new WallpaperAction());
streamDeck.actions.registerAction(new WallpaperToggleAction());
streamDeck.actions.registerAction(new SetWallpaperAction());
// Finally, connect to the Stream Deck.
streamDeck.connect();
