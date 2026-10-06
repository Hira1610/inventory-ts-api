import { createApp } from "./app";
import { createDb } from "./db";

const port = Number(process.env.PORT) || 3000;
createApp(createDb()).listen(port, () => console.log(`Inventory API listening on http://localhost:${port}`));
