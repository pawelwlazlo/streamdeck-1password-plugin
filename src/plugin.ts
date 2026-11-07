import streamDeck from "@elgato/streamdeck";

import { OnePasswordFields } from "./actions/onepassword-fields";
import { OnePasswordItem } from "./actions/onepassword-item";

streamDeck.logger.setLevel("info");

streamDeck.actions.registerAction(new OnePasswordItem());
streamDeck.actions.registerAction(new OnePasswordFields());

streamDeck.connect();
