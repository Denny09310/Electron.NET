using System;
using System.Collections.Generic;
using System.Text;
using System.Threading.Tasks;

namespace ElectronNET.API
{

    public sealed class Protocol : ApiBase
    {
        protected override SocketTaskEventNameTypes SocketTaskEventNameType => SocketTaskEventNameTypes.DashesLowerFirst;
        protected override SocketTaskMessageNameTypes SocketTaskMessageNameType => SocketTaskMessageNameTypes.DashesLowerFirst;

        internal Protocol()
        {
        }

        internal static Protocol Instance
        {
            get
            {
                if (_protocol == null)
                {
                    lock (_syncRoot)
                    {
                        _protocol ??= new Protocol();
                    }
                }

                return _protocol;
            }
        }

        private static Protocol _protocol;

        private static readonly object _syncRoot = new();

        /// <summary>
        /// Registers the scheme as standard, secure, bypasses content security policy for resources, allows registering ServiceWorker, supports fetch API, streaming video/audio, and V8 code cache. 
        /// Specify a privilege with the value of true to enable the capability.
        /// </summary>
        /// <param name="customSchemes">Custom schemes to be registered with options.</param>
        /// <remarks>This method can only be used before the <see cref="App.Ready"/> event of the app module gets emitted and can be called only once.</remarks>
        public Task RegisterSchemesAsPrivilegedAsync(params CustomScheme[] customSchemes)
        {
            var tsc = new TaskCompletionSource();

            BridgeConnector.Socket.Once("register-schemes-as-privileged-completed", tsc.SetResult);
            BridgeConnector.Socket.Emit("register-schemes-as-privileged", customSchemes);

            return tsc.Task;
        }

        /// <summary>
        /// Register a protocol handler for scheme. Requests made to URLs with this scheme will delegate to this handler to determine what response should be sent.
        /// </summary>
        /// <param name="scheme">scheme to handle, for example https or my-app. This is the bit before the : in a URL.</param>
        /// <param name="handler">Either a <see cref="Response" /> or a <see cref="Task{Response}"/> can be returned.</param>
        public Task HandleAsync(string scheme, Func<Request, Response> handler)
        {
            if (string.IsNullOrWhiteSpace(scheme))
                throw new ArgumentException("Scheme must not be null or empty.", nameof(scheme));

            return handler switch
            {
                null => throw new ArgumentNullException(nameof(handler)),
                _ => HandleAsync(scheme, req => Task.FromResult(handler(req)))
            };
        }

        public Task HandleAsync(string scheme, Func<Request, Task<Response>> handler)
        {
            if (string.IsNullOrWhiteSpace(scheme))
                throw new ArgumentException("Scheme must not be null or empty.", nameof(scheme));

            if (handler == null)
                throw new ArgumentNullException(nameof(handler));

            var tsc = new TaskCompletionSource();

            // Tell TS to register protocol.handle for this scheme.
            BridgeConnector.Socket.Once("protocol-handle-register-completed", tsc.SetResult);
            BridgeConnector.Socket.Emit("protocol-handle-register", new
            {
                scheme
            });

            // Listen for incoming requests from TS
            BridgeConnector.Socket.On<Request>("protocol-handle-request", async (request) =>
            {
                try
                {
                    if (request == null || !string.Equals(request.Scheme, scheme, StringComparison.OrdinalIgnoreCase))
                        return; // Not our scheme, ignore.

                    var response = await handler(request).ConfigureAwait(false) ?? new Response
                    {
                        Status = 204
                    };

                    // Ensure headers dictionary exists
                    response.Headers ??= new();

                    // Push ContentType also as header, for TS convenience
                    if (!string.IsNullOrEmpty(response.ContentType))
                    {
                        response.Headers["content-type"] = new[] { response.ContentType! };
                    }

                    BridgeConnector.Socket.Emit("protocol-handle-response", new
                    {
                        id = request.Id,
                        status = response.Status,
                        headers = response.Headers,
                        body = response.Body != null
                            ? Convert.ToBase64String(response.Body)
                            : null
                    });
                }
                catch (Exception ex)
                {
                    // In case of error, send a 500 back
                    var errorBody = Encoding.UTF8.GetBytes("Protocol handler error:\n" + ex);

                    BridgeConnector.Socket.Emit("protocol-handle-response", new
                    {
                        id = request.Id,
                        status = 500,
                        headers = new
                        {
                            // minimal header set
                            contentType = new[] { "text/plain; charset=utf-8" }
                        },
                        body = Convert.ToBase64String(errorBody)
                    });
                }
            });

            return tsc.Task;
        }
    }

    public sealed class Request
    {
        public string Id { get; set; } = default!;
        public string Scheme { get; set; } = default!;
        public string Url { get; set; } = default!;
        public string Method { get; set; } = "GET";

        // Case-insensitive header name, multiple values per header.
        public Dictionary<string, string[]> Headers { get; set; } = new(StringComparer.OrdinalIgnoreCase);

        /// <summary>
        /// Request body as raw bytes, or null if none.
        /// </summary>
        public byte[] Body { get; set; }
    }

    public sealed class Response
    {
        /// <summary>
        /// HTTP-like status code. Default 200.
        /// </summary>
        public int Status { get; set; } = 200;

        /// <summary>
        /// Content-Type header value; convenience property.
        /// </summary>
        public string ContentType { get; set; }

        /// <summary>
        /// Response headers (without Content-Type).
        /// </summary>
        public Dictionary<string, string[]> Headers { get; set; } = new(StringComparer.OrdinalIgnoreCase);

        /// <summary>
        /// Raw response body (may be null for no body).
        /// </summary>
        public byte[] Body { get; set; }
    }

    public sealed class CustomScheme
    {
        public string Scheme { get; set; }
        public CustomSchemePrivileges Privileges { get; set; }

    }
    public sealed class CustomSchemePrivileges
    {
        public bool? Standard { get; set; }
        public bool? Secure { get; set; }
        public bool? BypassCSP { get; set; }
        public bool? AllowServiceWorkers { get; set; }
        public bool? SupportFetchAPI { get; set; }
        public bool? CorsEnabled { get; set; }
        public bool? Stream { get; set; }
        public bool? CodeCache { get; set; }
    }

}
