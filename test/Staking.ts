import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { BigNumber } from "ethers";
import { expect } from "chai";
import { Staking } from "../types/Staking";

describe("Staking contract deployment", async () => {
  it("Min validators should not be greater than max validators number", async function () {
    const contractFactory = await ethers.getContractFactory("Staking");
    await expect(contractFactory.deploy(7, 6)).to.be.revertedWith(
      "Min validators num can not be greater than max num of validators"
    );
  });
});

describe("Staking and Unstaking", function () {
  const MinValidatorCount = 4;
  const MaxValidatorCount = 6;
  const VALIDATOR_THRESHOLD = ethers.utils.parseEther("10000000");

  const stake = async (account: SignerWithAddress, amount: BigNumber) => {
    return contract.connect(account).stake({ value: amount });
  };

  let accounts: SignerWithAddress[];
  let contract: Staking;
  beforeEach(async () => {
    accounts = await ethers.getSigners();

    const contractFactory = await ethers.getContractFactory("Staking");
    contract = (await contractFactory.deploy(
      MinValidatorCount,
      MaxValidatorCount
    )) as Staking;
    await contract.deployed();
    contract = contract.connect(accounts[0]);
  });

  describe("default", () => {
    it("staked amount should be zero", async () => {
      expect(await contract.stakedAmount()).to.eq(0);
    });

    it("validators should be empty", async () => {
      expect(await contract.validators()).to.be.empty;
    });

    it("isValidator should return false for non-validator", async () => {
      expect(await contract.isValidator(accounts[0].address)).to.be.false;
    });

    it("accountStake should return zero for non-staker", async () => {
      expect(await contract.accountStake(accounts[0].address)).to.equal(0);
    });

    it("minimumNumValidators should be 4", async () => {
      expect(await contract.minimumNumValidators()).to.equal(4);
    });

    it("maximumNumValidators should be 6", async () => {
      expect(await contract.maximumNumValidators()).to.equal(6);
    });
  });

  describe("Stake", () => {
    const value = VALIDATOR_THRESHOLD;

    it("should increase stakedAmount if account send value to contract", async () => {
      await expect(() => contract.stake({ value })).to.changeEtherBalances(
        [accounts[0], contract],
        [value.mul("-1"), value]
      );

      expect(await contract.accountStake(accounts[0].address)).to.equal(value);
    });

    it("should emit Staked event", async () => {
      await expect(contract.stake({ value }))
        .to.emit(contract, "Staked")
        .withArgs(accounts[0].address, value);
    });

    it("should append to validator set if the account has staked enough amount", async () => {
      await contract.stake({ value });

      expect(await contract.validators()).to.include(accounts[0].address);
      expect(await contract.isValidator(accounts[0].address)).to.be.true;
    });

    it("shouldn't append new validator if the account has not staked enough amount", async () => {
      const value = ethers.utils.parseEther("0.5");
      await contract.stake({ value });

      expect(await contract.validators()).not.to.include(accounts[0].address);
      expect(await contract.isValidator(accounts[0].address)).to.be.false;
    });

    it("should reach full validator set capacity", async () => {
      await Promise.all(
        accounts.slice(0, MaxValidatorCount).map((account) => 
          stake(account, value)
        )
      );

      await expect(stake(accounts[MaxValidatorCount], value))
        .to.be.revertedWith("Validator set has reached full capacity");
    });

    it("should be able to stake from staker account", async () => {
      await Promise.all(
        accounts.slice(0, 6).map((account) => 
          stake(account, value)
        )
      );

      await expect(stake(accounts[0], value))
        .to.emit(contract, "Staked")
        .withArgs(accounts[0].address, value);
    });
  });

  describe("Stake by transfer", () => {
    const value = VALIDATOR_THRESHOLD;

    it("should increase stakedAmount if account send value to contract", async () => {
      await expect(() =>
        accounts[0].sendTransaction({
          from: accounts[0].address,
          to: contract.address,
          value: value,
        })
      ).to.changeEtherBalances([accounts[0], contract], [value.mul("-1"), value]);

      expect(await contract.accountStake(accounts[0].address)).to.equal(value);
    });

    it("should emit Staked event", async () => {
      await expect(
        accounts[0].sendTransaction({
          from: accounts[0].address,
          to: contract.address,
          value: value,
        })
      )
        .to.emit(contract, "Staked")
        .withArgs(accounts[0].address, value);
    });

    it("should append to validator set", async () => {
      await accounts[0].sendTransaction({
        from: accounts[0].address,
        to: contract.address,
        value: value,
      });

      expect(await contract.validators()).to.include(accounts[0].address);
      expect(await contract.isValidator(accounts[0].address)).to.be.true;
    });
  });

  describe("Unstake", () => {
    const numInitialValidators = 5;
    const stakedAmount = VALIDATOR_THRESHOLD;

    beforeEach(async () => {
      await Promise.all(
        accounts
          .slice(0, numInitialValidators)
          .map((account) => stake(account, stakedAmount))
      );
    });

    it("should failed if an account is not a staker", async () => {
      await expect(
        contract.connect(accounts[numInitialValidators]).unstake()
      ).to.be.revertedWith("Only staker can call function");
    });

    it("should fail to unstake if current validator number equals to the min validator number", async () => {
      await contract.connect(accounts[1]).unstake();
      await expect(await contract.validators()).to.have.length(
        MinValidatorCount
      );

      await expect(contract.connect(accounts[0]).unstake()).to.be.revertedWith(
        "Validators can't be less than the minimum required validator num"
      );

      expect(await contract.isValidator(accounts[0].address)).to.be.true;
      expect(await contract.accountStake(accounts[0].address)).to.equal(
        stakedAmount
      );
    });

    it("should succeed and refund the staked balance for non-validator", async () => {
      await contract.connect(accounts[1]).unstake();
      await expect(await contract.validators()).to.have.length(
        MinValidatorCount
      );

      const newStaker = accounts[numInitialValidators];
      const newStakerStakeAmount = ethers.utils.parseEther("0.5");
      await stake(newStaker, newStakerStakeAmount);
      await expect(await contract.validators()).to.have.length(
        MinValidatorCount
      );

      await expect(contract.connect(newStaker).unstake())
        .to.emit(contract, "Unstaked")
        .withArgs(newStaker.address, newStakerStakeAmount);

      await expect(await contract.validators()).to.have.length(
        MinValidatorCount
      );
    });

    it("should succeed and refund the staked balance", async () => {
      await expect(() => contract.unstake()).to.changeEtherBalances(
        [accounts[0], contract],
        [stakedAmount, stakedAmount.mul("-1")]
      );

      expect(await contract.accountStake(accounts[0].address)).to.equal(0);
    });

    it("should succeed and emit Unstaked event", async () => {
      await expect(contract.unstake())
        .to.emit(contract, "Unstaked")
        .withArgs(accounts[0].address, stakedAmount);
    });

    it("should remove account from validators", async () => {
      await contract.unstake();
      expect(await contract.validators())
        .to.have.length(numInitialValidators - 1)
        .not.to.include(accounts[0].address);

      expect(await contract.isValidator(accounts[0].address)).to.be.false;
    });

    it("should exchange between 2 addresses in validators when contract remove validator in the middle of array", async () => {
      const initialValidators = await contract.validators();
      expect(initialValidators)
        .to.have.length(numInitialValidators)
        .and.to.deep.equal([
          accounts[0].address,
          accounts[1].address,
          accounts[2].address,
          accounts[3].address,
          accounts[4].address,
        ]);

      await contract.unstake();
      const updatedValidators = await contract.validators();
      expect(updatedValidators)
        .to.have.length(numInitialValidators - 1)
        .and.to.deep.equal([
          accounts[4].address,
          accounts[1].address,
          accounts[2].address,
          accounts[3].address,
        ]);
    });

    it("should be able to accept a new validator after the last one has unstaked", async () => {
      await Promise.all(
        accounts.slice(0, MaxValidatorCount).map((account) => 
          stake(account, stakedAmount)
        )
      );

      await contract.connect(accounts[0]).unstake();

      await expect(stake(accounts[MaxValidatorCount], stakedAmount))
        .not.to.be.revertedWith("Validator set has reached full capacity");
    });
  });

  describe("Register BLS Public Key", () => {
    it("should succeed and register BLS Public Key", async () => {
      const data = "0x12345678";
      const tx = contract.connect(accounts[0]).registerBLSPublicKey(data);

      await expect(tx)
        .to.emit(contract, "BLSPublicKeyRegistered")
        .withArgs(accounts[0].address, data);
    });
  });

  describe("Get BLS Public Keys", () => {
    const numValidators = 5;
    const stakedAmount = VALIDATOR_THRESHOLD;

    beforeEach(async () => {
      const blsPublicKeys = new Array(numValidators).fill(null).map((_, idx) => 
        ethers.utils.hexZeroPad(ethers.utils.hexlify(idx), 32)
      );

      await Promise.all(
        accounts
          .slice(0, numValidators)
          .map((account) => stake(account, stakedAmount))
      );

      await Promise.all(
        accounts
          .slice(0, numValidators)
          .map((account, i) => contract.connect(account).registerBLSPublicKey(blsPublicKeys[i]))
      );
    });

    it("should return only the BLS Public Keys of Validators", async () => {
      const blsPublicKeys = new Array(numValidators).fill(null).map((_, idx) => 
        ethers.utils.hexZeroPad(ethers.utils.hexlify(idx), 32)
      );

      const keys = await contract.validatorBLSPublicKeys();
      expect(keys)
        .to.have.length(numValidators)
        .and.to.deep.equal(blsPublicKeys);
    });
  });
});
