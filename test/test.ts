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
const aptosCoinStore = "0x1::coin::CoinStore<0x1::aptos_coin::AptosCoin>";

const client = new AptosClient(NODE_URL);
const faucetClient = new FaucetClient(NODE_URL, FAUCET_URL);
const tokenClient = new TokenClient(client);
const coinClient = new CoinClient(client);

const mainAccount = new AptosAccount(
  new HexString("0xc3b2038ceb546cc1d1c2def48e3b4470ece399ea00d2ac386027709f4087656f").toUint8Array(),
  new HexString("0x3cc2d5c9c84d6f0181fd71b51690940b223cfe60851e5b3917fc4511b81d1e80")
);
// const mainAccount = new AptosAccount();

const logColor = {
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

jest.setTimeout(200000);

var oldConsoleLog = () => { };
var oldConsoleWarn = () => { };

const enableLogger = () => {
  if (oldConsoleLog == null) return;
  console.log = oldConsoleLog;
  console.warn = oldConsoleWarn;
};

const disableLogger = () => {
  oldConsoleLog = console.log;
  console.log = () => { };
  oldConsoleWarn = console.warn;
  console.warn = () => { };
};

const registerCoin = async (coinTypeAddress: HexString, coinReceiver: AptosAccount, coinName: string): Promise<string> => {
  const rawTxn = await client.generateTransaction(coinReceiver.address(), {
    function: "0x1::managed_coin::register",
    type_arguments: [`${coinTypeAddress.hex()}::${coinName}::${coinName}`],
    arguments: [],
  });

  const bcsTxn = await client.signTransaction(coinReceiver, rawTxn);
  const pendingTxn = await client.submitTransaction(bcsTxn);

  return pendingTxn.hash;
}

const mintCoin = async (minter: AptosAccount, receiverAddress: HexString, amount: number | bigint, coinName: string): Promise<string> => {
  const rawTxn = await client.generateTransaction(minter.address(), {
    function: "0x1::managed_coin::mint",
    type_arguments: [`${minter.address()}::${coinName}::${coinName}`],
    arguments: [receiverAddress.hex(), amount],
  });

  const bcsTxn = await client.signTransaction(minter, rawTxn);
  const pendingTxn = await client.submitTransaction(bcsTxn);

  return pendingTxn.hash;
}

const getBalance = async (accountAddress: MaybeHexString, coinTypeAddress: HexString, coinName: string): Promise<string | number> => {
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

const mintToken = async (minter: AptosAccount): Promise<TokenTypes.TokenId> => {
  const collectionName = `${minter.address()}'s test_1 collection`;
  const tokenName = `${minter.address()}'s test_1 token`;
  const tokenPropertyVersion = 0;

  // const collectionData = await tokenClient.getCollectionData(minter.address(), collectionName);

  const tokenId = {
    token_data_id: {
      creator: minter.address().hex(),
      collection: collectionName,
      name: tokenName,
    },
    property_version: `${tokenPropertyVersion}`,
  };

  try {
    // Create the collection.
    const txnHash1 = await tokenClient.createCollection(
      minter,
      collectionName,
      "minter's simple collection",
      "https://alice.com",
    );
    await client.waitForTransaction(txnHash1, { checkSuccess: true });
    // Create a token in that collection.
    const txnHash2 = await tokenClient.createToken(
      minter,
      collectionName,
      tokenName,
      "minter's simple token",
      2,
      "https://aptos.dev/img/nyan.jpeg",
    );
    await client.waitForTransaction(txnHash2, { checkSuccess: true });
  } catch (err) {
    console.log(err.transaction.vm_status);
  }
  return tokenId;
}

const publishCoin = async (sender: AptosAccount, coinName: string) => {
  console.log(logColor.FgMagenta, `In ${sender.address()}, ${coinName} Contract Compiling...`);
  disableLogger();
  execSync(`aptos move compile --package-dir ./${coinName} --save-metadata --named-addresses ${coinName}=${sender.address()}`);
  enableLogger();
  // console.log(logColor.FgCyan, result.toString());
  let packageMetadata = fs.readFileSync(path.join(coinName, "build", coinName, "package-metadata.bcs"));
  let moduleData = fs.readFileSync(path.join(coinName, "build", coinName, "bytecode_modules", `${coinName}.mv`));
  console.log(logColor.FgGreen, `Publishing ${coinName} Contract...`);
  let txnHash = await client.publishPackage(
    sender, new HexString(packageMetadata.toString("hex")).toUint8Array(), [
    new TxnBuilderTypes.Module(new HexString(moduleData.toString("hex")).toUint8Array()),
  ]
  );
  let txInfo = await client.waitForTransactionWithResult(txnHash, { checkSuccess: true });
  console.log(logColor.FgBlack, "hash : ", txInfo.hash);
}

const InitAccounts = async () => {
  console.log("\n=== Addresses ===");
  console.log(`Main: ${mainAccount.address()}`);

  // console.log(logColor.FgBlue, "Funding 100,000,000 to each accounts");
  // await faucetClient.fundAccount(mainAccount.address(), 100_000_000);
  // console.log(logColor.FgWhite, "Completed!");
  // await faucetClient.fundAccount(coin1.address(), 100_000_000);
  // console.log(logColor.FgWhite, "Completed!");
  // await faucetClient.fundAccount(coin2.address(), 100_000_000);
  // console.log(logColor.FgWhite, "Completed!");
  // // await faucetClient.fundAccount(nft1Account.address(), 100_000_000);
  // // console.log(logColor.FgWhite, "Completed!");
  // // await faucetClient.fundAccount(nft2Account.address(), 100_000_000);
  // // console.log(logColor.FgWhite, "Completed!");
  // await faucetClient.fundAccount(Alice.address(), 100_000_000);
  // console.log(logColor.FgWhite, "Completed!");
  // await faucetClient.fundAccount(Bob.address(), 100_000_000);
  // console.log(logColor.FgWhite, "Completed!");
  // await faucetClient.fundAccount(Charlie.address(), 100_000_000);
  // console.log(logColor.FgWhite, "Completed!");
}

const InitContracts = async () => {
  console.log(logColor.FgMagenta, `In ${mainAccount.address()}, Raffle Contract Compiling...`);
  disableLogger();
  execSync(`aptos move compile --package-dir --save-metadata --named-addresses admin=${mainAccount.address()}`);
  enableLogger();
  // console.log(logColor.FgCyan, result.toString());

  console.log(logColor.FgWhite);

  let packageMetadata = fs.readFileSync(path.join("build", "AptosGame", "package-metadata.bcs"));
  let gameModuleData = fs.readFileSync(path.join("build", "AptosGame", "bytecode_modules", "game.mv"));
  let utilsModuleData = fs.readFileSync(path.join("build", "AptosGame", "bytecode_modules", "utils.mv"));
  console.log(logColor.FgGreen, "Publishing Raffle Contract...");
  let txnHash = await client.publishPackage(
    mainAccount, new HexString(packageMetadata.toString("hex")).toUint8Array(), [
    new TxnBuilderTypes.Module(new HexString(gameModuleData.toString("hex")).toUint8Array()),
  ]
  );
  let txInfo = await client.waitForTransactionWithResult(txnHash, { checkSuccess: true });
  console.log(logColor.FgBlack, "hash : ", txInfo.hash);
  txnHash = await client.publishPackage(
    mainAccount, new HexString(packageMetadata.toString("hex")).toUint8Array(), [
    new TxnBuilderTypes.Module(new HexString(utilsModuleData.toString("hex")).toUint8Array()),
  ]
  );
  txInfo = await client.waitForTransactionWithResult(txnHash, { checkSuccess: true });
  console.log(logColor.FgBlack, "hash : ", txInfo.hash);

  console.log(logColor.FgWhite);

}

const Init = async () => {
  await InitAccounts();
  await InitContracts();
}
// Init();
describe("Initializing Test", () => {
  beforeAll(async () => {
    await Init();
  });
  test("Case 1: Testing Raffle with Aptos", async () => {

    let now = Date.now();
    let end_time = now + 500000;
    console.log(
      logColor.FgBlue,
      "Case 1[Action]: Set Raffle End time to 50 secs later and Creating Raffle with '0' of NFT 1 Collection in Aptos option."
    );
    // console.log(TxnBuilderTypes.StructTag.fromString(`${coin1.address()}::${coinName1}::${coinName1}`));

    let errMsg = "";

    //     try {
    //       await client.generateSignSubmitWaitForTransaction(Bob, new TransactionPayloadEntryFunction(
    //         EntryFunction.natural(
    //           `${mainAccount.address()}::raffle_test_1`,
    //           "create_raffle",
    //           [new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(`${coin1.address()}::${coinName1}::${coinName1}`))],
    //           [
    //             BCS.bcsToBytes(AccountAddress.fromHex(Bob.address())),
    //             BCS.bcsSerializeStr(`${Bob.address()}'s test_1 collection`),
    //             BCS.bcsSerializeStr(`${Bob.address()}'s test_1 token`),
    //             BCS.bcsSerializeUint64(Number(0)),
    //             BCS.bcsSerializeUint64(Number(end_time)),
    //             BCS.bcsSerializeUint64(Number(1000)),
    //             BCS.bcsSerializeUint64(Number(200))
    //           ]
    //         )), { checkSuccess: true });
    //     } catch (err) {
    //       console.log(err.transaction.vm_status);
    //       errMsg = err.transaction.vm_status;
    //     }
    //     console.log(logColor.FgGreen, "Case 1[Outcome]: Raffle Creation Succeed");

    //     console.log(
    //       logColor.FgBlue,
    //       "Case 1[Action]: Charlie buy 100 Tickets with SunCoin"
    //     );
    //     try {
    //       await client.generateSignSubmitWaitForTransaction(Charlie, new TransactionPayloadEntryFunction(
    //         EntryFunction.natural(
    //           `${mainAccount.address()}::raffle_test_1`,
    //           "enter",
    //           [new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(`${coin2.address()}::${coinName2}::${coinName2}`))],
    //           [
    //             BCS.bcsToBytes(AccountAddress.fromHex(Bob.address())),
    //             BCS.bcsSerializeUint64(0),
    //             BCS.bcsSerializeUint64(100)
    //           ]
    //         )), { checkSuccess: true });
    //     } catch (err) {
    //       console.log(err.transaction.vm_status);
    //       errMsg = err.transaction.vm_status;
    //     }
    //     // expect(errMsg).toMatch(
    //     //   /(Not registered coin)/
    //     // );

    //     console.log(
    //       logColor.FgRed,
    //       "Case 1[Outcome]: Ticket Purchase Failed cause he sent another coin(SunCoin) to buy tickets."
    //     );

    //     console.log(
    //       logColor.FgBlue,
    //       "Case 1[Action]: Alice buy 100 Tickets with MoonCoin"
    //     );
    //     try {
    //       await client.generateSignSubmitWaitForTransaction(Alice, new TransactionPayloadEntryFunction(
    //         EntryFunction.natural(
    //           `${mainAccount.address()}::raffle_test_1`,
    //           "enter",
    //           [new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(`${coin1.address()}::${coinName1}::${coinName1}`))],
    //           [
    //             BCS.bcsToBytes(AccountAddress.fromHex(Bob.address())),
    //             BCS.bcsSerializeUint64(Number(0)),
    //             BCS.bcsSerializeUint64(Number(100))
    //           ]
    //         )), { checkSuccess: true });
    //     } catch (err) {
    //       console.log(err.transaction.vm_status);
    //       errMsg = err.transaction.vm_status;
    //     }
    //     console.log(
    //       logColor.FgGreen,
    //       "Case 1[Outcome]: Ticket Purchase Succeed and now Alice have 100 tickets"
    //     );

    //     console.log(
    //       logColor.FgBlue,
    //       "Case 1[Action]: Charlie buy 100 Tickets with MoonCoin"
    //     );
    //     try {
    //       await client.generateSignSubmitWaitForTransaction(Charlie, new TransactionPayloadEntryFunction(
    //         EntryFunction.natural(
    //           `${mainAccount.address()}::raffle_test_1`,
    //           "enter",
    //           [new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(`${coin1.address()}::${coinName1}::${coinName1}`))],
    //           [
    //             BCS.bcsToBytes(AccountAddress.fromHex(Bob.address())),
    //             BCS.bcsSerializeUint64(Number(0)),
    //             BCS.bcsSerializeUint64(Number(100))
    //           ]
    //         )), { checkSuccess: true });
    //     } catch (err) {
    //       console.log(err.transaction.vm_status);
    //       errMsg = err.transaction.vm_status;
    //     }
    //     console.log(
    //       logColor.FgGreen,
    //       "Case 1[Outcome]: Ticket Purchase Succeed and now Charlie have 100 tickets"
    //     );

    //     console.log(
    //       logColor.FgBlue,
    //       "Case 1[Action]: Alice buy 100 Tickets with MoonCoin again"
    //     );
    //     try {
    //       await client.generateSignSubmitWaitForTransaction(Alice, new TransactionPayloadEntryFunction(
    //         EntryFunction.natural(
    //           `${mainAccount.address()}::raffle_test_1`,
    //           "enter",
    //           [new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(`${coin1.address()}::${coinName1}::${coinName1}`))],
    //           [
    //             BCS.bcsToBytes(AccountAddress.fromHex(Bob.address())),
    //             BCS.bcsSerializeUint64(Number(0)),
    //             BCS.bcsSerializeUint64(Number(100))
    //           ]
    //         )), { checkSuccess: true });
    //     } catch (err) {
    //       console.log(err.transaction.vm_status);
    //       errMsg = err.transaction.vm_status;
    //     }
    //     console.log(
    //       logColor.FgRed,
    //       "Case 1[Outcome]: Ticket Purchase Failed cause all ticket sold"
    //     );

    //     console.log(
    //       logColor.FgBlue,
    //       "Case 1[Action]: Charlie trying to resolve the raffle."
    //     );
    //     try {
    //       await client.generateSignSubmitWaitForTransaction(Charlie, new TransactionPayloadEntryFunction(
    //         EntryFunction.natural(
    //           `${mainAccount.address()}::raffle_test_1`,
    //           "resolve",
    //           [new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(`${coin1.address()}::${coinName1}::${coinName1}`))],
    //           [
    //             BCS.bcsToBytes(AccountAddress.fromHex(Bob.address())),
    //             BCS.bcsSerializeUint64(Number(0)),
    //           ]
    //         )), { checkSuccess: true });
    //     } catch (err) {
    //       console.log(err.transaction.vm_status);
    //       errMsg = err.transaction.vm_status;
    //     }
    //     console.log(
    //       logColor.FgRed,
    //       "Case 1[Outcome]: Raffle Resolution failed cause Charlie is neither Contract Owner nor Raffle Creator."
    //     );

    //     console.log(
    //       logColor.FgBlue,
    //       "Case 1[Action]: Main Account trying to resolve the raffle."
    //     );
    //     try {
    //       await client.generateSignSubmitWaitForTransaction(mainAccount, new TransactionPayloadEntryFunction(
    //         EntryFunction.natural(
    //           `${mainAccount.address()}::raffle_test_1`,
    //           "resolve",
    //           [new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(`${coin1.address()}::${coinName1}::${coinName1}`))],
    //           [
    //             BCS.bcsToBytes(AccountAddress.fromHex(Bob.address())),
    //             BCS.bcsSerializeUint64(Number(0)),
    //           ]
    //         )), { checkSuccess: true });
    //     } catch (err) {
    //       console.log(err.transaction.vm_status);
    //       console.log(err.transaction.hash);
    //       errMsg = err.transaction.vm_status;
    //     }
    //     console.log(
    //       logColor.FgGreen,
    //       "Case 1[Outcome]: Raffle Resolution succeed."
    //     );

    //     console.log(
    //       logColor.FgBlue,
    //       "Case 1[Action]: Alice trying to claim token."
    //     );
    //     try {
    //       await client.generateSignSubmitWaitForTransaction(Alice, new TransactionPayloadEntryFunction(
    //         EntryFunction.natural(
    //           `${mainAccount.address()}::raffle_test_1`,
    //           "claim_token",
    //           [new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(`${coin1.address()}::${coinName1}::${coinName1}`))],
    //           [
    //             BCS.bcsToBytes(AccountAddress.fromHex(Bob.address())),
    //             BCS.bcsSerializeUint64(Number(0)),
    //           ]
    //         )), { checkSuccess: true });
    //     } catch (err) {
    //       console.log(err.transaction.vm_status);
    //       console.log(err.transaction.hash);
    //       errMsg = err.transaction.vm_status;
    //     }

    //     console.log(
    //       logColor.FgBlue,
    //       "Case 1[Action]: Bob trying to claim token."
    //     );
    //     try {
    //       await client.generateSignSubmitWaitForTransaction(Bob, new TransactionPayloadEntryFunction(
    //         EntryFunction.natural(
    //           `${mainAccount.address()}::raffle_test_1`,
    //           "claim_token",
    //           [new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(`${coin1.address()}::${coinName1}::${coinName1}`))],
    //           [
    //             BCS.bcsToBytes(AccountAddress.fromHex(Bob.address())),
    //             BCS.bcsSerializeUint64(Number(0)),
    //           ]
    //         )), { checkSuccess: true });
    //     } catch (err) {
    //       console.log(err.transaction.vm_status);
    //       console.log(err.transaction.hash);
    //       errMsg = err.transaction.vm_status;
    //     }

    //     console.log(
    //       logColor.FgBlue,
    //       "Case 1[Action]: Charlie trying to claim token."
    //     );
    //     try {
    //       await client.generateSignSubmitWaitForTransaction(Charlie, new TransactionPayloadEntryFunction(
    //         EntryFunction.natural(
    //           `${mainAccount.address()}::raffle_test_1`,
    //           "claim_token",
    //           [new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(`${coin1.address()}::${coinName1}::${coinName1}`))],
    //           [
    //             BCS.bcsToBytes(AccountAddress.fromHex(Bob.address())),
    //             BCS.bcsSerializeUint64(Number(0)),
    //           ]
    //         )), { checkSuccess: true });
    //     } catch (err) {
    //       console.log(err.transaction.vm_status);
    //       console.log(err.transaction.hash);
    //       errMsg = err.transaction.vm_status;
    //     }

    //     // await wait(20);
  });
})
