const { BigNumber } = require("@ethersproject/bignumber");

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tokens(val) {
  return BigNumber.from(val).mul(BigNumber.from("10").pow(18)).toString();
}

function tokensDec(val, dec) {
  return BigNumber.from(val).mul(BigNumber.from("10").pow(dec)).toString();
}

async function timeShift(time) {
  await network.provider.send("evm_setNextBlockTimestamp", [time]);
  await network.provider.send("evm_mine");
}

async function getGas(hash) {
  return (await ethers.provider.getTransactionReceipt(hash)).gasUsed.toString();
}

async function getBlockTime(ethers) {
  const blockNumBefore = await ethers.provider.getBlockNumber();
  const blockBefore = await ethers.provider.getBlock(blockNumBefore);
  const time = blockBefore.timestamp;
  return time;
}

module.exports = {
  timeout,
  tokens,
  tokensDec,
  timeShift,
  getGas,
  getBlockTime
};
