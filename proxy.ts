import { spawn, ChildProcessWithoutNullStreams } from 'node:child_process';
import express from 'express';
import httpProxy from 'http-proxy';
import axios from 'axios';
import { timeout } from './common';
import minimist from 'minimist';

const proxy = httpProxy.createProxyServer();

const defaultPort = 4000;
const defaultRetries = 10;
const defaultTimeout = 30;
type ServerArgs = {
  p: number,
  retries: number,
  timeout: number,
}
const args = minimist<ServerArgs>(process.argv.slice(2), {
  default: {
    p: defaultPort,
    retries: defaultRetries,
    timeout: defaultTimeout,
  }
});

const port = args.p;
const retries = args.retries;
const pingTimeoutSec = args.timeout;
const workerUid = 'X-Serv-Uid';

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

async function probeWorker(port: number, retries: number, interval: number): Promise<{ success: boolean, tries: number }> {
  let tries = 1;
  while (tries <= retries) {
    try {
      const resp = await axios.options(`http://localhost:${port}/graphql`);
      if (resp.status === 204) return { success: true, tries };
    } catch (err) {}

    await timeout(interval);
    tries++;
  }

  return { success: false, tries };
}

async function main() {
  let serverPort = 4001;
  let serverUid = 1000;

  const app = express();
  app.use('/handshake', async (req, res) => {
    const workerPort = serverPort++;
    const worker = spawn('node', ['./build/server.js', '-p', `${workerPort}`, '--delay', '10000']);

    worker.stdout.on('data', (data) => {
      console.log(`stdout: ${data}`);
    });

    worker.stderr.on('data', (data) => {
      console.error(`stderr: ${data}`);
    });

    worker.on('close', (code) => {
      console.log(`child process exited with code ${code}`);
    });

    console.log('Probing for worker');
    const { success, tries } = await probeWorker(workerPort, retries, 2000);
    if (!success) {
      console.log('Failed to start worker');
      res.status(300);
      res.send({ msg: 'Failed to start worker' });
      return;
    }

    const workerUid = serverUid++;

    const timeout = setTimeout(() => {
      console.log(`Timeout of ${pingTimeoutSec} seconds reached for worker ${workerUid} due to inaction - killing the worker at ${new Date(Date.now()).toISOString()}`);
      worker.kill();
      uidToWorker.delete(`${workerUid}`);
    }, pingTimeoutSec * 1000);

    uidToWorker.set(`${workerUid}`, { process: worker, port: workerPort, timeout });
    console.log(`Started worker ${workerUid} after ${tries} tries`);
    res.status(200);
    res.send({ uid: workerUid });
  });

  app.use('/ping', (req, res) => {
    const uid = req.header(workerUid);
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
    const uid = req.header(workerUid);
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
}

main();