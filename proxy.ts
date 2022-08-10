import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import express from 'express';
import httpProxy from 'http-proxy';

const proxy = httpProxy.createProxyServer();

const port = 4000;
const pingTimeoutSec = 30;

type Worker = { process: ChildProcessWithoutNullStreams, port: number, timeout: NodeJS.Timeout };
const uidToWorker = new Map<string, Worker>();

function restartWorkerTimeout(uid: string, worker: Worker, reason: string) {
  clearTimeout(worker.timeout);
  worker.timeout = setTimeout(() => {
    console.log(`Timeout of ${pingTimeoutSec} seconds reached for worker ${uid} due to inaction - killing the worker at ${new Date(Date.now()).toISOString()}`);
    worker.process.kill();
    uidToWorker.delete(uid);
  }, pingTimeoutSec * 1000);
  console.log(`Timeout restarted for worker ${uid} on ${new Date(Date.now()).toISOString()}; Reason provided: ${reason}`);
}

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

  const timeout = setTimeout(() => {
    console.log(`Timeout of ${pingTimeoutSec} seconds reached for worker ${workerUid} due to inaction - killing the worker at ${new Date(Date.now()).toISOString()}`);
    worker.kill();
    uidToWorker.delete(`${workerUid}`);
  }, pingTimeoutSec * 1000);

  uidToWorker.set(`${workerUid}`, { process: worker, port: workerPort, timeout });
  res.status(200);
  res.send({ uid: workerUid });
});

app.use('/ping', (req, res) => {
  const uid = req.header('X-Serv-Uid');
  if (!uid || !uidToWorker.has(uid)) {
    res.status(300);
    res.send();
    return;
  }

  const worker = uidToWorker.get(uid)!;
  restartWorkerTimeout(uid, worker, 'ping request');
  res.status(200);
  res.send();
});

app.use('/graphql', (req, res) => {
  const uid = req.header('X-Serv-Uid');
  if (!uid || !uidToWorker.has(uid)) {
    res.status(300);
    res.send();
    return;
  }

  const worker = uidToWorker.get(uid)!;
  restartWorkerTimeout(uid, worker, 'graphql request');

  const processPort = uidToWorker.get(uid)?.port;
  proxy.web(req, res, {
    target: `http://localhost:${processPort}/graphql`
  });
});

app.listen(port);