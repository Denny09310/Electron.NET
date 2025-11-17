import { Socket } from "net";
import { protocol } from "electron";
import { randomUUID } from "crypto"; // Node 14+; or a simple counter

let electronSocket: Socket;

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
    electronSocket = socket;

    // Already handled earlier:
    socket.on("registerSchemesAsPrivileged", (schemes) => {
        protocol.registerSchemesAsPrivileged(schemes);
        electronSocket.emit("registerSchemesAsPrivilegedCompleted");
    });

    // New: protocol.handle
    socket.on("protocol-handle-register", ({ scheme }: { scheme: string }) => {
        protocol.handle(scheme, (request) => handle(scheme, request));
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

    const dto: Request1 = {
        id,
        scheme,
        url: request.url,
        method: request.method,
        headers,
        body
    };

    return new Promise<Response>((resolve, reject) => {
        const handle = (res: Response1) => {
            // Filter by correlation ID
            if (res?.id !== id) {
                return;
            }

            electronSocket.off("protocol-handle-response", handle as any);

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

        electronSocket.on("protocol-handle-response", handle);
        electronSocket.emit("protocol-handle-request", dto);
    });
}