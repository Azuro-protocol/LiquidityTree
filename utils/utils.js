const { BigNumber } = require("@ethersproject/bignumber");

function timeout(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function tokens(val) {
  return BigInt(val) * 10n ** 18n;
}

function tokensDec(val, dec) {
  return BigInt(val) * 10n ** BigInt(dec);
}

async function timeShift(time) {
  await network.provider.send("evm_setNextBlockTimestamp", [time]);
  await network.provider.send("evm_mine");
}

async function newBlock() {
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

const getNodeAmount = async (sTree, node) => {
  return (await sTree.treeNode(node)).amount;
};

const prepareTree = async (ethers, leafs) => {
  const LIQUIDITYTREE = await ethers.getContractFactory("LiquidityProtocol");
  let tree = await LIQUIDITYTREE.deploy(leafs);
  await tree.waitForDeployment();
  return tree;
};

const getWithdrawnAmount = async (contract, tx) => {
  await tx.wait();
  const events = await contract.queryFilter(contract.filters.withdrawn, -1);
  await newBlock(); // mine new block for correctly getting events (every withdraw transaction at new block)
  return events[0].transactionHash == tx.hash ? events[0].args[1] : 0n;
};

module.exports = {
  timeout,
  tokens,
  tokensDec,
  timeShift,
  newBlock,
  getGas,
  getBlockTime,
  getNodeAmount,
  prepareTree,
  getWithdrawnAmount,
};
