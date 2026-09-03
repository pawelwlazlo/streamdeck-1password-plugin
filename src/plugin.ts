import streamDeck from "@elgato/streamdeck";

import { OnePasswordItem } from "./actions/onepassword-item";

streamDeck.logger.setLevel("info");

streamDeck.actions.registerAction(new OnePasswordItem());

streamDeck.connect();
