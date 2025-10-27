import express from "express";
import { randomUUID } from "node:crypto";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
// import { isInitializeRequest } from "@modelcontextprotocol/sdk/types.js"
import { z } from "zod";
// import { trackMCP } from "agnost";

const app = express();
app.use(express.json());

// Map to store transports by session ID
const transports: { [sessionId: string]: StreamableHTTPServerTransport } = {};

// Handle POST requests for client-to-server communication
app.post('/mcp', async (req: express.Request, res: express.Response) => {
  // Check for existing session ID
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  let transport: StreamableHTTPServerTransport;

  if (sessionId && transports[sessionId]) {
    console.log(`Using existing transport for session ID: ${sessionId}`);
    transport = transports[sessionId];
  // } else if (!sessionId && isInitializeRequest(req.body)) {
  } else if (!sessionId) {
    console.log(`Creating new transport`);
    // New initialization request
    transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: () => randomUUID(),
      onsessioninitialized: (sessionId) => {
        transports[sessionId] = transport;
      },
      enableDnsRebindingProtection: true,
      allowedHosts: ["127.0.0.1:3000"]
    });

    // Clean up transport when closed
    transport.onclose = () => {
      if (transport.sessionId) {
        delete transports[transport.sessionId];
      }
    };

    const server = new McpServer({
      name: "example-server",
      version: "1.0.0"
    });

    // server.registerTool("add",
    //   {
    //     title: "Addition Tool",
    //     description: "Add two numbers",
    //     inputSchema: { a: z.number(), b: z.number() }
    //   },
    //   async ({ a, b }) => {
    //     // Uncomment the next line to test error handling.
    //     // throw new Error("Intentional unhandled exception");
    //     return {
    //       content: [{ type: "text", text: String(a + b) }]
    //     };
    //   }
    // );
    
    // trackMCP(server, "b6af7f8f-7414-4b30-af3c-85b87e72fd7c");
    await server.connect(transport);
  } else {
    // Invalid request
    res.status(400).json({
      jsonrpc: '2.0',
      error: {
        code: -32000,
        message: 'Bad Request: No valid session ID provided',
      },
      id: null,
    });
    return;
  }

  await transport.handleRequest(req, res, req.body);
});

// Reusable handler for GET and DELETE requests
const handleSessionRequest = async (req: express.Request, res: express.Response) => {
  const sessionId = req.headers['mcp-session-id'] as string | undefined;
  if (!sessionId || !transports[sessionId]) {
    res.status(400).send('Invalid or missing session ID');
    return;
  }
  
  const transport = transports[sessionId];
  await transport.handleRequest(req, res);
};

// Handle GET requests for server-to-client notifications via SSE
app.get('/mcp', handleSessionRequest);

// Handle DELETE requests for session termination
app.delete('/mcp', handleSessionRequest);

app.listen(3000);