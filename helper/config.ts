import assert from "assert";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";


import { AptosAccount, AptosClient, TxnBuilderTypes, MaybeHexString, HexString, FaucetClient, TokenClient, CoinClient, BCS, TokenTypes } from "aptos";

const {
  AccountAddress,
  EntryFunction,
  TransactionPayloadEntryFunction,
} = TxnBuilderTypes;

const NODE_URL = process.env.APTOS_NODE_URL || "https://fullnode.testnet.aptoslabs.com";
const FAUCET_URL = process.env.APTOS_FAUCET_URL || "https://faucet.devnet.aptoslabs.com";

export const aptosCoinStore = "0x1::aptos_coin::AptosCoin";

export const client = new AptosClient(NODE_URL);
export const faucetClient = new FaucetClient(NODE_URL, FAUCET_URL);
export const tokenClient = new TokenClient(client);
export const coinClient = new CoinClient(client);

export const mainAccount = new AptosAccount(
  new HexString("0xda33dccbbf5663fe302a03313794e6e59b9129b9a00ab63fcf0994cb942d8e15").toUint8Array(),
  new HexString("0x134d9ca1c123fd9fdd318d082abfdbc9ac2527321d054d91436c949f9bb9758c")
);

export const Alice = new AptosAccount(
  new HexString("0xae38facb5ebe6453f2bd2b7aeee4ce9ff36bfd7ea073dba6c6c7ea711c8a8c45").toUint8Array(),
  new HexString("0xe4ee027b2515b366ae9ee607ce76b2decbc1e5cd96caa6634632de17a8a1b608")
);

export const logColor = {
  Reset: "\x1b[0m",
  Bright: "\x1b[1m",
  Dim: "\x1b[2m",
  Underscore: "\x1b[4m",
  Blink: "\x1b[5m",
  Reverse: "\x1b[7m",
  Hidden: "\x1b[8m",

  FgBlack: "\x1b[30m",
  FgRed: "\x1b[31m",
  FgGreen: "\x1b[32m",
  FgYellow: "\x1b[33m",
  FgBlue: "\x1b[34m",
  FgMagenta: "\x1b[35m",
  FgCyan: "\x1b[36m",
  FgWhite: "\x1b[37m",

  BgBlack: "\x1b[40m",
  BgRed: "\x1b[41m",
  BgGreen: "\x1b[42m",
  BgYellow: "\x1b[43m",
  BgBlue: "\x1b[44m",
  BgMagenta: "\x1b[45m",
  BgCyan: "\x1b[46m",
  BgWhite: "\x1b[47m",
};

let oldConsoleLog = () => { };
let oldConsoleWarn = () => { };

export const enableLogger = () => {
  if (oldConsoleLog == null) return;
  console.log = oldConsoleLog;
  console.warn = oldConsoleWarn;
};

export const disableLogger = () => {
  oldConsoleLog = console.log;
  console.log = () => { };
  oldConsoleWarn = console.warn;
  console.warn = () => { };
};


export const getBalance = async (accountAddress: MaybeHexString, coinTypeAddress: HexString, coinName: string): Promise<string | number> => {
  try {
    const resource = await client.getAccountResource(
      accountAddress,
      `0x1::coin::CoinStore<${coinTypeAddress.hex()}::${coinName}::${coinName}>`,
    );

    return parseInt((resource.data as any)["coin"]["value"]);
  } catch (_) {
    return 0;
  }
}

