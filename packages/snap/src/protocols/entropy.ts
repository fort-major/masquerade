import { TOrigin, ZEntropyGetRequest, hexToBytes, fromCBOR, zodParse } from "@fort-major/masquerade-shared";


export async function handleEntropyGet(bodyCBOR: string, origin: TOrigin): Promise<Uint8Array> {
    const body = zodParse(ZEntropyGetRequest, fromCBOR(bodyCBOR));

    // for some extra calmness - not applying user-defined salt at this stage    
    let entropyPre: string = await snap.request({
        method: "snap_getEntropy",
        params: {
            version: 1,
            // WARNING! DO NOT CHANGE THIS EVER, OR USERS WONT BE ABLE TO USE THEIR KEYS
            salt: `\x0amasquerade-snap\n${origin}`
        }
    });

    // apply user-defined salt later as a separate hashing step
    const entropyPreBytes = new Uint8Array([...hexToBytes(entropyPre.slice(2)), ...body.salt]);
    const entropy = await crypto.subtle.digest('SHA-256', entropyPreBytes);

    return new Uint8Array(entropy);
}