const signalR = require("@microsoft/signalr");
const readline = require("readline");

const HUB_URL = "http://localhost:5088/chathub";

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

function ask(question) {
    return new Promise(resolve => {
        rl.question(question, answer => resolve(answer.trim()));
    });
}

async function testChat() {
    const ALICE_TOKEN = await ask("Paste Alice's fresh JWT token: ");
    const BOB_TOKEN = await ask("Paste Bob's fresh JWT token: ");

    rl.close();

    if (!ALICE_TOKEN || !BOB_TOKEN) {
        console.log("Both tokens are required.");
        return;
    }

    const alice = new signalR.HubConnectionBuilder()
        .withUrl(HUB_URL, {
            accessTokenFactory: () => ALICE_TOKEN
        })
        .build();

    const bob = new signalR.HubConnectionBuilder()
        .withUrl(HUB_URL, {
            accessTokenFactory: () => BOB_TOKEN
        })
        .build();

    bob.on("ReceiveMessage", message => {
        console.log("\nBob received a message!");
        console.log(message);
    });

    try {
        await bob.start();
        console.log("Bob connected!");

        await alice.start();
        console.log("Alice connected!");

        await alice.invoke(
            "SendMessage",
            "3",
            "Hello Bob! This is Alice."
        );

        console.log("Alice sent the message.");

        await new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
        console.error("Chat test failed:", error.message);
    } finally {
        if (alice.state !== signalR.HubConnectionState.Disconnected) {
            await alice.stop();
        }

        if (bob.state !== signalR.HubConnectionState.Disconnected) {
            await bob.stop();
        }
    }
}

testChat();
