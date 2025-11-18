import { Socket } from "net";
import { protocol } from "electron";
import { randomUUID } from "crypto"; // Node 14+; or a simple counter

let _socket: Socket;

type Request1 = {
    id: string;
    scheme: string;
    url: string;
    method: string;
    headers: Record<string, string[]>;
    body?: string | null;
};

type Response1 = {
    id: string;
    status: number;
    headers: Record<string, string[]>;
    body?: string | null;
};

export = (socket: Socket) => {
    _socket = socket;

    console.log("protocol api initialized.");

    socket.on("register-schemes-as-privileged", (schemes) => {
        console.log("register schemes as privileged called.");

        protocol.registerSchemesAsPrivileged(schemes);
        _socket.emit("register-schemes-as-privileged-completed");
    });

    socket.on("protocol-handle-register", ({ scheme }: { scheme: string }) => {
        console.log("protocol handle called.");

        protocol.handle(scheme, (request) => handle(scheme, request));
        _socket.emit("protocol-handle-register-completed");
    });
};

async function handle(scheme: string, request: Request): Promise<Response> {
    const id = randomUUID();

    const headers: Record<string, string[]> = {};
    for (const [value, key] of request.headers) {
        headers[key] = Array.isArray(value) ? value : [value];
    }

    let body: string | undefined;
    if (request.body) {
        const buffer = Buffer.from(await request.arrayBuffer());
        body = buffer.toString("base64");
    }

    const req: Request1 = {
        id,
        scheme,
        url: request.url,
        method: request.method,
        headers,
        body
    };

    return new Promise<Response>((resolve, reject) => {
        const handle = (res: Response1) => {
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
                        } else if (typeof values === "string") {
                            headers.append(key, values);
                        }
                    }
                }

                let body: Buffer | undefined;
                if (res.body) {
                    body = Buffer.from(res.body, "base64");
                }

                const response = new Response(body, { status, headers });
                resolve(response);
            } catch (err) {
                reject(err);
            }
        };

        _socket.once("protocol-handle-response", handle);
        _socket.emit("protocol-handle-request", req);
    });
}