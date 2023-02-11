import { mainAccount, Alice } from "./config";
import { PublishContracts, AppendCollectionName, CreateGame, ActiveGame, Attack } from "./api";

const now = Math.floor(Date.now() / 1000);

const main = async () => {

  // await PublishContracts();

  // await AppendCollectionName("0x938429c92f2fa262fa7688610c3f506e1f0e6f28dcc744f97fc19a7ac3473d1e's test_1 collection");

  // await AppendCollectionName("Martian Testnet36228");
  await AppendCollectionName("Martian Testnet87831");

  // CreateGame(mainAccount, 1, 1000000, 3600 * 3, now + 7200);

  // ActiveGame(mainAccount, 0);

  // Attack(
  //   Alice,
  //   0,
  //   "0x2b0ad89a078d8bb37516107afe35be905336b1fbffe299544945c427c73b957f",
  //   "Martian Testnet36418",
  //   "Martian NFT #36418",
  //   "0",
  //   "0x938429c92f2fa262fa7688610c3f506e1f0e6f28dcc744f97fc19a7ac3473d1e",
  //   "Martian Testnet62366",
  //   "Martian NFT #62366",
  //   "0"
  // )
}

main();