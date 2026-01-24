
import { storage } from "./server/storage";
import { db } from "./server/db";

const cookies = [
    {
        "domain": ".x.com",
        "expirationDate": 1783618944.699543,
        "hostOnly": false,
        "httpOnly": true,
        "name": "auth_token",
        "path": "/",
        "sameSite": "no_restriction",
        "secure": true,
        "session": false,
        "storeId": null,
        "value": "9b50c78e3f14fcbdec86e996fc8fdb5a4488705e"
    },
    {
        "domain": ".x.com",
        "expirationDate": 1768075875.553868,
        "hostOnly": false,
        "httpOnly": false,
        "name": "gt",
        "path": "/",
        "sameSite": null,
        "secure": true,
        "session": false,
        "storeId": null,
        "value": "2010044278253465622"
    },
    {
        "domain": ".x.com",
        "expirationDate": 1783618875.468706,
        "hostOnly": false,
        "httpOnly": false,
        "name": "guest_id",
        "path": "/",
        "sameSite": "no_restriction",
        "secure": true,
        "session": false,
        "storeId": null,
        "value": "v1%3A176806687538873336"
    },
    {
        "domain": ".x.com",
        "expirationDate": 1783618947.940404,
        "hostOnly": false,
        "httpOnly": false,
        "name": "twid",
        "path": "/",
        "sameSite": "no_restriction",
        "secure": true,
        "session": false,
        "storeId": null,
        "value": "u%3D1887731122660163584"
    },
    {
        "domain": ".x.com",
        "expirationDate": 1768068753.297966,
        "hostOnly": false,
        "httpOnly": true,
        "name": "__cf_bm",
        "path": "/",
        "sameSite": null,
        "secure": true,
        "session": false,
        "storeId": null,
        "value": "uEt65MwgVstE_ZxvRWtMQRQPK6PQovly9FiB3IGQypQ-1768066953.0657349-1.0.1.1-DtOIDpa_NInkVyXTNTQ4zPrdrJgAv7zvzyPrcBH5giT23rmwJF0ymO4HkGrENTNYmmODQjGAVEdnzbQ5IfJz.ETkb9HulOECsP49q3JbxqDBdkVywleHNV0wQJtEY_jR"
    },
    {
        "domain": ".x.com",
        "expirationDate": 1768153345.532619,
        "hostOnly": false,
        "httpOnly": true,
        "name": "att",
        "path": "/",
        "sameSite": "no_restriction",
        "secure": true,
        "session": false,
        "storeId": null,
        "value": "1-Mm98GIlw4QSt2rRKUvDLX6nXmbEtWcxg3rO8XPpz"
    },
    {
        "domain": ".x.com",
        "expirationDate": 1783618945.267905,
        "hostOnly": false,
        "httpOnly": false,
        "name": "ct0",
        "path": "/",
        "sameSite": "lax",
        "secure": true,
        "session": false,
        "storeId": null,
        "value": "a5199fdf84ec52512a0d6945c670713eb31e6c7aa930ffdc3a05139f8fe577505a8d157320ae5dd9406755cc6640220b659ce1fa13267cb23bc239f5843c57e915ce96a8d2cb3634b5c7d9e2778a442e"
    },
    {
        "domain": ".x.com",
        "expirationDate": 1770696689,
        "hostOnly": false,
        "httpOnly": false,
        "name": "d_prefs",
        "path": "/",
        "sameSite": null,
        "secure": true,
        "session": false,
        "storeId": null,
        "value": "MjoxLGNvbnNlbnRfdmVyc2lvbjoyLHRleHRfdmVyc2lvbjoxMDAw"
    },
    {
        "domain": ".x.com",
        "expirationDate": 1783618947.940296,
        "hostOnly": false,
        "httpOnly": false,
        "name": "guest_id_ads",
        "path": "/",
        "sameSite": "no_restriction",
        "secure": true,
        "session": false,
        "storeId": null,
        "value": "v1%3A176806687538873336"
    },
    {
        "domain": ".x.com",
        "expirationDate": 1783618947.94038,
        "hostOnly": false,
        "httpOnly": false,
        "name": "guest_id_marketing",
        "path": "/",
        "sameSite": "no_restriction",
        "secure": true,
        "session": false,
        "storeId": null,
        "value": "v1%3A176806687538873336"
    },
    {
        "domain": ".x.com",
        "expirationDate": 1783618944.699342,
        "hostOnly": false,
        "httpOnly": true,
        "name": "kdt",
        "path": "/",
        "sameSite": null,
        "secure": true,
        "session": false,
        "storeId": null,
        "value": "DffkMf0tywLVkO0VBKpnIG0Mf0QD4mH8ceT4a5tk"
    },
    {
        "domain": ".x.com",
        "expirationDate": 1783618875.553836,
        "hostOnly": false,
        "httpOnly": false,
        "name": "personalization_id",
        "path": "/",
        "sameSite": "no_restriction",
        "secure": true,
        "session": false,
        "storeId": null,
        "value": "\"v1_0XSHYcr/9MpVMXEpsxMm9A==\""
    }
];

async function updateCookies() {
    const agents = await storage.getAllAgents();
    // Assuming you want to update the first agent found, or filter by logic
    const agent = agents[0];

    if (!agent) {
        console.error("No agents found.");
        process.exit(1);
    }

    console.log(`Updating cookies for agent: ${agent.name} (${agent.id})`);

    await storage.updateAgent(agent.id, {
        twitterCookies: JSON.stringify(cookies)
    });

    console.log("Cookies updated successfully.");
    process.exit(0);
}

updateCookies().catch(console.error);
