import express from "express";
import http from "node:http";
import cors from "cors";
import path from "node:path";
import { hostname } from "node:os";
import chalk from "chalk";
import axios from "axios";
import { URL, parse } from 'url';
import contentType from 'content-type';

const server = http.createServer();
const app = express();
const PORT = process.env.PORT || 8080;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

app.post("/api/fetch", async (req, res) => {
    try {
        const response = await axios.post("https://api.cobalt.tools/api/json", req.body, {
            headers: {
                "Content-Type": "application/json",
                "Accept": "application/json"
            }
        });
        res.status(response.status).send(response.data);
    } catch (error) {
        console.error(`Error while proxying request: ${error.message}`);
        if (error.response) {
            res.status(error.response.status).send(error.response.data);
        } else {
            res.status(500).send("Internal Server Error");
        }
    }
});

app.use('/api/proxy/:url(*)', async (req, res) => {
    const { url } = req.params;
    let decodedUrl, proxiedUrl;
    try {
        decodedUrl = decodeURIComponent(url);
        proxiedUrl = decodedUrl;
    } catch (err) {
        console.error(`Failed to decode or decrypt URL: ${err}`);
        return res.status(400).send("Invalid URL");
    }

    try {
        const assetUrl = new URL(proxiedUrl);
        const assetResponse = await axios.get(assetUrl.toString(), { responseType: 'arraybuffer' });

        const contentTypeHeader = assetResponse.headers['content-type'];
        const parsedContentType = contentTypeHeader ? contentType.parse(contentTypeHeader).type : '';

        res.writeHead(assetResponse.status, {
            "Content-Type": parsedContentType
        });

        res.end(Buffer.from(assetResponse.data));
    } catch (err) {
        console.error(`Failed to fetch proxied URL: ${err}`);
        res.status(500).send("Failed to fetch proxied URL");
    }
});

server.on("request", (req, res) => {
    app(req, res);
});

server.on("upgrade", (req, socket, head) => {
    socket.end();
});

server.on("listening", () => {
    const address = server.address();
    const theme = chalk.hex("#800080");
    const host = chalk.hex("0d52bd");
    console.log(chalk.bold(theme(`
██╗   ██╗███╗   ███╗██████╗ ██████╗  █████╗ 
██║   ██║████╗ ████║██╔══██╗██╔══██╗██╔══██╗
██║   ██║██╔████╔██║██████╔╝██████╔╝███████║
██║   ██║██║╚██╔╝██║██╔══██╗██╔══██╗██╔══██║
╚██████╔╝██║ ╚═╝ ██║██████╔╝██║  ██║██║  ██║
 ╚═════╝ ╚═╝     ╚═╝╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝
                                            `)));

    console.log(`  ${chalk.bold(host("Local System:"))}            http://${address.family === "IPv6" ? `[${address.address}]` : address.address}${address.port === 80 ? "" : ":" + chalk.bold(address.port)}`);

    console.log(`  ${chalk.bold(host("Local System:"))}            http://localhost${address.port === 8080 ? "" : ":" + chalk.bold(address.port)}`);

    try {
        console.log(`  ${chalk.bold(host("On Your Network:"))}  http://${hostname()}${address.port === 8080 ? "" : ":" + chalk.bold(address.port)}`);
    } catch (err) {
        // can't find LAN interface
    }

    if (process.env.REPL_SLUG && process.env.REPL_OWNER) {
        console.log(`  ${chalk.bold(host("Replit:"))}           https://${process.env.REPL_SLUG}.${process.env.REPL_OWNER}.repl.co`);
    }

    if (process.env.HOSTNAME && process.env.GITPOD_WORKSPACE_CLUSTER_HOST) {
        console.log(`  ${chalk.bold(host("Gitpod:"))}           https://${PORT}-${process.env.HOSTNAME}.${process.env.GITPOD_WORKSPACE_CLUSTER_HOST}`);
    }

    if (process.env.CODESPACE_NAME && process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN) {
        console.log(`  ${chalk.bold(host("Github Codespaces:"))}           https://${process.env.CODESPACE_NAME}-${address.port === 80 ? "" : address.port}.${process.env.GITHUB_CODESPACES_PORT_FORWARDING_DOMAIN}`);
    }
});

server.listen({ port: PORT });

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

server.setMaxListeners(0);

function shutdown() {
    console.log("SIGTERM signal received: closing HTTP server");
    server.close(() => {
        console.log("HTTP server closed");
        process.exit(1);
    });
}