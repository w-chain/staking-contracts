import { ethers } from "hardhat";
import { Staking } from "../types/Staking";

const STAKING_CONTRACT_ADDRESS = process.env.STAKING_CONTRACT_ADDRESS ?? "";
// Get stake amount from command line argument
const stakeArg = process.argv[2];
if (!stakeArg) {
  console.log("No stake amount provided, using default of 1 ETH");
}
try {
  const STAKE_AMOUNT = ethers.utils.parseEther(stakeArg || "1");
} catch (error) {
  console.error("Invalid stake amount provided. Please provide a valid number.");
  process.exit(1);
}

async function main() {
  const [account] = await ethers.getSigners();

  console.log(
    `Stake: address=${STAKING_CONTRACT_ADDRESS}, account=${account.address}`
  );
  console.log(`Account balance: ${(await account.getBalance()).toString()}`);

  const stakingContract = (await ethers.getContractAt(
    "Staking",
    STAKING_CONTRACT_ADDRESS,
    account
  )) as Staking;

  const tx = await stakingContract.stake({ value: STAKE_AMOUNT });
  const receipt = await tx.wait();

  console.log("Staked", tx.hash, receipt);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
