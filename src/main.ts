#!/usr/bin/env node
import { program } from "commander";
import { loadFilesFromIpfs } from "./loadFilesFromIpfs";
import { create as createIpfsNode } from "ipfs-http-client";
import * as IPFS from "ipfs-core";
import fs from "fs";
import path from "path";
import axios from "axios";
import { publishFilesToIpfs } from "./publishFilesToIpfs";
import { InMemoryFile } from "@nerfzael/memory-fs";

program
  .command("download")
  .description("Download all wrappers from the wrappers gateway")
  .option("-t, --target, <target>", "Target directory")
  .option("-u, --url, [url]", "Gateway URL")
  .action(async (options) => {
    if (!options.target) {
      console.error("Target directory is required");
      process.exit(1);
    }
    if (!options.url) {
      options.url = "https://ipfs.wrappers.io";
    }

    const ipfsNode = createIpfsNode({ url: options.url });
  
    console.log(`Fetching wrapper list from ${options.url}`);
  
    const wrappers = await axios.get(`${options.url}/pins?json=true`);

    console.log(`Found ${wrappers.data.length} wrappers`);
    console.log(`Downloading wrappers into ${options.target}`);

    let totalRetryCount = 0;

    for (const wrapper of wrappers.data) {
      console.log(wrapper.name, wrapper.cid);
      const retryCount = await downloadWrapper(wrapper.cid, ipfsNode);
      
      totalRetryCount += retryCount;
    }

    console.log(`Download complete`);
    console.log(`Retries per wrapper: ${(totalRetryCount/wrappers.data.length).toFixed(2)}(${totalRetryCount}/${wrappers.data.length})`);
  });

program
  .command("publish")
  .description("Publish all wrappers from the specified directory to the wrappers gateway")
  .option("-t, --target, <target>", "Target directory")
  .option("-u, --url, [url]", "Gateway URL")
  .action(async (options) => {
    if (!options.target) {
      console.error("Target directory is required");
      process.exit(1);
    }
    if (!options.url) {
      options.url = "https://ipfs.wrappers.io";
    }

    const ipfsNode = createIpfsNode({ url: options.url });

    const wrappers = await fs.promises.readdir(options.target);

    console.log(`Found ${wrappers.length} wrappers`);

    for (const wrapperPath of wrappers) {
      let files = await getFilesFromPath(path.join(options.target, wrapperPath));
      files = files.map(x => ({
        path: x.path.slice(path.join(options.target, wrapperPath).length + 1),
        content: x.content,
      }));
      console.log(`Publishing ${wrapperPath}...`)
      const cid = await publishFilesToIpfs(files, ipfsNode);
      if (!cid) {
        console.error(`Failed to publish ${wrapperPath}`);
        process.exit(1);
      }

      console.log(`Published ${wrapperPath} as ${cid}`);

      if (cid != wrapperPath) {
        console.error(`CID mismatch: ${cid} != ${wrapperPath}`);
        process.exit(1);
      }
    }
  });

program.parse(process.argv);
 
async function getFilesFromPath(path: string): Promise<InMemoryFile[]> {
  const files: InMemoryFile[] = [];
  await aggregateFilesFromPath(path, files);
  return files;
}

async function aggregateFilesFromPath(dir: string, files: InMemoryFile[]): Promise<void> {
  const items = await fs.promises.readdir(dir);
  for (const item of items) {
    const itemPath = path.join(dir, item);
    const stats = await fs.promises.stat(itemPath);
    if (stats.isDirectory()) {
      await aggregateFilesFromPath(itemPath, files);
    }
    if (stats.isFile()) {
      const content = await fs.promises.readFile(itemPath);
      files.push({
        path: itemPath,
        content,
      });
    }
  }
}

async function downloadWrapper(cid: string, ipfsNode: IPFS.IPFS): Promise<number> {
  const [files, retryCount] = await loadFilesFromIpfs(cid, ipfsNode, 0);

  ensureDirectoryExistence(path.join("wrappers", cid));

  if (!files) {
    console.error(`Wrapper ${cid} could not be downloaded. Exiting...`);
    process.exit(1);
  }

  for (const file of files) {
    ensureFileDirectoryExistence(path.join("wrappers", cid, file.path));
    if (!file.content || !file.content.length) continue;
    await fs.promises.writeFile(path.join("wrappers", cid, file.path), file.content);
  }

  return retryCount;
}

function ensureFileDirectoryExistence(filePath: string) {
  ensureDirectoryExistence(path.dirname(filePath));
}

function ensureDirectoryExistence(dirname: string) {
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(path.dirname(dirname));
  fs.mkdirSync(dirname);
}
