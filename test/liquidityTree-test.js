const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { LogDescription } = require("ethers/lib/utils");
const { ethers } = require("hardhat");
const { tokens, getNodeAmount, prepareTree, getWithdrawnAmount } = require("../utils/utils");

const TOKENS_300 = tokens(300);
const TOKENS_270 = tokens(270);
const TOKENS_200 = tokens(200);
const TOKENS_190 = tokens(190);
const TOKENS_100 = tokens(100);
const TOKENS_80 = tokens(80);
const TOKENS_50 = tokens(50);
const TOKENS_45 = tokens(45);
const TOKENS_40 = tokens(40);
const TOKENS_30 = tokens(30);
const TOKENS_20 = tokens(20);
const TOKENS_10 = tokens(10);
const TOKENS_5 = tokens(5);
const ZERO = tokens(0);
const BIG_TREE_LEAFS = 1_099_511_627_776;
2_199_023_255_564;
const SMALL_TREE_LEAFS = 16;
const MIDDLE_TREE_LEAFS = 8;
const TINY_TREE_LEAFS = 2;
const EXAMPLE_TREE_LEAFS = 4;
const WITHDRAW_100_PERCENT = 10 ** 12;

const checkNodeAmountTo = async (sTree, nodeNumber, tokens) => {
  expect(await getNodeAmount(sTree, nodeNumber)).to.be.equal(tokens);
};

describe("LiquidityTree", () => {
  let sTree, firstLeaf;
  describe("Big tree", async () => {
    beforeEach(async () => {
      sTree = await prepareTree(ethers, BIG_TREE_LEAFS);
      firstLeaf = await sTree.nextNode();
    });
    it("100 zero profit distributions on 100 leaves", async () => {
      for (const iterator of Array(100).keys()) {
        await sTree.nodeAddLiquidity(TOKENS_100);
      }
      let lastFilledLeaf = (await sTree.nextNode()) - 1;

      // cycle of 100 "getting liquidity"/"distribution zero"
      for (const iterator of Array(100).keys()) {
        // get 100 for game
        await sTree.remove(TOKENS_100);

        // distribute back 100, zero profit
        await sTree.addLimit(TOKENS_100, lastFilledLeaf);
      }

      expect(await sTree.nodeWithdrawView(lastFilledLeaf)).to.be.equal(TOKENS_100);
      expect(await getWithdrawnAmount(await sTree.nodeWithdraw(lastFilledLeaf))).to.be.equal(TOKENS_100);
    });
    it("Add huge amounts >300mln leaves, some adds/removes, multiple small nodeAddLiquidity/nodeWithraw, and adds/removes again", async () => {
      await sTree.nodeAddLiquidity(tokens(1));
      await sTree.nodeWithdraw((await sTree.nextNode()) - 1);
      await sTree.nodeAddLiquidity(tokens(600_000_000));
      for (const iterator of Array(10).keys()) {
        for (const iterator of Array(10).keys()) {
          await sTree.addLimit(tokens(10), (await sTree.nextNode()) - 1);
          await sTree.nodeAddLiquidity(tokens(1));
          await sTree.addLimit(tokens(10), (await sTree.nextNode()) - 1);
          await sTree.nodeWithdraw((await sTree.nextNode()) - 1);
          await sTree.addLimit(tokens(10), (await sTree.nextNode()) - 1);
        }

        for (const iterator of Array(10).keys()) {
          await sTree.addLimit(tokens(10), (await sTree.nextNode()) - 1);
          await sTree.nodeAddLiquidity(tokens(1));
          await sTree.addLimit(tokens(10), (await sTree.nextNode()) - 1);
          await sTree.nodeWithdrawPercent((await sTree.nextNode()) - 1, 500000000000); // 50%
          await sTree.addLimit(tokens(10), (await sTree.nextNode()) - 1);
        }
      }

      for (const iterator of Array(39).keys()) {
        await sTree.nodeAddLiquidity(tokens(1));
        await sTree.nodeWithdrawPercent((await sTree.nextNode()) - 1, 1000000000000); // 100%
      }
      await sTree.remove(tokens(1000));

      for (const iterator of Array(19).keys()) {
        await sTree.nodeAddLiquidity(tokens(1));
        await sTree.nodeWithdrawPercent((await sTree.nextNode()) - 1, 1000000000000); // 100%
      }
      await sTree.remove(tokens(1000));

      for (const iterator of Array(9).keys()) {
        await sTree.nodeAddLiquidity(tokens(1));
        await sTree.nodeWithdrawPercent((await sTree.nextNode()) - 1, 1000000000000); // 100%
      }
      await sTree.remove(tokens(1000));
      await sTree.removeLimit(tokens(10), (await sTree.nextNode()) - 1);
    });
    describe("add 1000, get 100", async () => {
      let lastFilledLeaf, initLiquidity;
      beforeEach(async () => {
        // initial deposites
        for (const iterator of Array(100).keys()) {
          await sTree.nodeAddLiquidity(TOKENS_100);
        }
        lastFilledLeaf = (await sTree.nextNode()) - 1;
        initLiquidity = (await sTree.treeNode(1)).amount;

        // get 100 for the "game"
        await sTree.remove(TOKENS_100);
      });
      it("return 200 profit: 100 back + 100 distribution on 100 leaves, finally 101 on each leaf", async () => {
        // return 200 from game result
        await sTree.addLimit(TOKENS_200, lastFilledLeaf);

        let totalWitdrawn = BigNumber.from(0);
        for (const i of Array(100).keys()) {
          totalWitdrawn = totalWitdrawn.add(
            BigNumber.from(await getWithdrawnAmount(await sTree.nodeWithdraw(firstLeaf + i)))
          );
        }

        // all withdrawn
        expect((await sTree.treeNode(1)).amount).to.be.equal(0);
        // withdrawn sum is all deposited + distributed 100
        expect(totalWitdrawn).to.be.equal(initLiquidity.add(TOKENS_100));
      });
      it("return 10 profit: distribute -90 on 100 leaves, finally 99.10 on each leaf", async () => {
        // return 10 from game result, actual distributing -90 loss
        await sTree.addLimit(tokens(10), lastFilledLeaf);

        let totalWitdrawn = BigNumber.from(0);
        for (const i of Array(100).keys()) {
          totalWitdrawn = totalWitdrawn.add(
            BigNumber.from(await getWithdrawnAmount(await sTree.nodeWithdraw(firstLeaf + i)))
          );
        }

        // all withdrawn
        expect((await sTree.treeNode(1)).amount).to.be.equal(0);
        // withdrawn sum is all deposited - distributed 90 loss
        expect(totalWitdrawn).to.be.equal(initLiquidity.sub(tokens(90)));
      });
    });
  });
  describe("small tree (16 leaves)", (async) => {
    beforeEach(async () => {
      sTree = await prepareTree(ethers, SMALL_TREE_LEAFS);
    });
    it("add liquidity to 7 leafs, top add 100, withdraw leaf", async () => {
      for (const i of Array(7).keys()) {
        await sTree.nodeAddLiquidity(TOKENS_100);
      }
      /*
        Liquidity tree structure after nodeAddLiquidity:
        +---------------------------------------------------------------------------------------------------------------+
        |                                                                    1(700)                                     |
        +-----------------------------------------------------------------------+---------------------------------------+
        |                                2(700)                                 |                   3                   |
        +-----------------------------------+---------------+-----------------------------------------------------------+
        |              4(400)               |              5(300)               |         6         |         7         |
        +-----------------+-----------------+-----------------+-----------------+---------+---------+---------+---------+
        |     8(200)      |     9(200)      |    10(200)      |    11(100)      |    12   |    13   |    14   |    15   |
        +--------+--------+--------+--------+--------+--------+--------+--------+----+----+----+----+----+----+----+----+
        | 16(100)| 17(100)| 18(100)| 19(100)| 20(100)| 21(100)| 22(100)|   23   | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+--------+--------+----+----+----+----+----+----+----+----+
            100    100        100      100      100      100      100 
      */

      expect(await getNodeAmount(sTree, 1)).to.be.equal(tokens(700));
      expect(await getNodeAmount(sTree, 2)).to.be.equal(tokens(700));
      expect(await getNodeAmount(sTree, 4)).to.be.equal(tokens(400));
      expect(await getNodeAmount(sTree, 5)).to.be.equal(tokens(300));
      expect(await getNodeAmount(sTree, 8)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 9)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 10)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 11)).to.be.equal(TOKENS_100);

      await sTree.add(TOKENS_100);
      /*
        Liquidity tree structure after add(TOKENS_100) on top 1:
        +--------------------------------------------------------------------------------------------------------------------+
        |                                                                         1(800)                                     |
        +----------------------------------------------------------------------------+---------------------------------------+
        |                                2(800)                                      |                   3                   |
        +-----------------------------------+----------------------------------------+-------------------+-------------------+
        |              4(457.1428)          |               5(342.8571)              |         6         |         7         |
        +-----------------+-----------------+-----------------+----------------------+---------+---------+---------+---------+
        |     8(200)      |     9(200)      |    10(228.5714) |      11(114.2857)    |    12   |    13   |    14   |    15   |
        +--------+--------+--------+--------+--------+--------+-------------+--------+----+----+----+----+----+----+----+----+
        | 16(100)| 17(100)| 18(100)| 19(100)| 20(100)| 21(100)| 22(114.2857)|   23   | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+-------------+--------+----+----+----+----+----+----+----+----+
            100    100        100      100      100      100      100 

        100 tokens been spread for nodes:
        4   - 57.142857142800000000   100 * 400 / (400+300)
        10  - 28.571428571371428571   (100 - 57.1428) * 200 / (200 + 100)
        22  - 14.285714285685714285   (100 - 57.1428) * 100 / (200 + 100)
        57.142857142800000000 + 28.571428571371428571 + 14.285714285685714285 = 99.999999999857142856

      */

      expect((await sTree.treeNode(4)).amount).to.be.equal("457142857142800000000");
      expect((await sTree.treeNode(10)).amount).to.be.equal("228571428571438095238");
      expect((await sTree.treeNode(22)).amount).to.be.equal("114285714285761904762");

      await sTree.nodeWithdraw(16);

      /*
        Liquidity tree structure after nodeWithdraw(16):
        +--------------------------------------------------------------------------------------------------------------------+
        |                                                                         1(700)                                     |
        +----------------------------------------------------------------------------+---------------------------------------+
        |                                2(700)                                      |                   3                   |
        +-----------------------------------+----------------------------------------+-------------------+-------------------+
        |              4(342.8571)          |               5(342.8571)              |         6         |         7         |
        +-----------------+-----------------+-----------------+----------------------+---------+---------+---------+---------+
        |     8(114.2857) |     9(228.5714) |    10(228.5714) |      11(114.2857)    |    12   |    13   |    14   |    15   |
        +--------+--------+--------+--------+--------+--------+-------------+--------+----+----+----+----+----+----+----+----+
        | 16(0)  | 17(100)| 18(100)| 19(100)| 20(100)| 21(100)| 22(114.2857)|   23   | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+-------------+--------+----+----+----+----+----+----+----+----+
                    100        100      100      100      100      100 
        
        withdrawn from leaf 16 114.2857142857

      */

      expect((await sTree.treeNode(4)).amount).to.be.equal("342857142857100000000");
      expect((await sTree.treeNode(8)).amount).to.be.equal("114285714285700000000");
      expect((await sTree.treeNode(9)).amount).to.be.equal("228571428571400000000");
      expect((await sTree.treeNode(16)).amount).to.be.equal("0");
    });
    it("add liquidity to 6 leafs, top add 100", async () => {
      for (const i of Array(6).keys()) {
        await sTree.nodeAddLiquidity(TOKENS_100);
      }
      /*
        Liquidity tree structure after nodeAddLiquidity:
        +---------------------------------------------------------------------------------------------------------------+
        |                                                                    1(600)                                     |
        +-----------------------------------------------------------------------+---------------------------------------+
        |                                2(600)                                 |                   3                   |
        +-----------------------------------+---------------+-----------------------------------------------------------+
        |              4(400)               |              5(200)               |         6         |         7         |
        +-----------------+-----------------+-----------------+-----------------+---------+---------+---------+---------+
        |     8(200)      |     9(200)      |    10(200)      |       11        |    12   |    13   |    14   |    15   |
        +--------+--------+--------+--------+--------+--------+--------+--------+----+----+----+----+----+----+----+----+
        | 16(100)| 17(100)| 18(100)| 19(100)| 20(100)| 21(100)|   22   |   23   | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+--------+--------+----+----+----+----+----+----+----+----+
            100    100        100      100      100      100
      */
      expect(await getNodeAmount(sTree, 1)).to.be.equal(tokens(600));
      expect(await getNodeAmount(sTree, 2)).to.be.equal(tokens(600));
      expect(await getNodeAmount(sTree, 4)).to.be.equal(tokens(400));
      expect(await getNodeAmount(sTree, 5)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 8)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 9)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 10)).to.be.equal(TOKENS_200);

      await sTree.add(TOKENS_100);
      /*
        Liquidity tree structure after add:
        +---------------------------------------------------------------------------------------------------------------+
        |                                                                    1(700)                                     |
        +-----------------------------------------------------------------------+---------------------------------------+
        |                                2(700)                                 |                   3                   |
        +-----------------------------------+-----------------------------------+-------------------+-------------------+
        |              4(466.6666)          |             5(233.3333)           |         6         |         7         |
        +-----------------+-----------------+-----------------+-----------------+---------+---------+---------+---------+
        |     8(200)      |     9(200)      |   10(233.33333) |       11        |    12   |    13   |    14   |    15   |
        +--------+--------+--------+--------+--------+--------+--------+--------+----+----+----+----+----+----+----+----+
        | 16(100)| 17(100)| 18(100)| 19(100)| 20(100)| 21(100)|   22   |   23   | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+--------+--------+----+----+----+----+----+----+----+----+
            100    100        100      100      100      100

        100 tokens been spread for nodes:
        4   - 66.666666666600000000   100 * 400 / (400+200)
        5   - 33.333333333300000000   100 * 200 / (400+200)
        466.666666666600000000 + 233.333333333300000000 = 699.9999999999
      */

      /* for (const i of Array(SMALL_TREE_LEAFS * 2).keys()) {
        console.log(i, (await sTree.treeNode(i)).amount.toString());
      } */
      expect((await sTree.treeNode(4)).amount).to.be.equal("466666666666600000000");
      expect((await sTree.treeNode(10)).amount).to.be.equal("233333333333400000000");
      expect((await sTree.treeNode(22)).amount).to.be.equal("0");
    });
    it("add liquidity to 7 leafs, top remove 100, withdraw leaf #1 add for 7 leaves", async () => {
      for (const i of Array(7).keys()) {
        await sTree.nodeAddLiquidity(TOKENS_100);
      }
      /*
        Liquidity tree structure after nodeAddLiquidity:
        +---------------------------------------------------------------------------------------------------------------+
        |                                                                    1(700)                                     |
        +-----------------------------------------------------------------------+---------------------------------------+
        |                                2(700)                                 |                   3                   |
        +-----------------------------------+-----------------------------------+---------------------------------------+
        |              4(400)               |              5(300)               |         6         |         7         |
        +-----------------+-----------------+-----------------+-----------------+---------+---------+---------+---------+
        |     8(200)      |     9(200)      |    10(200)      |    11(100)      |    12   |    13   |    14   |    15   |
        +--------+--------+--------+--------+--------+--------+--------+--------+----+----+----+----+----+----+----+----+
        | 16(100)| 17(100)| 18(100)| 19(100)| 20(100)| 21(100)| 22(100)|   23   | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+--------+--------+----+----+----+----+----+----+----+----+
            100    100        100      100      100      100      100 
      */

      expect(await getNodeAmount(sTree, 1)).to.be.equal(tokens(700));
      expect(await getNodeAmount(sTree, 2)).to.be.equal(tokens(700));
      expect(await getNodeAmount(sTree, 4)).to.be.equal(tokens(400));
      expect(await getNodeAmount(sTree, 5)).to.be.equal(tokens(300));
      expect(await getNodeAmount(sTree, 8)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 9)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 10)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 11)).to.be.equal(TOKENS_100);

      await sTree.remove(TOKENS_100);

      /*
        Liquidity tree structure after remove(100):
        +-------------------------------------------------------------------------------------------------------------------+
        |                                                                        1(600)                                     |
        +---------------------------------------------------------------------------+---------------------------------------+
        |                                2(600)                                     |                   3                   |
        +-----------------------------------+---------------------------------------+---------------------------------------+
        |              4(342.8571)          |              5(257.1428)              |         6         |         7         |
        +-----------------+-----------------+-----------------+---------------------+---------+---------+---------+---------+
        |     8(200)      |     9(200)      |    10(171.4285) |       11(85.7142)   |    12   |    13   |    14   |    15   |
        +--------+--------+--------+--------+--------+--------+------------+--------+----+----+----+----+----+----+----+----+
        | 16(100)| 17(100)| 18(100)| 19(100)| 20(100)| 21(100)| 22(85.7142)|   23   | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+------------+--------+----+----+----+----+----+----+----+----+
            100    100        100      100      100      100         100 

        100 tokens been removed for nodes:
        1   600 = 700 - 100
        2   600 = 700 - 100
        4   342.8571 = 400 - 57.142857143   (100 * 400 / (400+300))
        5   257.1428 = 300 - 42.857142857   (100 * 300 / (400+300))
        10  171.4285 = 200 - 42.857142857 * 200 / (200+100)
        11   85.7142 = 100 - 42.857142857 * 100 / (200+100)
      */

      expect(await getNodeAmount(sTree, 1)).to.be.equal(tokens(600));
      expect(await getNodeAmount(sTree, 2)).to.be.equal(tokens(600));
      expect(await getNodeAmount(sTree, 4)).to.be.equal("342857142857200000000");
      expect(await getNodeAmount(sTree, 5)).to.be.equal("257142857142800000000");
      expect(await getNodeAmount(sTree, 8)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 9)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 10)).to.be.equal("171428571428561904762");
      expect(await getNodeAmount(sTree, 11)).to.be.equal("85714285714238095238");

      let withdrawPreview = await sTree.nodeWithdrawView(16);
      let tx = await sTree.nodeWithdraw(16);

      /*
        Liquidity tree structure after nodeWithdraw(16):
        +---------------------------------------------------------------------------------------------------------------------+
        |                                                             1(514.2857)                                             |
        +-----------------------------------------------------------------------------+---------------------------------------+
        |                                2(514.2857)                                  |                   3                   |
        +-------------------------------------+---------------------------------------+-------------------+-------------------+
        |              4(257.1428)            |                5(257.1428)            |         6         |         7         |
        +-------------------+-----------------+-----------------+---------------------+---------+---------+---------+---------+
        |     8(85.71428)   |     9(171.4285) |    10(171.4285) |      11(85.7142)    |    12   |    13   |    14   |    15   |
        +------+------------+--------+--------+--------+--------+------------+--------+----+----+----+----+----+----+----+----+
        | 16(0)| 17(85.7128)| 18(100)| 19(100)| 20(100)| 21(100)| 22(85.7142)|   23   | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
        +------+------------+--------+--------+--------+--------+------------+--------+----+----+----+----+----+----+----+----+
                    100        100      100      100      100         100         
        
        85.7142857143 tokens been withdrawn from leaf 16
      */

      expect(await getWithdrawnAmount(tx)).to.be.equal(withdrawPreview); // 85714285714300000000

      // add liquidity
      await sTree.nodeAddLiquidity(TOKENS_100);

      /*
        Liquidity tree structure after nodeAddLiquidity(TOKENS_100):
        +---------------------------------------------------------------------------------------------------------------------+
        |                                                             1(614.2857)                                             |
        +-----------------------------------------------------------------------------+---------------------------------------+
        |                                2(614.2857)                                  |                   3                   |
        +-------------------------------------+---------------------------------------+-------------------+-------------------+
        |              4(257.1428)            |                5(357.1428)            |         6         |         7         |
        +-------------------+-----------------+-----------------+---------------------+---------+---------+---------+---------+
        |      8(85.7142)   |     9(171.4285) |    10(171.4285) |      11(185.7142)   |    12   |    13   |    14   |    15   |
        +------+------------+--------+--------+--------+--------+------------+--------+----+----+----+----+----+----+----+----+
        | 16(0)| 17(85.7128)| 18(100)| 19(100)| 20(100)| 21(100)| 22(85.7142)| 23(100)| 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
        +------+------------+--------+--------+--------+--------+------------+--------+----+----+----+----+----+----+----+----+
                    100        100      100      100      100         100       100 
        
        85.7142857143 tokens been withdrawn from leaf 16
      */

      expect(await getNodeAmount(sTree, 1)).to.be.equal("614285714285700000000");
      expect(await getNodeAmount(sTree, 2)).to.be.equal("614285714285700000000");
      expect(await getNodeAmount(sTree, 4)).to.be.equal("257142857142900000000");
      expect(await getNodeAmount(sTree, 5)).to.be.equal("357142857142800000000");
      expect(await getNodeAmount(sTree, 8)).to.be.equal("85714285714300000000");
      expect(await getNodeAmount(sTree, 9)).to.be.equal("171428571428600000000");
      expect(await getNodeAmount(sTree, 10)).to.be.equal("171428571428561904762");
      expect(await getNodeAmount(sTree, 11)).to.be.equal("185714285714238095238");
      expect(await getNodeAmount(sTree, 23)).to.be.equal(TOKENS_100);

      //addLimit only for leaves [16-22], 23 not included
      await sTree.addLimit(TOKENS_100, 22);

      /*
        Liquidity tree structure after addLimit(100, 22):
        +----------------------------------------------------------------------------------------------------------------------+
        |                                                             1(714.2857)                                              |
        +------------------------------------------------------------------------------+---------------------------------------+
        |                                2(714.2857)                                   |                   3                   |
        +-------------------------------------+----------------------------------------+-------------------+-------------------+
        |              4(307.1428)            |                5(407.1428)             |         6         |         7         |
        +-------------------+-----------------+-----------------+----------------------+---------+---------+---------+---------+
        |     8(85.71428)   |     9(171.4285) |    10(204.7619) |      11(202.3809)    |    12   |    13   |    14   |    15   |
        +------+------------+--------+--------+--------+--------+-------------+--------+----+----+----+----+----+----+----+----+
        | 16(0)| 17(85.7128)| 18(100)| 19(100)| 20(100)| 21(100)| 22(102.3809)| 23(100)| 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
        +------+------------+--------+--------+--------+--------+-------------+--------+----+----+----+----+----+----+----+----+
                    100        100      100      100      100         100       100

        2 changed 614.2857       -> 714.2857
        4 changed 257.1428571429 -> 307.1428571429 by 50.00 
        5 changed 357.1428571429 -> 407.1428571429 by 50.00 (because 357.1428 - 100 = 257.1428)
        23 not changed because it is excluded by addLimit(TOKENS_100, 22)
      */

      expect(await getNodeAmount(sTree, 1)).to.be.equal("714285714285700000000");
      expect(await getNodeAmount(sTree, 2)).to.be.equal("714285714285700000000");
      expect(await getNodeAmount(sTree, 4)).to.be.equal("307142857142900000000");
      expect(await getNodeAmount(sTree, 5)).to.be.equal("407142857142800000000");
      expect(await getNodeAmount(sTree, 8)).to.be.equal("85714285714300000000");
      expect(await getNodeAmount(sTree, 9)).to.be.equal("171428571428600000000");
      expect(await getNodeAmount(sTree, 10)).to.be.equal("204761904761861904762");
      expect(await getNodeAmount(sTree, 11)).to.be.equal("202380952380938095238");
      expect(await getNodeAmount(sTree, 22)).to.be.equal("102380952380938095238");
      expect(await getNodeAmount(sTree, 23)).to.be.equal(TOKENS_100);

      // checksum correctness node = left child + right child
      expect((await getNodeAmount(sTree, 4)).add(await getNodeAmount(sTree, 5))).to.be.equal(
        await getNodeAmount(sTree, 2)
      );
      expect((await getNodeAmount(sTree, 10)).add(await getNodeAmount(sTree, 11))).to.be.equal(
        await getNodeAmount(sTree, 5)
      );
      expect((await getNodeAmount(sTree, 23)).add(await getNodeAmount(sTree, 22))).to.be.equal(
        await getNodeAmount(sTree, 11)
      );
      // check leaves total 17-23 amount equal top node
      expect(await getNodeAmount(sTree, 1)).to.be.eq(
        (await sTree.nodeWithdrawView(23))
          .add(await sTree.nodeWithdrawView(22))
          .add(await sTree.nodeWithdrawView(21))
          .add(await sTree.nodeWithdrawView(20))
          .add(await sTree.nodeWithdrawView(19))
          .add(await sTree.nodeWithdrawView(18))
          .add(await sTree.nodeWithdrawView(17))
          .add(await sTree.nodeWithdrawView(16))
      );

      //addLimit only for leaves [16-22], 23 not included
      let node1amount = await getNodeAmount(sTree, 1);
      let node4amount = await getNodeAmount(sTree, 4);
      let node20amount = await sTree.nodeWithdrawView(20);
      let node21amount = await sTree.nodeWithdrawView(21);
      let node22amount = await sTree.nodeWithdrawView(22);
      let node23amount = await sTree.nodeWithdrawView(23);
      await sTree.addLimit(TOKENS_100, 20);

      /*
        Liquidity tree structure after addLimit(100, 22):
        +----------------------------------------------------------------------------------------------------------------------+
        |                                                             1(814.2857)                                              |
        +------------------------------------------------------------------------------+---------------------------------------+
        |                                2(814.2857)                                   |                   3                   |
        +-------------------------------------+----------------------------------------+-------------------+-------------------+
        |              4(307.1428)            |                5(407.1428)             |         6         |         7         |
        +-------------------+-----------------+-----------------+----------------------+---------+---------+---------+---------+
        |     8(85.71428)   |     9(171.4285) |    10(204.7619) |      11(202.3809)    |    12   |    13   |    14   |    15   |
        +------+------------+--------+--------+--------+--------+-------------+--------+----+----+----+----+----+----+----+----+
        | 16(0)| 17(85.7128)| 18(100)| 19(100)| 20(100)| 21(100)| 22(102.3809)| 23(100)| 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
        +------+------------+--------+--------+--------+--------+-------------+--------+----+----+----+----+----+----+----+----+
                    100        100      100      100      100         100       100

        2 changed 614.2857       -> 714.2857
        4 changed 257.1428571429 -> 307.1428571429 by 50.00 
        5 changed 357.1428571429 -> 407.1428571429 by 50.00 (because 357.1428 - 100 = 257.1428)
        23 not changed because it is excluded by addLimit(TOKENS_100, 22)
      */

      expect(await getNodeAmount(sTree, 1)).to.be.equal(node1amount.add(TOKENS_100));
      expect(await getNodeAmount(sTree, 2)).to.be.equal(node1amount.add(TOKENS_100));
      expect(await getNodeAmount(sTree, 4)).to.be.equal(node4amount.add(tokens(75)));
      expect(await getNodeAmount(sTree, 20)).to.be.equal(node20amount.add(tokens(25)));
      expect(await getNodeAmount(sTree, 21)).to.be.equal(node21amount);
      expect(await getNodeAmount(sTree, 22)).to.be.equal(node22amount);
      expect(await getNodeAmount(sTree, 23)).to.be.equal(TOKENS_100);

      // checksum correctness node = left child + right child
      expect((await getNodeAmount(sTree, 4)).add(await getNodeAmount(sTree, 5))).to.be.equal(
        await getNodeAmount(sTree, 2)
      );
      expect((await getNodeAmount(sTree, 10)).add(await getNodeAmount(sTree, 11))).to.be.equal(
        await getNodeAmount(sTree, 5)
      );
      expect((await getNodeAmount(sTree, 23)).add(await getNodeAmount(sTree, 22))).to.be.equal(
        await getNodeAmount(sTree, 11)
      );
      // check leaves total 17-23 amount equal top node
      expect(await getNodeAmount(sTree, 1)).to.be.eq(
        (await sTree.nodeWithdrawView(23))
          .add(await sTree.nodeWithdrawView(22))
          .add(await sTree.nodeWithdrawView(21))
          .add(await sTree.nodeWithdrawView(20))
          .add(await sTree.nodeWithdrawView(19))
          .add(await sTree.nodeWithdrawView(18))
          .add(await sTree.nodeWithdrawView(17))
          .add(await sTree.nodeWithdrawView(16))
      );
    });
    describe("7 interates with (add liquidity 100 and top remove 100), mixed addLimit", async () => {
      beforeEach(async () => {
        for (const i of Array(3).keys()) {
          await sTree.nodeAddLiquidity(TOKENS_100);
          await sTree.remove(TOKENS_10);
        }
        /*
          Liquidity tree structure after nodeAddLiquidity(TOKENS_100):
          +---------------------------------------------------------------------------------------------------------------------------+
          |                                                                    1(270)                                                 |
          +-----------------------------------------------------------------------------------+---------------------------------------+
          |                                2(270)                                             |                   3                   |
          +---------------------------------------+-------------------------------------------+---------------------------------------+
          |              4(270)                   |                     5                     |         6         |         7         |
          +-----------------+---------------------+---------------------+---------------------+---------+---------+---------+---------+
          |     8(173.5714) |       9(96.4285)    |           10        |           11        |    12   |    13   |    14   |    15   |
          +--------+--------+------------+--------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+
          | 16(90) | 17(100)| 18(96.4285)|   19   |     20     |    21  |      22    |   23   | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
          +--------+--------+------------+--------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+
              100    100          100          
        */
      });
      it("straight addings (liquidity returns)", async () => {
        await sTree.addLimit(tokens(10), 16);
        /*
          Liquidity tree structure after nodeAddLiquidity(TOKENS_100):
          +---------------------------------------------------------------------------------------------------------------------------------+
          |                                                                                   1(280)                                        |
          +-----------------------------------------------------------------------------------------+---------------------------------------+
          |                                      2(280)                                             |                   3                   |
          +---------------------------------------------+-------------------------------------------+---------------------------------------+
          |                    4(280)                   |                     5                     |         6         |         7         |
          +-----------------------+---------------------+---------------------+---------------------+---------+---------+---------+---------+
          |       8(183.5714)     |       9(96.4285)    |           10        |           11        |    12   |    13   |    14   |    15   |
          +-----------+-----------+------------+--------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+
          |16(92.2180)|17(91.3533)| 18(96.4285)|   19   |     20     |    21  |      22    |   23   | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
          +-----------+-----------+------------+--------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+
              
        */

        await sTree.addLimit(tokens(10), 17);

        /*
          Liquidity tree structure after nodeAddLiquidity(TOKENS_100):
          +---------------------------------------------------------------------------------------------------------------------------------+
          |                                                                                   1(290)                                        |
          +-----------------------------------------------------------------------------------------+---------------------------------------+
          |                                      2(290)                                             |                   3                   |
          +---------------------------------------------+-------------------------------------------+---------------------------------------+
          |                    4(290)                   |                     5                     |         6         |         7         |
          +-----------------------+---------------------+---------------------+---------------------+---------+---------+---------+---------+
          |       8(193.5714)     |       9(96.4285)    |           10        |           11        |    12   |    13   |    14   |    15   |
          +-----------+-----------+------------+--------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+
          |16(92.2180)|17(91.3533)| 18(96.4285)|   19   |     20     |    21  |      22    |   23   | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
          +-----------+-----------+------------+--------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+
        */

        await sTree.addLimit(tokens(10), 18);

        /*
          Liquidity tree structure after nodeAddLiquidity(TOKENS_100):
          +---------------------------------------------------------------------------------------------------------------------------------+
          |                                                                                   1(300)                                        |
          +-----------------------------------------------------------------------------------------+---------------------------------------+
          |                                      2(300)                                             |                   3                   |
          +---------------------------------------------+-------------------------------------------+---------------------------------------+
          |                    4(300)                   |                     5                     |         6         |         7         |
          +-----------------------+---------------------+---------------------+---------------------+---------+---------+---------+---------+
          |       8(200.2463)     |       9(99.7536)    |           10        |           11        |    12   |    13   |    14   |    15   |
          +-----------+-----------+------------+--------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+
          |16(92.2180)|17(91.3533)| 18(99.7536)|   19   |     20     |    21  |      22    |   23   | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
          +-----------+-----------+------------+--------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+
        */
        let withdrawView16 = await sTree.nodeWithdrawView(16);
        let withdrawView17 = await sTree.nodeWithdrawView(17);
        let withdrawView18 = await sTree.nodeWithdrawView(18);
        expect(withdrawView16).to.be.equal("100594754698365746841");
        expect(withdrawView17).to.be.equal("99651550720354253159");
        expect(withdrawView18).to.be.equal("99753694581280000000");
        expect(await getWithdrawnAmount(await sTree.nodeWithdraw(16))).to.be.equal(withdrawView16); // "100594754698365746841"
        expect(await getWithdrawnAmount(await sTree.nodeWithdraw(17))).to.be.equal(withdrawView17); // "99651550720354253159");
        expect(await getWithdrawnAmount(await sTree.nodeWithdraw(18))).to.be.equal(withdrawView18); // "99753694581280000000");
      });

      it("reverse addings", async () => {
        await sTree.addLimit(tokens(10), 18);
        /*
          Liquidity tree structure after nodeAddLiquidity(TOKENS_100):
          +---------------------------------------------------------------------------------------------------------------------------+
          |                                                                    1(280)                                                 |
          +-----------------------------------------------------------------------------------+---------------------------------------+
          |                                2(280)                                             |                   3                   |
          +---------------------------------------+-------------------------------------------+---------------------------------------+
          |              4(280)                   |                     5                     |         6         |         7         |
          +-----------------+---------------------+---------------------+---------------------+---------+---------+---------+---------+
          |     8(180)      |         9(100)      |           10        |           11        |    12   |    13   |    14   |    15   |
          +--------+--------+------------+--------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+
          | 16(90) | 17(100)|  18(100)   |   19   |     20     |    21  |      22    |   23   | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
          +--------+--------+------------+--------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+
        */

        await sTree.addLimit(tokens(10), 17);
        /*
          Liquidity tree structure after nodeAddLiquidity(TOKENS_100):
          +------------------------------------------------------------------------------------------------------------------------------------+
          |                                                                             1(290)                                                 |
          +--------------------------------------------------------------------------------------------+---------------------------------------+
          |                                         2(290)                                             |                   3                   |
          +------------------------------------------------+-------------------------------------------+---------------------------------------+
          |                       4(290)                   |                     5                     |         6         |         7         |
          +--------------------------+---------------------+---------------------+---------------------+---------+---------+---------+---------+
          |            8(190)        |         9(100)      |           10        |           11        |    12   |    13   |    14   |    15   |
          +-------------+------------+------------+--------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+
          | 16(85.2631) | 17(94.7368)|  18(100)   |   19   |     20     |    21  |      22    |   23   | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
          +-------------+------------+------------+--------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+
        */

        await sTree.addLimit(tokens(10), 16);
        /*
          Liquidity tree structure after nodeAddLiquidity(TOKENS_100):
          +------------------------------------------------------------------------------------------------------------------------------------+
          |                                                                             1(300)                                                 |
          +--------------------------------------------------------------------------------------------+---------------------------------------+
          |                                         2(300)                                             |                   3                   |
          +------------------------------------------------+-------------------------------------------+---------------------------------------+
          |                       4(300)                   |                     5                     |         6         |         7         |
          +--------------------------+---------------------+---------------------+---------------------+---------+---------+---------+---------+
          |            8(200)        |         9(100)      |           10        |           11        |    12   |    13   |    14   |    15   |
          +-------------+------------+------------+--------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+
          | 16(99.9999) |17(100.0001)|  18(100)   |   19   |     20     |    21  |      22    |   23   | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
          +-------------+------------+------------+--------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+
        */

        let withdrawView17 = await sTree.nodeWithdrawView(17);
        expect(withdrawView17).to.be.equal("100000000000000000001");

        expect(await getWithdrawnAmount(await sTree.nodeWithdraw(17))).to.be.equal(withdrawView17);
        // get 50 % of leaf 18
        expect(await getWithdrawnAmount(await sTree.nodeWithdrawPercent(18, 500000000000))).to.be.equal(TOKENS_50);
        // get rest of leaf 18
        let withdrawView18 = await sTree.nodeWithdrawView(18);
        expect(withdrawView18).to.be.equal(TOKENS_50);
        expect(await getWithdrawnAmount(await sTree.nodeWithdraw(18))).to.be.equal(withdrawView18);

        //check double withdraw
        withdrawView18 = await sTree.nodeWithdrawView(18);
        expect(withdrawView18).to.be.equal(0);
        expect(await getWithdrawnAmount(await sTree.nodeWithdraw(18))).to.be.equal(withdrawView18);

        await sTree.removeLimit(tokens(10), 16);
        /*
          Liquidity tree structure:
          +------------------------------------------------------------------------------------------------------------------------------+
          |                                                                       1(99.9999)                                             |
          +--------------------------------------------------------------------------------------+---------------------------------------+
          |                              2(99.9999)                                              |                   3                   |
          +------------------------------------------+-------------------------------------------+---------------------------------------+
          |                 4(99.9999)               |                     5                     |         6         |         7         |
          +--------------------+---------------------+---------------------+---------------------+---------+---------+---------+---------+
          |     8(99.99)       |           9         |           10        |           11        |    12   |    13   |    14   |    15   |
          +-----------+--------+----------+----------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+
          | 16(99.99) |   17   |    18    |     19   |     20     |    21  |      22    |   23   | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
          +-----------+--------+----------+----------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+
        */
        let winthdrawAmount16 = await sTree.nodeWithdrawView(16);
        expect(winthdrawAmount16).to.be.equal("89999999999999999999");
        expect(await getWithdrawnAmount(await sTree.nodeWithdraw(16))).to.be.equal(winthdrawAmount16);
      });
    });
  });
  describe("small tree (16 leaves) with empty lists", (async) => {
    beforeEach(async () => {
      sTree = await prepareTree(ethers, SMALL_TREE_LEAFS);
    });
    it("add liquidity to 2 leafs, withdraw first leaf, removeLimit first", async () => {
      for (const i of Array(2).keys()) {
        await sTree.nodeAddLiquidity(TOKENS_10);
      }
      /*
        Liquidity tree structure after nodeAddLiquidity:
        +---------------------------------------------------------------------------------------------------------------------------------------------+
        |                                                                     1(20)                                                                   |
        +-----------------------------------------------------------------------+---------------------------------------------------------------------+
        |                                  2(20)                                |                                       3                             |
        +-----------------------------------+---------------+-----------------------------------------------------------+-----------------------------+
        |              4(20)                |                 5                 |                   6                   |                   7         |
        +-----------------+-----------------+-----------------+-----------------+-------------------+-------------------+-------------------+---------+
        |     8(20)       |        9        |       10        |       11        |        12         |        13         |        14         |    15   |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+
        | 16(10) | 17(10) |   18   |    19  |    20  |    21  |    22  |    23  |    24   |    25   |    26   |    27   |    28   |    29   | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+ 
      */

      //expect(await getNodeAmount(sTree, 1)).to.be.equal(TOKENS_20);
      await checkNodeAmountTo(sTree, 1, TOKENS_20);
      await checkNodeAmountTo(sTree, 2, TOKENS_20);
      await checkNodeAmountTo(sTree, 3, ZERO);
      await checkNodeAmountTo(sTree, 4, TOKENS_20);
      await checkNodeAmountTo(sTree, 5, ZERO);
      await checkNodeAmountTo(sTree, 6, ZERO);
      await checkNodeAmountTo(sTree, 7, ZERO);
      await checkNodeAmountTo(sTree, 8, TOKENS_20);
      await checkNodeAmountTo(sTree, 9, ZERO);
      await checkNodeAmountTo(sTree, 10, ZERO);
      await checkNodeAmountTo(sTree, 11, ZERO);
      await checkNodeAmountTo(sTree, 12, ZERO);
      await checkNodeAmountTo(sTree, 13, ZERO);
      await checkNodeAmountTo(sTree, 14, ZERO);
      await checkNodeAmountTo(sTree, 16, TOKENS_10);
      await checkNodeAmountTo(sTree, 17, TOKENS_10);

      // withdraw first leaf
      await sTree.nodeWithdraw(16);
      /*
        Liquidity tree structure after nodeAddLiquidity:
        +---------------------------------------------------------------------------------------------------------------------------------------------+
        |                                                                     1(10)                                                                   |
        +-----------------------------------------------------------------------+---------------------------------------------------------------------+
        |                                  2(10)                                |                                       3                             |
        +-----------------------------------+---------------+-----------------------------------------------------------+-----------------------------+
        |              4(10)                |                 5                 |                   6                   |                   7         |
        +-----------------+-----------------+-----------------+-----------------+-------------------+-------------------+-------------------+---------+
        |     8(10)       |        9        |       10        |       11        |        12         |        13         |        14         |    15   |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+
        | 16(0)  | 17(10) |   18   |    19  |    20  |    21  |    22  |    23  |    24   |    25   |    26   |    27   |    28   |    29   | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+ 
      */

      await checkNodeAmountTo(sTree, 1, TOKENS_10);
      await checkNodeAmountTo(sTree, 2, TOKENS_10);
      await checkNodeAmountTo(sTree, 3, ZERO);
      await checkNodeAmountTo(sTree, 4, TOKENS_10);
      await checkNodeAmountTo(sTree, 5, ZERO);
      await checkNodeAmountTo(sTree, 6, ZERO);
      await checkNodeAmountTo(sTree, 7, ZERO);
      await checkNodeAmountTo(sTree, 8, TOKENS_10);
      await checkNodeAmountTo(sTree, 9, ZERO);
      await checkNodeAmountTo(sTree, 10, ZERO);
      await checkNodeAmountTo(sTree, 11, ZERO);
      await checkNodeAmountTo(sTree, 12, ZERO);
      await checkNodeAmountTo(sTree, 13, ZERO);
      await checkNodeAmountTo(sTree, 14, ZERO);
      await checkNodeAmountTo(sTree, 16, ZERO);
      await checkNodeAmountTo(sTree, 17, TOKENS_10);

      // remove limit with first leaf. Leaf is emty, removing from right leaf's branch
      await sTree.removeLimit(tokens(5), 16);
      /*
        Liquidity tree structure after nodeAddLiquidity:
        +---------------------------------------------------------------------------------------------------------------------------------------------+
        |                                                                     1(5)                                                                    |
        +-----------------------------------------------------------------------+---------------------------------------------------------------------+
        |                                  2(5)                                 |                                       3                             |
        +-----------------------------------+---------------+-----------------------------------------------------------+-----------------------------+
        |              4(5)                 |                 5                 |                   6                   |                   7         |
        +-----------------+-----------------+-----------------+-----------------+-------------------+-------------------+-------------------+---------+
        |     8(5)        |        9        |       10        |       11        |        12         |        13         |        14         |    15   |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+
        | 16(0)  | 17(10) |   18   |    19  |    20  |    21  |    22  |    23  |    24   |    25   |    26   |    27   |    28   |    29   | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+ 
      */

      await checkNodeAmountTo(sTree, 1, TOKENS_5);
      await checkNodeAmountTo(sTree, 2, TOKENS_5);
      await checkNodeAmountTo(sTree, 3, ZERO);
      await checkNodeAmountTo(sTree, 4, TOKENS_5);
      await checkNodeAmountTo(sTree, 5, ZERO);
      await checkNodeAmountTo(sTree, 6, ZERO);
      await checkNodeAmountTo(sTree, 7, ZERO);
      await checkNodeAmountTo(sTree, 8, TOKENS_5);
      await checkNodeAmountTo(sTree, 9, ZERO);
      await checkNodeAmountTo(sTree, 10, ZERO);
      await checkNodeAmountTo(sTree, 11, ZERO);
      await checkNodeAmountTo(sTree, 12, ZERO);
      await checkNodeAmountTo(sTree, 13, ZERO);
      await checkNodeAmountTo(sTree, 14, ZERO);
      await checkNodeAmountTo(sTree, 16, ZERO);
      await checkNodeAmountTo(sTree, 17, TOKENS_10);

      await sTree.removeLimit(tokens(5), 16);
      /*
        Liquidity tree structure after nodeAddLiquidity:
        +---------------------------------------------------------------------------------------------------------------------------------------------+
        |                                                                     1(0)                                                                    |
        +-----------------------------------------------------------------------+---------------------------------------------------------------------+
        |                                  2(0)                                 |                                       3                             |
        +-----------------------------------+---------------+-----------------------------------------------------------+-----------------------------+
        |              4(0)                 |                 5                 |                   6                   |                   7         |
        +-----------------+-----------------+-----------------+-----------------+-------------------+-------------------+-------------------+---------+
        |     8(0)        |        9        |       10        |       11        |        12         |        13         |        14         |    15   |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+
        | 16(0)  | 17(10) |   18   |    19  |    20  |    21  |    22  |    23  |    24   |    25   |    26   |    27   |    28   |    29   | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+ 
      */

      await checkNodeAmountTo(sTree, 1, ZERO);
      await checkNodeAmountTo(sTree, 2, ZERO);
      await checkNodeAmountTo(sTree, 3, ZERO);
      await checkNodeAmountTo(sTree, 4, ZERO);
      await checkNodeAmountTo(sTree, 5, ZERO);
      await checkNodeAmountTo(sTree, 6, ZERO);
      await checkNodeAmountTo(sTree, 7, ZERO);
      await checkNodeAmountTo(sTree, 8, ZERO);
      await checkNodeAmountTo(sTree, 9, ZERO);
      await checkNodeAmountTo(sTree, 10, ZERO);
      await checkNodeAmountTo(sTree, 11, ZERO);
      await checkNodeAmountTo(sTree, 12, ZERO);
      await checkNodeAmountTo(sTree, 13, ZERO);
      await checkNodeAmountTo(sTree, 14, ZERO);
      await checkNodeAmountTo(sTree, 16, ZERO);
      await checkNodeAmountTo(sTree, 17, TOKENS_10);

      expect(await sTree.nodeWithdrawView(17)).to.be.eq(ZERO);
    });
    it("add liquidity to 22 leafs, top add 100, withdraw leaf", async () => {
      for (const i of Array(14).keys()) {
        await sTree.nodeAddLiquidity(TOKENS_100);
      }
      /*
        Liquidity tree structure after nodeAddLiquidity:
        +---------------------------------------------------------------------------------------------------------------------------------------------+
        |                                                                    1(1400)                                                                  |
        +-----------------------------------------------------------------------+---------------------------------------------------------------------+
        |                                2(800)                                 |                                   3(600)                            |
        +-----------------------------------+---------------+-----------------------------------------------------------+-----------------------------+
        |              4(400)               |              5(400)               |                 6(400)                |                 7(200)      |
        +-----------------+-----------------+-----------------+-----------------+-------------------+-------------------+-------------------+---------+
        |     8(200)      |     9(200)      |    10(200)      |    11(200)      |      12(200)      |       13(200)     |       14(200)     |    15   |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+
        | 16(100)| 17(100)| 18(100)| 19(100)| 20(100)| 21(100)| 22(100)| 23(100)| 24(100) | 25(100) | 26(100) | 27(100) | 28(100) | 29(100) | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+
            100    100        100      100      100      100      100      100       100      100       100        100      100      100
      */

      expect(await getNodeAmount(sTree, 1)).to.be.equal(tokens(1400));
      expect(await getNodeAmount(sTree, 2)).to.be.equal(tokens(800));
      expect(await getNodeAmount(sTree, 3)).to.be.equal(tokens(600));
      expect(await getNodeAmount(sTree, 4)).to.be.equal(tokens(400));
      expect(await getNodeAmount(sTree, 5)).to.be.equal(tokens(400));
      expect(await getNodeAmount(sTree, 6)).to.be.equal(tokens(400));
      expect(await getNodeAmount(sTree, 7)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 8)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 9)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 10)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 11)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 12)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 13)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 14)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 16)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 17)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 18)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 19)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 20)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 21)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 22)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 23)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 24)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 25)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 26)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 27)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 28)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 29)).to.be.equal(TOKENS_100);

      // withdraw part of nodes
      await sTree.nodeWithdraw(21);
      await sTree.nodeWithdraw(22);
      await sTree.nodeWithdraw(23);
      await sTree.nodeWithdraw(24);
      await sTree.nodeWithdraw(25);
      await sTree.nodeWithdraw(28);
      await sTree.nodeWithdraw(29);

      /*
        Liquidity tree structure after nodeAddLiquidity:
        +---------------------------------------------------------------------------------------------------------------------------------------------+
        |                                                                    1(700)                                                                   |
        +-----------------------------------------------------------------------+---------------------------------------------------------------------+
        |                                2(500)                                 |                                       3(200)                        |
        +-----------------------------------+---------------+-----------------------------------------------------------+-----------------------------+
        |              4(400)               |              5(100)               |                 6(200)                |              7(0)           |
        +-----------------+-----------------+-----------------+-----------------+-------------------+-------------------+-------------------+---------+
        |     8(200)      |     9(200)      |    10(100)      |      11(0)      |        12(0)      |       13(200)     |        14(0)      |    15   |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+
        | 16(100)| 17(100)| 18(100)| 19(100)| 20(100)| 21(0)  | 22(0)  | 23(0)  | 24(0)   | 25(0)   | 26(100) | 27(100) |   28(0) | 29(0)   | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+
            100    100        100      100      100                                                      100      100                 
      */
      expect(await getNodeAmount(sTree, 1)).to.be.equal(tokens(700));
      expect(await getNodeAmount(sTree, 2)).to.be.equal(tokens(500));
      expect(await getNodeAmount(sTree, 3)).to.be.equal(tokens(200));
      expect(await getNodeAmount(sTree, 4)).to.be.equal(tokens(400));
      expect(await getNodeAmount(sTree, 5)).to.be.equal(tokens(100));
      expect(await getNodeAmount(sTree, 6)).to.be.equal(tokens(200));
      expect(await getNodeAmount(sTree, 7)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 8)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 9)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 10)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 11)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 12)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 13)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 14)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 16)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 17)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 18)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 19)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 20)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 21)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 22)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 23)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 24)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 25)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 26)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 27)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 28)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 29)).to.be.equal(0);

      // remove 1
      await sTree.remove(tokens(1));

      /*
        Liquidity tree structure after nodeAddLiquidity:
        +-----------------------------------------------------------------------------------------------------------------------------------------------------+
        |                                                                    1(699)                                                                           |
        +-----------------------------------------------------------------------+-----------------------------------------------------------------------------+
        |                                2(499.285)                             |                                   3(199.714285714285)                       |
        +-----------------------------------+---------------+-----------------------------------------------------------+-------------------------------------+
        |              4(400)               |              5(100)               |          6(199.714285714285)          |               7(0)                  |
        +-----------------+-----------------+-----------------+-----------------+-------------------+-------------------+---------------------------+---------+
        |     8(200)      |     9(200)      |    10(100)      |      11(0)      |        12(0)      |       13(200)     |             14(0)         |    15   |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+--------------+------------+----+----+
        | 16(100)| 17(100)| 18(100)| 19(100)| 20(100)| 21(0)  | 22(0)  | 23(0)  | 24(0)   | 25(0)   | 26(100) | 27(100) |      28(0)   |    29(0)   | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+--------------+------------+----+----+
            100    100        100      100      100                                                      100      100                         
      */

      expect(await getNodeAmount(sTree, 1)).to.be.equal(tokens(699));
      expect(await getNodeAmount(sTree, 2)).to.be.equal("499285714285715000000");
      expect(await getNodeAmount(sTree, 3)).to.be.equal("199714285714285000000");
      expect(await getNodeAmount(sTree, 4)).to.be.equal(tokens(400));
      expect(await getNodeAmount(sTree, 5)).to.be.equal(tokens(100));
      expect(await getNodeAmount(sTree, 6)).to.be.equal("199714285714285000000");
      expect(await getNodeAmount(sTree, 7)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 8)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 9)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 10)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 11)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 12)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 13)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 14)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 16)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 17)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 18)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 19)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 20)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 21)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 22)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 23)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 24)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 25)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 26)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 27)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 28)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 29)).to.be.equal(0);

      expect(await sTree.nodeWithdrawView(20)).to.be.equal("99857142857143000000");
    });
  });
  describe("Example tree (4 leaves)", async () => {
    before(async () => {
      sTree = await prepareTree(ethers, EXAMPLE_TREE_LEAFS);
    });
    it("nodeAddLiquidity(100$)", async () => {
      await sTree.nodeAddLiquidity(TOKENS_100);
      await sTree.nodeAddLiquidity(TOKENS_200);
      expect(await getNodeAmount(sTree, 1)).to.be.equal(TOKENS_300);
      expect(await getNodeAmount(sTree, 2)).to.be.equal(TOKENS_300);
      expect(await getNodeAmount(sTree, 4)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 5)).to.be.equal(TOKENS_200);
    });
    it("remove(30$) and addliquidity", async () => {
      await sTree.remove(TOKENS_30);
      expect(await getNodeAmount(sTree, 1)).to.be.equal(TOKENS_270);
      expect(await getNodeAmount(sTree, 2)).to.be.equal(TOKENS_270);
      expect(await getNodeAmount(sTree, 4)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 5)).to.be.equal(TOKENS_200);

      await sTree.nodeAddLiquidity(TOKENS_300);
      expect(await getNodeAmount(sTree, 1)).to.be.equal(tokens(570));
      expect(await getNodeAmount(sTree, 2)).to.be.equal(TOKENS_270);
      expect(await getNodeAmount(sTree, 3)).to.be.equal(TOKENS_300);
      expect(await getNodeAmount(sTree, 4)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 5)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 6)).to.be.equal(TOKENS_300);
    });
    it("addLimit(15$, #5)", async () => {
      await sTree.addLimit(tokens(15), 5);
      expect(await getNodeAmount(sTree, 1)).to.be.equal(tokens(585));
      expect(await getNodeAmount(sTree, 2)).to.be.equal(tokens(285));
      expect(await getNodeAmount(sTree, 3)).to.be.equal(TOKENS_300);
      expect(await getNodeAmount(sTree, 4)).to.be.equal(tokens(90));
      expect(await getNodeAmount(sTree, 5)).to.be.equal(tokens(180));
      expect(await getNodeAmount(sTree, 6)).to.be.equal(TOKENS_300);
    });
    it("nodeWithdraw(4)", async () => {
      let withdrawAmount4 = await sTree.nodeWithdrawView(4);
      let tx4 = await sTree.nodeWithdraw(4);
      expect(await getNodeAmount(sTree, 1)).to.be.equal(tokens(490));
      expect(await getNodeAmount(sTree, 2)).to.be.equal(TOKENS_190);
      expect(await getNodeAmount(sTree, 3)).to.be.equal(TOKENS_300);
      expect(await getNodeAmount(sTree, 4)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 5)).to.be.equal(TOKENS_190);
      expect(await getNodeAmount(sTree, 6)).to.be.equal(TOKENS_300);
      expect(withdrawAmount4).to.be.equal(tokens(95));
      expect(await getWithdrawnAmount(tx4)).to.be.equal(withdrawAmount4);
    });
    it("nodeWithdraw(5)", async () => {
      let withdrawAmount5 = await sTree.nodeWithdrawView(5);
      let tx5 = await sTree.nodeWithdraw(5);
      expect(await getNodeAmount(sTree, 1)).to.be.equal(TOKENS_300);
      expect(await getNodeAmount(sTree, 2)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 3)).to.be.equal(TOKENS_300);
      expect(await getNodeAmount(sTree, 4)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 5)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 6)).to.be.equal(TOKENS_300);
      expect(withdrawAmount5).to.be.equal(TOKENS_190);
      expect(await getWithdrawnAmount(tx5)).to.be.equal(withdrawAmount5);
    });
  });
  describe("Example tree (4 leaves) fair distribution", async () => {
    before(async () => {
      sTree = await prepareTree(ethers, EXAMPLE_TREE_LEAFS);
    });
    it("add liquidity 10$ in each of 4 leafs", async () => {
      await sTree.nodeAddLiquidity(TOKENS_10);
      await sTree.nodeAddLiquidity(TOKENS_10);
      await sTree.nodeAddLiquidity(TOKENS_10);
      await sTree.nodeAddLiquidity(TOKENS_10);

      expect(await getNodeAmount(sTree, 1)).to.be.equal(TOKENS_40);
      expect(await getNodeAmount(sTree, 2)).to.be.equal(TOKENS_20);
      expect(await getNodeAmount(sTree, 3)).to.be.equal(TOKENS_20);
      expect(await getNodeAmount(sTree, 4)).to.be.equal(TOKENS_10);
      expect(await getNodeAmount(sTree, 5)).to.be.equal(TOKENS_10);
      expect(await getNodeAmount(sTree, 6)).to.be.equal(TOKENS_10);
      expect(await getNodeAmount(sTree, 7)).to.be.equal(TOKENS_10);

      /*
      +--------------------------------------------+
      |                    1 (40$)                 |
      +------------------------+-------------------+
      |         2 (20$)        |     3 (20$)       |
      +-------------+----------+---------+---------+
      |   4 (10$)   |  5 (10$) | 6 (10$) | 7 (10$) |
      +-------------+----------+---------+---------+
      */
    });
    it("add 40$ to the whole tree", async () => {
      await sTree.add(tokens(40));

      expect(await getNodeAmount(sTree, 1)).to.be.equal(TOKENS_80);
      expect(await getNodeAmount(sTree, 2)).to.be.equal(TOKENS_20);
      expect(await getNodeAmount(sTree, 3)).to.be.equal(TOKENS_20);
      expect(await getNodeAmount(sTree, 4)).to.be.equal(TOKENS_10);
      expect(await getNodeAmount(sTree, 5)).to.be.equal(TOKENS_10);
      expect(await getNodeAmount(sTree, 6)).to.be.equal(TOKENS_10);
      expect(await getNodeAmount(sTree, 7)).to.be.equal(TOKENS_10);

      /*
      +--------------------------------------------+
      |                    1 (80$)                 |
      +------------------------+-------------------+
      |         2 (20$)        |     3 (20$)       |
      +-------------+----------+---------+---------+
      |   4 (10$)   |  5 (10$) | 6 (10$) | 7 (10$) |
      +-------------+----------+---------+---------+
      */
    });
    it("withdraw whole liquidity from leaf #5", async () => {
      await sTree.nodeWithdrawPercent(5, WITHDRAW_100_PERCENT);

      expect(await getNodeAmount(sTree, 1)).to.be.equal(tokens(60));
      expect(await getNodeAmount(sTree, 2)).to.be.equal(TOKENS_20);
      expect(await getNodeAmount(sTree, 3)).to.be.equal(TOKENS_40);
      expect(await getNodeAmount(sTree, 4)).to.be.equal(TOKENS_20);
      expect(await getNodeAmount(sTree, 5)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 6)).to.be.equal(TOKENS_10);
      expect(await getNodeAmount(sTree, 7)).to.be.equal(TOKENS_10);

      /*
      +--------------------------------------------+
      |                    1 (60$)                 |
      +------------------------+-------------------+
      |         2 (20$)        |     3 (40$)       |
      +-------------+----------+---------+---------+
      |   4 (20$)   |  5 (0$)  | 6 (10$) | 7 (10$) |
      +-------------+----------+---------+---------+
      */
    });
    it("add liquidity 50$ on tree for only leaves 4,5,6", async () => {
      await sTree.addLimit(TOKENS_50, 6);

      expect(await getNodeAmount(sTree, 1)).to.be.equal(tokens(110));
      expect(await getNodeAmount(sTree, 2)).to.be.equal(TOKENS_45);
      expect(await getNodeAmount(sTree, 3)).to.be.equal(tokens(65));
      expect(await getNodeAmount(sTree, 4)).to.be.equal(TOKENS_20);
      expect(await getNodeAmount(sTree, 5)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 6)).to.be.equal(TOKENS_45);
      expect(await getNodeAmount(sTree, 7)).to.be.equal(TOKENS_20);

      /*
      +--------------------------------------------+
      |                    1 (110$)                |
      +------------------------+-------------------+
      |         2 (45$)        |     3 (65$)       |
      +-------------+----------+---------+---------+
      |   4 (20$)   |  5 (0$)  | 6 (45$) | 7 (20$) |
      +-------------+----------+---------+---------+
      */
      let withdrawView4 = await sTree.nodeWithdrawView(4);
      let withdrawView6 = await sTree.nodeWithdrawView(6);
      expect(withdrawView4).to.be.equal(TOKENS_45);
      expect(withdrawView6).to.be.equal(TOKENS_45);
      expect(await getWithdrawnAmount(await sTree.nodeWithdraw(4))).to.be.equal(withdrawView4);
      expect(await getWithdrawnAmount(await sTree.nodeWithdraw(6))).to.be.equal(withdrawView6);

      /*
      +--------------------------------------------+
      |                     1 (20$)                |
      +------------------------+-------------------+
      |          2 (0$)        |     3 (20$)       |
      +-------------+----------+---------+---------+
      |    4 (0$)   |  5 (0$)  |  6 (0$) | 7 (20$) |
      +-------------+----------+---------+---------+
      */

      expect(await getNodeAmount(sTree, 1)).to.be.equal(TOKENS_20);
      expect(await getNodeAmount(sTree, 2)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 3)).to.be.equal(TOKENS_20);
      expect(await getNodeAmount(sTree, 4)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 5)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 6)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 7)).to.be.equal(TOKENS_20);
    });
  });
  describe("Example tree (2 leaves) fair distribution", async () => {
    before(async () => {
      sTree = await prepareTree(ethers, TINY_TREE_LEAFS);
    });
    it("add liquidity 10$ in each of 2 leafs", async () => {
      await sTree.nodeAddLiquidity(TOKENS_10);
      await sTree.nodeAddLiquidity(TOKENS_10);

      expect(await getNodeAmount(sTree, 1)).to.be.equal(TOKENS_20);
      expect(await getNodeAmount(sTree, 2)).to.be.equal(TOKENS_10);
      expect(await getNodeAmount(sTree, 3)).to.be.equal(TOKENS_10);
      /*      
      +------------------------+
      |         1 (20$)        |
      +-------------+----------+
      |   2 (10$)   |  3 (10$) |
      +-------------+----------+
      */
    });
    it("add 20$ to the whole tree", async () => {
      await sTree.add(TOKENS_20);

      expect(await getNodeAmount(sTree, 1)).to.be.equal(TOKENS_40);
      expect(await getNodeAmount(sTree, 2)).to.be.equal(TOKENS_10);
      expect(await getNodeAmount(sTree, 3)).to.be.equal(TOKENS_10);
      /*      
      +------------------------+
      |         1 (40$)        |
      +-------------+----------+
      |   2 (10$)   |  3 (10$) |
      +-------------+----------+
      */
    });
    it("add 10$ to the leaf #2", async () => {
      await sTree.addLimit(TOKENS_10, 2);

      expect(await getNodeAmount(sTree, 1)).to.be.equal(TOKENS_50);
      expect(await getNodeAmount(sTree, 2)).to.be.equal(TOKENS_30);
      expect(await getNodeAmount(sTree, 3)).to.be.equal(TOKENS_20);
      /*      
      +------------------------+
      |         1 (50$)        |
      +-------------+----------+
      |   2 (30$)   |  3 (20$) |
      +-------------+----------+
      */
    });
  });
  describe("Example tree (8 leaves) fair distribution", async () => {
    before(async () => {
      sTree = await prepareTree(ethers, MIDDLE_TREE_LEAFS);
    });
    it("add liquidity 45$, remove 45$, try withdraw it", async () => {
      // Add three leaves so the one we will be using is the last of the left "main branch"
      await sTree.nodeAddLiquidity(0);
      await sTree.nodeWithdraw(8);
      await sTree.nodeAddLiquidity(0);
      await sTree.nodeWithdraw(9);
      await sTree.nodeAddLiquidity(0);
      await sTree.nodeWithdraw(10);

      // Add liquidity to the node to be tested
      await sTree.nodeAddLiquidity(TOKENS_45);

      /*
      +-----------------------------------------------------------------------------------------+
      |                                          1 (45$)                                        |
      +--------------------------------------------+--------------------------------------------+
      |                      2 (45$)               |                      3 (0$)                |
      +-------------+----------+---------+---------+-------------+----------+---------+---------+
      |           4 (0$)       |       5 (45$)     |           6 (0$)       |       7 (0$)      |
      +-------------+----------+---------+---------+-------------+----------+---------+---------+
      |    8 (0$)   |  9 (0$)  | 10 (0$) | 11 (45$)|    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
      +-------------+----------+---------+---------+-------------+----------+---------+---------+*/

      expect(await getNodeAmount(sTree, 1)).to.be.equal(TOKENS_45);
      expect(await getNodeAmount(sTree, 2)).to.be.equal(TOKENS_45);
      expect(await getNodeAmount(sTree, 5)).to.be.equal(TOKENS_45);
      expect(await getNodeAmount(sTree, 11)).to.be.equal(TOKENS_45);

      // Remove all current liquidity from the tree
      await sTree.remove(TOKENS_45);
      /*
      +-----------------------------------------------------------------------------------------+
      |                                          1 (0$)                                         |
      +--------------------------------------------+--------------------------------------------+
      |                      2 (0$)                |                      3 (0$)                |
      +-------------+----------+---------+---------+-------------+----------+---------+---------+
      |           4 (0$)       |       5 (45$)     |           6 (0$)       |       7 (0$)      |
      +-------------+----------+---------+---------+-------------+----------+---------+---------+
      |    8 (0$)   |  9 (0$)  | 10 (0$) | 11 (45$)|    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
      +-------------+----------+---------+---------+-------------+----------+---------+---------+*/

      expect(await getNodeAmount(sTree, 1)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 2)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 5)).to.be.equal(TOKENS_45);
      expect(await getNodeAmount(sTree, 11)).to.be.equal(TOKENS_45);

      // Add another node so 'tree.updateId' propagates back to the root when we do a push
      await sTree.nodeAddLiquidity(0);
      await sTree.nodeWithdraw(12);

      // Deposited 45 but removed from top and nothing to withdraw. This is 0 as we expect.
      expect(await sTree.nodeWithdrawView(11)).to.be.equal(0);
      /*
      +-----------------------------------------------------------------------------------------+
      |                                          1 (0$)                                         |
      +--------------------------------------------+--------------------------------------------+
      |                      2 (0$)                |                      3 (0$)                |
      +-------------+----------+---------+---------+-------------+----------+---------+---------+
      |           4 (0$)       |       5 (45$)     |           6 (0$)       |       7 (0$)      |
      +-------------+----------+---------+---------+-------------+----------+---------+---------+
      |    8 (0$)   |  9 (0$)  | 10 (0$) | 11 (45$)|    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
      +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      expect(await getNodeAmount(sTree, 1)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 2)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 5)).to.be.equal(TOKENS_45);
      expect(await getNodeAmount(sTree, 11)).to.be.equal(TOKENS_45);

      // Withdraw 0 percent, this should do nothing, just updates (push) actual values from top to the leaf.
      await sTree.nodeWithdrawPercent(11, 0);

      /*
      +-----------------------------------------------------------------------------------------+
      |                                          1 (0$)                                         |
      +--------------------------------------------+--------------------------------------------+
      |                      2 (0$)                |                      3 (0$)                |
      +-------------+----------+---------+---------+-------------+----------+---------+---------+
      |           4 (0$)       |       5 (0$)      |           6 (0$)       |       7 (0$)      |
      +-------------+----------+---------+---------+-------------+----------+---------+---------+
      |    8 (0$)   |  9 (0$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
      +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      expect(await getNodeAmount(sTree, 1)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 2)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 5)).to.be.equal(0);
      expect(await getNodeAmount(sTree, 11)).to.be.equal(0);
    });
  });
});
