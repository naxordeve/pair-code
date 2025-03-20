import PastebinAPI from 'pastebin-js';
import express from 'express';
import fs from 'fs';
import pino from 'pino';
import path from 'path';
import mongoose from 'mongoose';
import {
    useMultiFileAuthState,
    delay,
    Browsers,
    makeCacheableSignalKeyStore
} from "@whiskeysockets/baileys";
import { makeWASocket } from "@whiskeysockets/baileys";
import { Base64 } from 'js-base64';
const pastebin = new PastebinAPI('r1eflgs76uuvyj-Q8aQFCVMGSiJpDXSL');
const app = express();
const port = 3000;
let router = express.Router();

mongoose.connect('  ', {
    useNewUrlParser: true,
    useUnifiedTopology: true
});

const sessionSchema = new mongoose.Schema({
    sessionId: String,
    credentials: Object,
    timestamp: { type: Date, default: Date.now }
});

const Session = mongoose.model('Session', sessionSchema);
app.use(express.static('statics'));
app.get('/', (req, res) => {
    if (!req.query.number) { res.sendFile(path.join(process.cwd(), 'statics', 'pair.html'));
    return; } router(req, res);
});

app.listen(port, '', () => {
    console.log(`Server running on port ${port}`);
});


const makeid = () => [...Array(32 - Date.now().toString(36).length)].map(() => 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789'.charAt(Math.floor(Math.random() * 62))).join('') + Date.now().toString(36);
function Nice(dp) {
    if (fs.existsSync(dp)) {
        fs.rmSync(dp, { recursive: true, force: true });
    }
}

function MakeIT(dp) {
    if (!fs.existsSync(dp)) {
        fs.mkdirSync(dp, { recursive: true });
    }
}

router.get('/', async (req, res) => {
    const id = makeid();
    let num = req.query.number;
    async function WoW() {
        const sec = `./session/${id}`;
        MakeIT(sec);
        const { state, saveCreds } = await useMultiFileAuthState(sec);
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

            conn.ev.on('creds.update', async (creds) => {
                saveCreds();
                await Session.findOneAndUpdate(
                    { sessionId: id },
                    { sessionId: id, credentials: creds },
                    { upsert: true }
                );
            });

            conn.ev.on("connection.update", async (s) => {
                const { connection, lastDisconnect } = s;
                if (connection == "open") {
                    await delay(10000);
                    const ses = await Session.findOne({ sessionId: id });
                    if (!ses) {
                        console.error("no ses");
                        return;
                    }
                    const v = JSON.stringify(ses.credentials);
                    const i = await pastebin.createPaste(v, "Session Data", null, 1, "N");
                    const p_d = i.replace("https://pastebin.com/", "");
                    const enc = Base64.encode(p_d);
                    const timestamp = Date.now().toString(36);
                    const meg = `Aqua~${enc}${timestamp}`;
                    await conn.sendMessage(conn.user.id, { text: meg });
                    await delay(100);
                    await conn.ws.close();
                    return Nice(sec);
                } else if (connection === "close" && lastDisconnect?.error?.output?.statusCode !== 401) {
                    await delay(10000);
                    WoW();
                }
            });

        } catch (err) {
            console.error(err);
            Nice(sec);
            if (!res.headersSent) {
                res.send({ error: "Please try again" });
            }
        }
    }

    return WoW();
});

export default router;
    
