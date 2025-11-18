"use strict";
const electron_1 = require("electron");
const crypto_1 = require("crypto"); // Node 14+; or a simple counter
let _socket;
async function handle(scheme, request) {
    const id = (0, crypto_1.randomUUID)();
    const headers = {};
    for (const [value, key] of request.headers) {
        headers[key] = Array.isArray(value) ? value : [value];
    }
    let body;
    if (request.body) {
        const buffer = Buffer.from(await request.arrayBuffer());
        body = buffer.toString("base64");
    }
    const req = {
        id,
        scheme,
        url: request.url,
        method: request.method,
        headers,
        body
    };
    return new Promise((resolve, reject) => {
        const handle = (res) => {
            if (res?.id !== id) {
                return;
            }
            _socket.off("protocol-handle-response", handle);
            try {
                const status = res.status ?? 200;
                const headers = new Headers();
                if (res.headers) {
                    for (const [key, values] of Object.entries(res.headers)) {
                        if (Array.isArray(values)) {
                            for (const v of values) {
                                headers.append(key, v);
                            }
                        }
                        else if (typeof values === "string") {
                            headers.append(key, values);
                        }
                    }
                }
                let body;
                if (res.body) {
                    body = Buffer.from(res.body, "base64");
                }
                const response = new Response(body, { status, headers });
                resolve(response);
            }
            catch (err) {
                reject(err);
            }
        };
        _socket.once("protocol-handle-response", handle);
        _socket.emit("protocol-handle-request", req);
    });
}
module.exports = (socket) => {
    _socket = socket;
    console.log("protocol api initialized.");
    socket.on("register-schemes-as-privileged", (schemes) => {
        electron_1.protocol.registerSchemesAsPrivileged(schemes);
        _socket.emit("register-schemes-as-privileged-completed");
    });
    socket.on("protocol-handle-register", ({ scheme }) => {
        electron_1.protocol.handle(scheme, (request) => handle(scheme, request));
    });
};
//# sourceMappingURL=protocol.js.map