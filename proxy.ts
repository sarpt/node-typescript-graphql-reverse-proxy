import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import express from 'express';
import httpProxy from 'http-proxy';

const proxy = httpProxy.createProxyServer();

const port = 4000;

const uidToPort = new Map<string, { process: ChildProcessWithoutNullStreams, port: number }>();

let serverPort = 4001;
let serverUid = 1000;

const app = express();
app.use('/handshake', (req, res) => {
  const workerPort = serverPort++;
  const worker = spawn('node', ['./build/server.js', '-p', `${workerPort}`]);

  worker.stdout.on('data', (data) => {
    console.log(`stdout: ${data}`);
  });

  worker.stderr.on('data', (data) => {
    console.error(`stderr: ${data}`);
  });

  worker.on('close', (code) => {
    console.log(`child process exited with code ${code}`);
  });

  const workerUid = serverUid++;
  uidToPort.set(`${workerUid}`, { process: worker, port: workerPort });
  res.status(200);
  res.send({ uid: workerUid });
});

app.use('/graphql', (req, res) => {
  const uid = req.header('X-Serv-Uid');
  if (!uid || !uidToPort.has(uid)) {
    res.status(403);
    res.send();
    return;
  }

  const processPort = uidToPort.get(uid)?.port;
  proxy.web(req, res, {
    target: `http://localhost:${processPort}/graphql`
  });
});

app.listen(port);