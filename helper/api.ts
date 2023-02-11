import assert from "assert";
import fs from "fs";
import path from "path";
import { execSync } from "child_process";


import { TxnBuilderTypes, HexString, BCS, AptosAccount } from "aptos";

import { mainAccount, client, faucetClient, tokenClient, coinClient, logColor, getBalance, disableLogger, enableLogger, aptosCoinStore } from "./config";

const {
  AccountAddress,
  EntryFunction,
  TransactionPayloadEntryFunction,
} = TxnBuilderTypes;

export const PublishContracts = async () => {
  console.log(logColor.FgMagenta, `In ${mainAccount.address()}, Raffle Contract Compiling...`);
  disableLogger();
  execSync(`aptos move compile --package-dir ./ --save-metadata --named-addresses GameDeployer=${mainAccount.address()}`);
  enableLogger();

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
}

export const AppendCollectionName = async (collectionName: string) => {
  console.log(
    logColor.FgGreen,
    `Register ${collectionName} as Verified in the Raffle Contract...`
  );
  try {
    await client.generateSignSubmitWaitForTransaction(mainAccount, new TransactionPayloadEntryFunction(
      EntryFunction.natural(
        `${mainAccount.address()}::game`,
        "append_collection_name",
        [],
        [
          BCS.bcsSerializeStr(collectionName),
        ]
      )
    ), { checkSuccess: true });
  } catch (err) {
    console.log(logColor.FgRed, err.transaction.vm_status);
  }
}

export const CreateGame = async (alice: AptosAccount, gameType: number, ticketPrice: number, delayTime: number, endTime: number) => {
  console.log(logColor.FgGreen, "Case 1[Outcome]: Raffle Creating ...");
  try {
    await client.generateSignSubmitWaitForTransaction(alice, new TransactionPayloadEntryFunction(
      EntryFunction.natural(
        `${mainAccount.address()}::game`,
        "create_Game",
        [],
        [
          BCS.bcsSerializeUint64(Number(gameType)),
          BCS.bcsSerializeUint64(Number(ticketPrice)),
          BCS.bcsSerializeUint64(Number(delayTime)),
          BCS.bcsSerializeUint64(Number(endTime))
        ]
      )), { checkSuccess: true });
    console.log(logColor.FgGreen, "Case 1[Outcome]: Raffle Creation Succeed");
  } catch (err) {
    console.log(logColor.FgYellow, err.transaction.vm_status);
    console.log(logColor.FgRed, "Case 1[Outcome]: Raffle Creation Failed");
  }
}

export const ActiveGame = async (alice: AptosAccount, gameId: number) => {
  try {
    await client.generateSignSubmitWaitForTransaction(alice, new TransactionPayloadEntryFunction(
      EntryFunction.natural(
        `${mainAccount.address()}::game`,
        "set_active",
        [new TxnBuilderTypes.TypeTagStruct(TxnBuilderTypes.StructTag.fromString(aptosCoinStore))],
        [
          BCS.bcsToBytes(AccountAddress.fromHex(alice.address())),
          BCS.bcsSerializeUint64(Number(gameId))
        ]
      )), { checkSuccess: true });
    console.log(logColor.FgGreen, "Case 1[Outcome]: Raffle Creation Succeed");

  } catch (err) {
    console.log(err);
    console.log(logColor.FgRed, "Case 1[Outcome]: Raffle Creation Failed");
  }
}

export const Attack = async (
  alice: AptosAccount,
  gameId: number,
  creator1: string,
  collection1: string,
  token1: string,
  property_version1: string,
  creator2: string,
  collection2: string,
  token2: string,
  property_version2: string
) => {
  console.log(logColor.FgCyan, "Case 1[Outcome]: Alice is attacking  ...");
  try {
    await client.generateSignSubmitWaitForTransaction(alice, new TransactionPayloadEntryFunction(
      EntryFunction.natural(
        `${mainAccount.address()}::game`,
        "attack",
        [],
        [
          BCS.bcsSerializeUint64(Number(gameId)),
          BCS.bcsToBytes(AccountAddress.fromHex(creator1)),
          BCS.bcsSerializeStr(collection1),
          BCS.bcsSerializeStr(token1),
          BCS.bcsSerializeUint64(Number(property_version1)),
          BCS.bcsToBytes(AccountAddress.fromHex(creator2)),
          BCS.bcsSerializeStr(collection2),
          BCS.bcsSerializeStr(token2),
          BCS.bcsSerializeUint64(Number(property_version2)),
        ]
      )), { checkSuccess: true });
    console.log(logColor.FgGreen, "Case 1[Outcome]: Attacking Succeed");

  } catch (err) {
    console.log(logColor.FgMagenta, err.transaction.vm_status);
    console.log(logColor.FgRed, "Case 1[Outcome]: Attacking Failed");
  }
}


