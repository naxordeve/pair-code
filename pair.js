
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

// Serve static files
app.use(express.static('public'));

// Route for the home page
app.get('/', (req, res) => {
    if (!req.query.number) {
        res.sendFile(path.join(process.cwd(), 'public', 'pair.html'));
        return;
    }
    router(req, res);
});

app.listen(port, '0.0.0.0', () => {
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

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    const id = makeid();
    let num = req.query.number;

    async function getPaire() {
        const { state, saveCreds } = await useMultiFileAuthState('./temp/' + id);
        try {
            let session = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({level: "fatal"}).child({level: "fatal"})),
                },
                printQRInTerminal: false,
                logger: pino({level: "fatal"}).child({level: "fatal"}),
                browser: Browsers.macOS("Safari"),
            });
            if (!session.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');
                const code = await session.requestPairingCode(num);
                if (!res.headersSent) {
                    await res.send({ code });
                }
            }
            session.ev.on('creds.update', saveCreds);

            session.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;

                if (connection == "open") {
                    await delay(10000);
                    let link = await pastebin.createPasteFromFile(`./temp/${id}/creds.json`, "pastebin-js test", null, 1, "N");
                    let data = link.replace("https://pastebin.com/", "");
                    let code = btoa(data);
                    const timestamp = Date.now().toString(36);
                    let c = `Aqua~${code}${timestamp}`;
                    await session.sendMessage(session.user.id, {text:`${c}`})

                    await delay(100);
                    await session.ws.close();
                    return await removeFile('./temp/' + id);
                } else if (connection === "close" && lastDisconnect && lastDisconnect.error && lastDisconnect.error.output.statusCode != 401) {
                    await delay(10000);
                    getPaire();
                }
            });
        } catch (err) {
            console.error("Error:", err);
            await removeFile('./temp/' + id);
            if (!res.headersSent) {
                await res.send({ error: "Failed to generate pairing code. Please try again." });
            }
        }
    }

    return await getPaire();
});

export default router;
