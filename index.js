import PastebinAPI from 'pastebin-js';
import express from 'express';
import fs from 'fs';
import pino from 'pino';
import path from 'path';
import {
    makeWASocket,
    useMultiFileAuthState,
    delay,
    Browsers,
    fetchLatestBaileysVersion,
    makeCacheableSignalKeyStore
} from "@whiskeysockets/baileys";
import { readFile } from "node:fs/promises";
const pastebin = new PastebinAPI('r1eflgs76uuvyj-Q8aQFCVMGSiJpDXSL');
const app = express();
const port = 3000;
let router = express.Router();
app.use(express.static('statics'));
app.get('/', (req, res) => {
    if (!req.query.number) { res.sendFile(path.join(process.cwd(), 'statics', 'pair.html'));
        return;
    }
    router(req, res);
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

function makeid() {
    const length = 32;
    const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    const timestamp = Date.now().toString(36);
    let result = '';
    const charactersLength = characters.length;
    for (let i = 0; i < length - timestamp.length; i++) {
        result += characters.charAt(Math.floor(Math.random() * charactersLength));
    }
    return result + timestamp;
}

function ClearIT(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    const id = makeid();
    let num = req.query.number;
    async function WoW() {
        const { state, saveCreds } = await useMultiFileAuthState('./session/' + id);
        try {
            let conn = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({level: "fatal"}).child({level: "fatal"})),
                },
                printQRInTerminal: false,
                logger: pino({level: "fatal"}).child({level: "fatal"}),
                browser: Browsers.macOS("Safari"),
            });
            if (!conn.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await conn.requestPairingCode(num);
                if (!res.headersSent) {
                    await res.send({ code });
                }
            }
            conn.ev.on('creds.update', saveCreds);
            conn.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;
                if (connection == "open") {
                    await delay(10000);
                    let p = await pastebin.createPasteFromFile(`./session/${id}/creds.json`, "pastebin-js test", null, 1, "N");
                    let data = p.replace("https://pastebin.com/", "");
                    let code = btoa(data);
                    const timestamp = Date.now().toString(36);
                    let c = `Aqua~${code}${timestamp}`;
                    await conn.sendMessage(conn.user.id, {text:`${c}`})

                    await delay(100);
                    await WoW.ws.close();
                    return await ClearIT('./session/' + id);
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
                    await delay(10000);
                    WoW();
                }
            });
        } catch (err) {
            console.error(err);
            await ClearIT('./session/' + id);
            if (!res.headersSent) {
                await res.send({ error: "Please try again" });
            }
        }
    }

    return await WoW();
});

export default router;
