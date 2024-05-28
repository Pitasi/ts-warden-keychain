import Long from "long";
import { warden, getSigningWardenClient } from "@wardenprotocol/wardenjs";
import { DirectSecp256k1HdWallet } from '@cosmjs/proto-signing';

// connection parameters
const mnemonic = "exclude try nephew main caught favorite tone degree lottery device tissue tent ugly mouse pelican gasp lava flush pen river noise remind balcony emerge";
const rpcEndpoint = "https://rpc.devnet.wardenprotocol.org";

// keychain parameters
const keychain_id = 1;

// tx parameters
const gas_per_key_req = 70000;
const fees_amount = "400000";

const KeyRequestStatus = warden.warden.v1beta2.KeyRequestStatus;

function getSigner() {
    return DirectSecp256k1HdWallet.fromMnemonic(mnemonic, {
        prefix: "warden",
    });
}

async function connect() {
    // get signer
    const signer = await getSigner();
    const accounts = await signer.getAccounts();
    const address = accounts[0].address;

    // prepare signingClient (to broadcast txs) and query client
    const signingClient = await getSigningWardenClient({ rpcEndpoint, signer });
    const client = await warden.ClientFactory.createRPCQueryClient({ rpcEndpoint });

    return {
        address,
        signingClient,
        client,
    };
}

async function generateKey(id: Long) {
    // generate private key and store it in a way that can be retrieved by it's id
    // return the public key
    return new Uint8Array([0,1,2,3]);
}

async function main() {
    // connect
    const { address, client, signingClient } = await connect();
    const composer = warden.warden.v1beta2.MessageComposer.withTypeUrl;
    console.log("Logged in as", address);

    // query pending key requests for our keychain
    // @ts-ignore: we have some minor typing issue (required params that are not really required)
    const res = await client.warden.warden.v1beta2.keyRequests({
        status: KeyRequestStatus.KEY_REQUEST_STATUS_PENDING,
        keychainId: Long.fromInt(keychain_id),
        spaceId: Long.ZERO,
        pagination: {
            limit: Long.fromInt(5),
            key: new Uint8Array(),
            offset: Long.ZERO,
            reverse: false,
            countTotal: false,
        },
    });

    if (res.keyRequests.length === 0) {
        console.log("Nothing to do.");
        return;
    } else {
        console.log(`Got ${res.keyRequests.length} key requests.`);
    }

    // fulfill them all
    const ids = res.keyRequests.map(req => req.id);
    const msgs = [];
    for (const id of ids) {
        const publicKey = await generateKey(id);
        const msg = composer.updateKeyRequest({
            creator: address,
            requestId: id,
            status: KeyRequestStatus.KEY_REQUEST_STATUS_FULFILLED,
            key: {
                publicKey,
            },
        });
        msgs.push(msg);
    }

    // broadcast the transaction to warden protocol
    const fees = {
        amount: [{ denom: "uward", amount: fees_amount, }],
        gas: (BigInt(gas_per_key_req) * BigInt(msgs.length)).toString(),
    };
    const txRes = await signingClient.signAndBroadcast(address, msgs, fees);

    if (txRes.code == 0) {
        console.log(`Transaction success. Hash: ${txRes.transactionHash}`);
    } else {
        console.error(JSON.stringify(txRes, undefined, 2));
    }
}

main();
