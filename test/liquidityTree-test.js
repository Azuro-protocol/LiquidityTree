const { expect } = require("chai");
const { BigNumber } = require("ethers");
const { LogDescription } = require("ethers/lib/utils");
const { ethers } = require("hardhat");
const { tokens, getNodeAmount, prepareTree, getWithdrawnAmount } = require("../utils/utils");

const TOKENS_10000 = tokens(10_000);
const TOKENS_300 = tokens(300);
const TOKENS_270 = tokens(270);
const TOKENS_400 = tokens(400);
const TOKENS_200 = tokens(200);
const TOKENS_190 = tokens(190);
const TOKENS_100 = tokens(100);
const TOKENS_90 = tokens(90);
const TOKENS_80 = tokens(80);
const TOKENS_60 = tokens(60);
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
const WITHDRAW_50_PERCENT = 500000000000;
const WITHDRAW_100_PERCENT = 10 ** 12;

const checkTreeIsEmpty = async (sTree) => {
  for (const i of Array(32).keys()) {
    await checkNodeAmountTo(sTree, i + 1, ZERO);
  }
};

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
          await sTree.nodeWithdrawPercent((await sTree.nextNode()) - 1, WITHDRAW_50_PERCENT); // 50%
          await sTree.addLimit(tokens(10), (await sTree.nextNode()) - 1);
        }
      }

      for (const iterator of Array(39).keys()) {
        await sTree.nodeAddLiquidity(tokens(1));
        await sTree.nodeWithdrawPercent((await sTree.nextNode()) - 1, WITHDRAW_100_PERCENT); // 100%
      }
      await sTree.remove(tokens(1000));

      for (const iterator of Array(19).keys()) {
        await sTree.nodeAddLiquidity(tokens(1));
        await sTree.nodeWithdrawPercent((await sTree.nextNode()) - 1, WITHDRAW_100_PERCENT); // 100%
      }
      await sTree.remove(tokens(1000));

      for (const iterator of Array(9).keys()) {
        await sTree.nodeAddLiquidity(tokens(1));
        await sTree.nodeWithdrawPercent((await sTree.nextNode()) - 1, WITHDRAW_100_PERCENT); // 100%
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
        expect((await sTree.treeNode(1)).amount).to.be.equal(ZERO);
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
        expect((await sTree.treeNode(1)).amount).to.be.equal(ZERO);
        // withdrawn sum is all deposited - distributed 90 loss
        expect(totalWitdrawn).to.be.equal(initLiquidity.sub(TOKENS_90));
      });
    });
  });
  describe("small tree (16 leaves)", (async) => {
    beforeEach(async () => {
      sTree = await prepareTree(ethers, SMALL_TREE_LEAFS);
    });
    it("add liquidity to 7 leafs, top add 70, withdraw leaf", async () => {
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
      expect(await getNodeAmount(sTree, 4)).to.be.equal(TOKENS_400);
      expect(await getNodeAmount(sTree, 5)).to.be.equal(tokens(300));
      expect(await getNodeAmount(sTree, 8)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 9)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 10)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 11)).to.be.equal(TOKENS_100);

      await sTree.add(tokens(70));
      /*
        Liquidity tree structure after add(TOKENS_100) on top 1:
        +--------------------------------------------------------------------------------------------------------------------+
        |                                                                         1(770)                                     |
        +----------------------------------------------------------------------------+---------------------------------------+
        |                                2(770)                                      |                   3                   |
        +-----------------------------------+----------------------------------------+-------------------+-------------------+
        |                4(440)             |                 5(330)                 |         6         |         7         |
        +-----------------+-----------------+-----------------+----------------------+---------+---------+---------+---------+
        |     8(200)      |     9(200)      |      10(220)    |          11(110)     |    12   |    13   |    14   |    15   |
        +--------+--------+--------+--------+--------+--------+-------------+--------+----+----+----+----+----+----+----+----+
        | 16(100)| 17(100)| 18(100)| 19(100)| 20(100)| 21(100)|    22(110)  |   23   | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+-------------+--------+----+----+----+----+----+----+----+----+
            100    100        100      100      100      100      100 

        70 tokens been spread for nodes:
        4   - 40   70 * 400 / (400+300)
        10  - 20   (70 - 40) * 200 / (200 + 100)
        22  - 10   (70 - 40) * 100 / (200 + 100)
        40 + 20 + 10 = 70
      */

      expect((await sTree.treeNode(4)).amount).to.be.eq(tokens(440));
      expect((await sTree.treeNode(10)).amount).to.be.eq(tokens(220));
      expect((await sTree.treeNode(22)).amount).to.be.eq(tokens(110));

      let withdrawPreview = await sTree.nodeWithdrawView(16);
      expect(withdrawPreview).to.be.equal(tokens(110));

      let tx = await sTree.nodeWithdraw(16);
      expect(await getWithdrawnAmount(tx)).to.be.equal(withdrawPreview);

      /*
        Liquidity tree structure after nodeWithdraw(16):
        +--------------------------------------------------------------------------------------------------------------------+
        |                                                                         1(660)                                     |
        +----------------------------------------------------------------------------+---------------------------------------+
        |                                2(660)                                      |                   3                   |
        +-----------------------------------+----------------------------------------+-------------------+-------------------+
        |                4(330)             |                 5(330)                 |         6         |         7         |
        +-----------------+-----------------+-----------------+----------------------+---------+---------+---------+---------+
        |     8(110)      |     9(220)      |      10(220)    |          11(110)     |    12   |    13   |    14   |    15   |
        +--------+--------+--------+--------+--------+--------+-------------+--------+----+----+----+----+----+----+----+----+
        |  16(0) | 17(100)| 18(100)| 19(100)| 20(100)| 21(100)|    22(110)  |   23   | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+-------------+--------+----+----+----+----+----+----+----+----+
                    100        100      100      100      100      100 
        
        withdrawn from leaf 16 110
      */

      expect((await sTree.treeNode(4)).amount).to.be.eq(tokens(330));
      expect((await sTree.treeNode(8)).amount).to.be.eq(tokens(110));
      expect((await sTree.treeNode(9)).amount).to.be.eq(tokens(220));
      expect((await sTree.treeNode(16)).amount).to.be.equal("0");
    });
    it("add liquidity to 6 leafs, top add 60", async () => {
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
      expect(await getNodeAmount(sTree, 4)).to.be.equal(TOKENS_400);
      expect(await getNodeAmount(sTree, 5)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 8)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 9)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 10)).to.be.equal(TOKENS_200);

      await sTree.add(TOKENS_60);
      /*
        Liquidity tree structure after add:
        +---------------------------------------------------------------------------------------------------------------+
        |                                                                    1(660)                                     |
        +-----------------------------------------------------------------------+---------------------------------------+
        |                                2(660)                                 |                   3                   |
        +-----------------------------------+-----------------------------------+-------------------+-------------------+
        |                4(440)             |               5(220)              |         6         |         7         |
        +-----------------+-----------------+-----------------+-----------------+---------+---------+---------+---------+
        |     8(200)      |     9(200)      |      10(220)    |       11        |    12   |    13   |    14   |    15   |
        +--------+--------+--------+--------+--------+--------+--------+--------+----+----+----+----+----+----+----+----+
        | 16(100)| 17(100)| 18(100)| 19(100)| 20(100)| 21(100)|   22   |   23   | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+--------+--------+----+----+----+----+----+----+----+----+
            100    100        100      100      100      100

        60 tokens been spread for nodes:
        4   - 40   60 * 400 / (400+200)
        5   - 20   60 * 200 / (400+200)
        40 + 20 = 60
      */

      expect((await sTree.treeNode(4)).amount).to.be.eq(tokens(440));
      expect((await sTree.treeNode(10)).amount).to.be.eq(tokens(220));
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
      await checkNodeAmountTo(sTree, 1, tokens(700));
      await checkNodeAmountTo(sTree, 2, tokens(700));
      await checkNodeAmountTo(sTree, 4, TOKENS_400);
      await checkNodeAmountTo(sTree, 5, tokens(300));
      await checkNodeAmountTo(sTree, 8, TOKENS_200);
      await checkNodeAmountTo(sTree, 9, TOKENS_200);
      await checkNodeAmountTo(sTree, 10, TOKENS_200);
      await checkNodeAmountTo(sTree, 11, TOKENS_100);

      await sTree.remove(tokens(70));

      /*
        Liquidity tree structure after remove(70):
        +-------------------------------------------------------------------------------------------------------------------+
        |                                                                        1(630)                                     |
        +---------------------------------------------------------------------------+---------------------------------------+
        |                                2(630)                                     |                   3                   |
        +-----------------------------------+---------------------------------------+---------------------------------------+
        |               4(360)              |               5(270)                  |         6         |         7         |
        +-----------------+-----------------+-----------------+---------------------+---------+---------+---------+---------+
        |     8(200)      |     9(200)      |      10(180)    |         11(90)      |    12   |    13   |    14   |    15   |
        +--------+--------+--------+--------+--------+--------+------------+--------+----+----+----+----+----+----+----+----+
        | 16(100)| 17(100)| 18(100)| 19(100)| 20(100)| 21(100)|   22(90)   |   23   | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+------------+--------+----+----+----+----+----+----+----+----+
            100    100        100      100      100      100         100 

        70 tokens been removed for nodes:
        1   630 = 700 - 70
        2   630 = 700 - 70
        4   360 = 400 - 40   (70 * 400 / (400+300))
        5   270 = 300 - 30   (70 * 300 / (400+300))
        10  200 = 200 - 30 * 200 / (200+100)
        11   90 = 100 - 30 * 100 / (200+100)
      */
      await checkNodeAmountTo(sTree, 1, tokens(630));
      await checkNodeAmountTo(sTree, 2, tokens(630));
      await checkNodeAmountTo(sTree, 4, tokens(360));
      await checkNodeAmountTo(sTree, 5, tokens(270));
      await checkNodeAmountTo(sTree, 8, TOKENS_200);
      await checkNodeAmountTo(sTree, 9, TOKENS_200);
      await checkNodeAmountTo(sTree, 10, tokens(180));
      await checkNodeAmountTo(sTree, 11, TOKENS_90);

      let withdrawPreview = await sTree.nodeWithdrawView(16);
      let tx = await sTree.nodeWithdraw(16);

      /*
        Liquidity tree structure after nodeWithdraw(16):
        +-------------------------------------------------------------------------------------------------------------------+
        |                                                                        1(540)                                     |
        +---------------------------------------------------------------------------+---------------------------------------+
        |                                2(540)                                     |                   3                   |
        +-----------------------------------+---------------------------------------+---------------------------------------+
        |               4(270)              |               5(270)                  |         6         |         7         |
        +-----------------+-----------------+-----------------+---------------------+---------+---------+---------+---------+
        |      8(90)      |     9(200)      |      10(180)    |         11(90)      |    12   |    13   |    14   |    15   |
        +--------+--------+--------+--------+--------+--------+------------+--------+----+----+----+----+----+----+----+----+
        |  16(0) | 17(100)| 18(100)| 19(100)| 20(100)| 21(100)|   22(90)   |   23   | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+------------+--------+----+----+----+----+----+----+----+----+
                    100        100      100      100      100         100         
        
        90 tokens been withdrawn from leaf 16
      */

      expect(withdrawPreview).to.be.equal(TOKENS_90);
      expect(await getWithdrawnAmount(tx)).to.be.equal(withdrawPreview);

      // add liquidity
      await sTree.nodeAddLiquidity(TOKENS_100);

      /*
        Liquidity tree structure after nodeAddLiquidity(TOKENS_100):
        +-------------------------------------------------------------------------------------------------------------------+
        |                                                                        1(640)                                     |
        +---------------------------------------------------------------------------+---------------------------------------+
        |                                2(640)                                     |                   3                   |
        +-----------------------------------+---------------------------------------+---------------------------------------+
        |               4(270)              |               5(370)                  |         6         |         7         |
        +-----------------+-----------------+-----------------+---------------------+---------+---------+---------+---------+
        |      8(90)      |     9(180)      |      10(180)    |        11(190)      |    12   |    13   |    14   |    15   |
        +--------+--------+--------+--------+--------+--------+------------+--------+----+----+----+----+----+----+----+----+
        |  16(0) | 17(100)| 18(100)| 19(100)| 20(100)| 21(100)|   22(90)   | 23(100)| 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+------------+--------+----+----+----+----+----+----+----+----+
                    100        100      100      100      100         100       100
      */
      await checkNodeAmountTo(sTree, 1, tokens(640));
      await checkNodeAmountTo(sTree, 2, tokens(640));
      await checkNodeAmountTo(sTree, 4, tokens(270));
      await checkNodeAmountTo(sTree, 5, tokens(370));
      await checkNodeAmountTo(sTree, 8, TOKENS_90);
      await checkNodeAmountTo(sTree, 9, tokens(180));
      await checkNodeAmountTo(sTree, 10, tokens(180));
      await checkNodeAmountTo(sTree, 11, tokens(190));
      await checkNodeAmountTo(sTree, 23, TOKENS_100);

      //addLimit only for leaves [16-22], 23 not included
      await sTree.addLimit(TOKENS_60, 22);

      /*+-------------------------------------------------------------------------------------------------------------------+
        |                                                                        1(700)                                     |
        +---------------------------------------------------------------------------+---------------------------------------+
        |                                2(700)                                     |                   3                   |
        +-----------------------------------+---------------------------------------+---------------------------------------+
        |               4(300)              |               5(400)                  |         6         |         7         |
        +-----------------+-----------------+-----------------+---------------------+---------+---------+---------+---------+
        |       8(90)     |     9(180)      |      10(200)    |        11(200)      |    12   |    13   |    14   |    15   |
        +--------+--------+--------+--------+--------+--------+------------+--------+----+----+----+----+----+----+----+----+
        |  16(0) | 17(100)| 18(100)| 19(100)| 20(100)| 21(100)|   22(100)  | 23(100)| 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+------------+--------+----+----+----+----+----+----+----+----+
                    100        100      100      100      100         100       100

        2 changed 640 -> 700
        4 changed 270 -> 300 by 30
        5 changed 370 -> 400 by 30
        23 not changed because it is excluded by addLimit(TOKENS_100, 22)
      */
      await checkNodeAmountTo(sTree, 1, tokens(700));
      await checkNodeAmountTo(sTree, 2, tokens(700));
      await checkNodeAmountTo(sTree, 4, tokens(300));
      await checkNodeAmountTo(sTree, 5, TOKENS_400);
      await checkNodeAmountTo(sTree, 8, TOKENS_90);
      await checkNodeAmountTo(sTree, 9, tokens(180));
      await checkNodeAmountTo(sTree, 10, TOKENS_200);
      await checkNodeAmountTo(sTree, 11, TOKENS_200);
      await checkNodeAmountTo(sTree, 22, TOKENS_100);
      await checkNodeAmountTo(sTree, 23, TOKENS_100);

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
        +-------------------------------------------------------------------------------------------------------------------+
        |                                                                        1(800)                                     |
        +---------------------------------------------------------------------------+---------------------------------------+
        |                                2(800)                                     |                   3                   |
        +-----------------------------------+---------------------------------------+---------------------------------------+
        |               4(375)              |               5(425)                  |         6         |         7         |
        +-----------------+-----------------+-----------------+---------------------+---------+---------+---------+---------+
        |       8(90)     |     9(180)      |      10(225)    |        11(200)      |    12   |    13   |    14   |    15   |
        +--------+--------+--------+--------+--------+--------+------------+--------+----+----+----+----+----+----+----+----+
        |  16(0) | 17(100)| 18(100)| 19(100)| 20(125)| 21(100)|   22(100)  | 23(100)| 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+------------+--------+----+----+----+----+----+----+----+----+
                    100        100      100      100      100         100       100

        2 changed 700 -> 800
        4 changed 300 -> 375 by 75 (100 * 3/4)
        5 changed 400 -> 425 by 25 (100 * 1/4)
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

      // withdraw all and check tree zeroed
      for (const i of Array(8).keys()) await sTree.nodeWithdraw(i + 16);
      await checkTreeIsEmpty(sTree);
    });
    it("add liquidity to 7 leafs, remove limit for 7 leaves", async () => {
      for (const i of Array(9).keys()) await sTree.nodeAddLiquidity(TOKENS_100);
      /*
        Liquidity tree structure after nodeAddLiquidity:
        +--------------------------------------------------------------------------------------------------------------------+
        |                                                                    1(900)                                          |
        +-----------------------------------------------------------------------+--------------------------------------------+
        |                                2(800)                                 |                     3(100)                 |
        +-----------------------------------+-----------------------------------+------------------------+-------------------+
        |              4(400)               |              5(400)               |            6(100)      |         7         |
        +-----------------+-----------------+-----------------+-----------------+--------------+---------+---------+---------+
        |     8(200)      |     9(200)      |    10(200)      |    11(200)      |     12(100)  |    13   |    14   |    15   |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+----+----+----+----+----+----+----+
        | 16(100)| 17(100)| 18(100)| 19(100)| 20(100)| 21(100)| 22(100)| 23(100)| 24(100) | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+----+----+----+----+----+----+----+
            100    100        100      100      100      100      100      100     100
      */

      await checkNodeAmountTo(sTree, 1, tokens(900));
      await checkNodeAmountTo(sTree, 2, tokens(800));
      await checkNodeAmountTo(sTree, 3, TOKENS_100);
      await checkNodeAmountTo(sTree, 4, TOKENS_400);
      await checkNodeAmountTo(sTree, 5, TOKENS_400);
      await checkNodeAmountTo(sTree, 6, TOKENS_100);
      await checkNodeAmountTo(sTree, 7, ZERO);
      for (const i of Array(4).keys()) await checkNodeAmountTo(sTree, i + 8, TOKENS_200);
      await checkNodeAmountTo(sTree, 12, TOKENS_100);

      for (const i of Array(3).keys()) await checkNodeAmountTo(sTree, i + 13, ZERO);
      for (const i of Array(9).keys()) await checkNodeAmountTo(sTree, i + 16, TOKENS_100);

      await sTree.removeLimit(tokens(210), 22);
      /*
        Liquidity tree structure after removeLimit(22, 210), #23, #24 must be unchanged:
        +--------------------------------------------------------------------------------------------------------------------+
        |                                                                    1(690)                                          |
        +-----------------------------------------------------------------------+--------------------------------------------+
        |                                2(590)                                 |                     3(100)                 |
        +-----------------------------------+-----------------------------------+------------------------+-------------------+
        |              4(280)               |              5(310)               |            6(100)      |         7         |
        +-----------------+-----------------+-----------------+-----------------+--------------+---------+---------+---------+
        |     8(200)      |     9(200)      |    10(140)      |    11(170)      |     12(100)  |    13   |    14   |    15   |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+----+----+----+----+----+----+----+
        | 16(100)| 17(100)| 18(100)| 19(100)| 20(100)| 21(100)| 22(70) | 23(100)| 24(100) | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+----+----+----+----+----+----+----+
      */

      await checkNodeAmountTo(sTree, 1, tokens(690));
      await checkNodeAmountTo(sTree, 2, tokens(590));
      await checkNodeAmountTo(sTree, 3, TOKENS_100);
      await checkNodeAmountTo(sTree, 4, tokens(280));
      await checkNodeAmountTo(sTree, 5, tokens(310));
      await checkNodeAmountTo(sTree, 6, TOKENS_100);
      await checkNodeAmountTo(sTree, 7, ZERO);
      await checkNodeAmountTo(sTree, 8, TOKENS_200);
      await checkNodeAmountTo(sTree, 9, TOKENS_200);
      await checkNodeAmountTo(sTree, 10, tokens(140));
      await checkNodeAmountTo(sTree, 11, tokens(170));
      await checkNodeAmountTo(sTree, 12, TOKENS_100);
      for (const i of Array(3).keys()) await checkNodeAmountTo(sTree, i + 13, ZERO);
      for (const i of Array(6).keys()) await checkNodeAmountTo(sTree, i + 16, TOKENS_100);
      await checkNodeAmountTo(sTree, 22, tokens(70));
      await checkNodeAmountTo(sTree, 23, TOKENS_100);
      await checkNodeAmountTo(sTree, 24, TOKENS_100);

      await sTree.addLimit(tokens(210), 22);
      /*
        Liquidity tree structure after addLimit(210, 22)
        +--------------------------------------------------------------------------------------------------------------------+
        |                                                                    1(900)                                          |
        +-----------------------------------------------------------------------+--------------------------------------------+
        |                                2(800)                                 |                     3(100)                 |
        +-----------------------------------+-----------------------------------+------------------------+-------------------+
        |              4(400)               |              5(400)               |            6(100)      |         7         |
        +-----------------+-----------------+-----------------+-----------------+--------------+---------+---------+---------+
        |     8(200)      |     9(200)      |    10(200)      |    11(200)      |     12(100)  |    13   |    14   |    15   |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+----+----+----+----+----+----+----+
        | 16(100)| 17(100)| 18(100)| 19(100)| 20(100)| 21(100)| 22(100)| 23(100)| 24(100) | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+----+----+----+----+----+----+----+
      */

      await checkNodeAmountTo(sTree, 1, tokens(900));
      await checkNodeAmountTo(sTree, 2, tokens(800));
      await checkNodeAmountTo(sTree, 3, TOKENS_100);
      await checkNodeAmountTo(sTree, 4, TOKENS_400);
      await checkNodeAmountTo(sTree, 5, TOKENS_400);
      await checkNodeAmountTo(sTree, 6, TOKENS_100);
      await checkNodeAmountTo(sTree, 7, ZERO);
      for (const i of Array(4).keys()) await checkNodeAmountTo(sTree, i + 8, TOKENS_200);
      await checkNodeAmountTo(sTree, 12, TOKENS_100);
      for (const i of Array(3).keys()) await checkNodeAmountTo(sTree, i + 13, ZERO);
      for (const i of Array(9).keys()) await checkNodeAmountTo(sTree, i + 16, TOKENS_100);

      for (const i of Array(9).keys()) expect(await sTree.nodeWithdrawView(i + 16)).to.be.eq(TOKENS_100);
      for (const i of Array(9).keys()) await sTree.nodeWithdraw(i + 16);

      await checkTreeIsEmpty(sTree);
    });
    describe("3 iterates with (add liquidity 100 and top remove 100), mixed addLimit", async () => {
      beforeEach(async () => {
        for (const i of Array(3).keys()) {
          await sTree.nodeAddLiquidity(tokens(110 - i * 10));
          await sTree.remove(tokens(10 + 10 * i));
        }

        /*
          Liquidity tree structure after mixed add + remove
          +---------------------------------------------------------------------------------------------------------------------------+
          |                                                                    1(240)                                                 |
          +-----------------------------------------------------------------------------------+---------------------------------------+
          |                                2(240)                                             |                   3                   |
          +---------------------------------------+-------------------------------------------+---------------------------------------+
          |              4(240)                   |                     5                     |         6         |         7         |
          +-----------------+---------------------+---------------------+---------------------+---------+---------+---------+---------+
          |      8(160)     |         9(80)       |           10        |           11        |    12   |    13   |    14   |    15   |
          +--------+--------+------------+--------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+
          | 16(100)| 17(100)|   18(80)   |   19   |     20     |    21  |      22    |   23   | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
          +--------+--------+------------+--------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+
              100    100          100
        */
        await checkNodeAmountTo(sTree, 1, tokens(240));
        await checkNodeAmountTo(sTree, 2, tokens(240));
        await checkNodeAmountTo(sTree, 4, tokens(240));
        await checkNodeAmountTo(sTree, 8, tokens(160));
        await checkNodeAmountTo(sTree, 9, tokens(80));
        await checkNodeAmountTo(sTree, 16, TOKENS_100); // added 110 and removed 10
        await checkNodeAmountTo(sTree, 17, TOKENS_100); // added 100 and not updated (lazy)
        await checkNodeAmountTo(sTree, 18, tokens(80)); // added 90 and removed 10

        expect(await sTree.nodeWithdrawView(16)).to.be.eq(tokens(80));
        expect(await sTree.nodeWithdrawView(17)).to.be.eq(tokens(80));
        expect(await sTree.nodeWithdrawView(18)).to.be.eq(tokens(80));
      });
      it("straight addings (liquidity returns)", async () => {
        await sTree.addLimit(tokens(160), 16);
        /*
          Liquidity tree structure after addLimit(tokens(10), 16)
          +---------------------------------------------------------------------------------------------------------------------------+
          |                                                                    1(400)                                                 |
          +-----------------------------------------------------------------------------------+---------------------------------------+
          |                                2(400)                                             |                   3                   |
          +---------------------------------------+-------------------------------------------+---------------------------------------+
          |              4(400)                   |                     5                     |         6         |         7         |
          +-----------------+---------------------+---------------------+---------------------+---------+---------+---------+---------+
          |      8(320)     |         9(80)       |           10        |           11        |    12   |    13   |    14   |    15   |
          +--------+--------+------------+--------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+
          | 16(240)| 17(80) |   18(80)   |   19   |     20     |    21  |      22    |   23   | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
          +--------+--------+------------+--------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+
        */
        await checkNodeAmountTo(sTree, 1, TOKENS_400);
        await checkNodeAmountTo(sTree, 2, TOKENS_400);
        await checkNodeAmountTo(sTree, 4, TOKENS_400);
        await checkNodeAmountTo(sTree, 8, tokens(320));
        await checkNodeAmountTo(sTree, 9, tokens(80));
        await checkNodeAmountTo(sTree, 16, tokens(240)); // updated to 80 and added (limit) 160
        await checkNodeAmountTo(sTree, 17, tokens(80)); // updated from parent
        await checkNodeAmountTo(sTree, 18, tokens(80)); // not changed

        expect(await sTree.nodeWithdrawView(16)).to.be.eq(tokens(240));
        expect(await sTree.nodeWithdrawView(17)).to.be.eq(tokens(80));
        expect(await sTree.nodeWithdrawView(18)).to.be.eq(tokens(80));

        await sTree.addLimit(tokens(240), 17);
        /*
          Liquidity tree structure after addLimit(tokens(240), 17):
          +---------------------------------------------------------------------------------------------------------------------------+
          |                                                                    1(640)                                                 |
          +-----------------------------------------------------------------------------------+---------------------------------------+
          |                                2(640)                                             |                   3                   |
          +---------------------------------------+-------------------------------------------+---------------------------------------+
          |              4(640)                   |                     5                     |         6         |         7         |
          +-----------------+---------------------+---------------------+---------------------+---------+---------+---------+---------+
          |      8(560)     |         9(80)       |           10        |           11        |    12   |    13   |    14   |    15   |
          +--------+--------+------------+--------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+
          | 16(240)| 17(80) |   18(80)   |   19   |     20     |    21  |      22    |   23   | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
          +--------+--------+------------+--------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+
        */
        await checkNodeAmountTo(sTree, 1, tokens(640));
        await checkNodeAmountTo(sTree, 2, tokens(640));
        await checkNodeAmountTo(sTree, 4, tokens(640));
        await checkNodeAmountTo(sTree, 8, tokens(560));
        await checkNodeAmountTo(sTree, 9, tokens(80));
        await checkNodeAmountTo(sTree, 16, tokens(240));
        await checkNodeAmountTo(sTree, 17, tokens(80));
        await checkNodeAmountTo(sTree, 18, tokens(80));

        expect(await sTree.nodeWithdrawView(16)).to.be.eq(tokens(420));
        expect(await sTree.nodeWithdrawView(17)).to.be.eq(tokens(140));
        expect(await sTree.nodeWithdrawView(18)).to.be.eq(tokens(80));

        await sTree.addLimit(tokens(160), 18);
        /*
          Liquidity tree structure after addLimit(tokens(160), 18):
          +---------------------------------------------------------------------------------------------------------------------------+
          |                                                                    1(800)                                                 |
          +-----------------------------------------------------------------------------------+---------------------------------------+
          |                                2(800)                                             |                   3                   |
          +---------------------------------------+-------------------------------------------+---------------------------------------+
          |              4(800)                   |                     5                     |         6         |         7         |
          +-----------------+---------------------+---------------------+---------------------+---------+---------+---------+---------+
          |      8(700)     |         9(100)      |           10        |           11        |    12   |    13   |    14   |    15   |
          +--------+--------+------------+--------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+
          | 16(240)| 17(80) |   18(100)  |   19   |     20     |    21  |      22    |   23   | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
          +--------+--------+------------+--------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+
        */
        await checkNodeAmountTo(sTree, 1, tokens(800));
        await checkNodeAmountTo(sTree, 2, tokens(800));
        await checkNodeAmountTo(sTree, 4, tokens(800));
        await checkNodeAmountTo(sTree, 8, tokens(700)); // 140 of 160
        await checkNodeAmountTo(sTree, 9, TOKENS_100); //  20 of 160
        await checkNodeAmountTo(sTree, 16, tokens(240));
        await checkNodeAmountTo(sTree, 17, tokens(80));
        await checkNodeAmountTo(sTree, 18, TOKENS_100);

        let withdrawView16 = await sTree.nodeWithdrawView(16);
        let withdrawView17 = await sTree.nodeWithdrawView(17);
        let withdrawView18 = await sTree.nodeWithdrawView(18);

        expect(withdrawView16).to.be.eq(tokens(525)); // 420 + 140 * 420/560
        expect(withdrawView17).to.be.eq(tokens(175)); // 140 + 140 * 140/560
        expect(withdrawView18).to.be.eq(TOKENS_100);

        expect(await getWithdrawnAmount(await sTree.nodeWithdraw(16))).to.be.equal(withdrawView16);
        expect(await getWithdrawnAmount(await sTree.nodeWithdraw(17))).to.be.equal(withdrawView17);
        expect(await getWithdrawnAmount(await sTree.nodeWithdraw(18))).to.be.equal(withdrawView18);
      });
      it("reverse addings", async () => {
        await sTree.addLimit(tokens(30), 18);
        /*
          Liquidity tree structure after nodeAddLiquidity(TOKENS_30):
          +---------------------------------------------------------------------------------------------------------------------------+
          |                                                                    1(270)                                                 |
          +-----------------------------------------------------------------------------------+---------------------------------------+
          |                                2(270)                                             |                   3                   |
          +---------------------------------------+-------------------------------------------+---------------------------------------+
          |              4(270)                   |                     5                     |         6         |         7         |
          +-----------------+---------------------+---------------------+---------------------+---------+---------+---------+---------+
          |      8(180)     |         9(90)       |           10        |           11        |    12   |    13   |    14   |    15   |
          +--------+--------+------------+--------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+
          | 16(100)| 17(100)|   18(90)   |   19   |     20     |    21  |      22    |   23   | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
          +--------+--------+------------+--------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+
        */
        await checkNodeAmountTo(sTree, 1, tokens(270));
        await checkNodeAmountTo(sTree, 2, tokens(270));
        await checkNodeAmountTo(sTree, 4, tokens(270));
        await checkNodeAmountTo(sTree, 8, tokens(180));
        await checkNodeAmountTo(sTree, 9, TOKENS_90);
        await checkNodeAmountTo(sTree, 16, TOKENS_100); // added 110 and removed 10
        await checkNodeAmountTo(sTree, 17, TOKENS_100); // added 100 and not updated (lazy)
        await checkNodeAmountTo(sTree, 18, TOKENS_90);

        expect(await sTree.nodeWithdrawView(16)).to.be.eq(TOKENS_90);
        expect(await sTree.nodeWithdrawView(17)).to.be.eq(TOKENS_90);
        expect(await sTree.nodeWithdrawView(18)).to.be.eq(TOKENS_90);

        await sTree.addLimit(tokens(20), 17);
        /*
          Liquidity tree structure after nodeAddLiquidity(TOKENS_20):
          +---------------------------------------------------------------------------------------------------------------------------+
          |                                                                    1(290)                                                 |
          +-----------------------------------------------------------------------------------+---------------------------------------+
          |                                2(290)                                             |                   3                   |
          +---------------------------------------+-------------------------------------------+---------------------------------------+
          |              4(290)                   |                     5                     |         6         |         7         |
          +-----------------+---------------------+---------------------+---------------------+---------+---------+---------+---------+
          |      8(200)     |         9(90)       |           10        |           11        |    12   |    13   |    14   |    15   |
          +--------+--------+------------+--------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+
          | 16(90) | 17(90) |   18(90)   |   19   |     20     |    21  |      22    |   23   | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
          +--------+--------+------------+--------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+
        */
        await checkNodeAmountTo(sTree, 1, tokens(290));
        await checkNodeAmountTo(sTree, 2, tokens(290));
        await checkNodeAmountTo(sTree, 4, tokens(290));
        await checkNodeAmountTo(sTree, 8, TOKENS_200);
        await checkNodeAmountTo(sTree, 9, TOKENS_90);
        await checkNodeAmountTo(sTree, 16, TOKENS_90); // pushed changes before add
        await checkNodeAmountTo(sTree, 17, TOKENS_90); // pushed changes before add
        await checkNodeAmountTo(sTree, 18, TOKENS_90);

        expect(await sTree.nodeWithdrawView(16)).to.be.eq(TOKENS_100);
        expect(await sTree.nodeWithdrawView(17)).to.be.eq(TOKENS_100);
        expect(await sTree.nodeWithdrawView(18)).to.be.eq(TOKENS_90);

        await sTree.addLimit(tokens(10), 16);
        /*
          Liquidity tree structure after nodeAddLiquidity(TOKENS_10):
          +---------------------------------------------------------------------------------------------------------------------------+
          |                                                                    1(300)                                                 |
          +-----------------------------------------------------------------------------------+---------------------------------------+
          |                                2(300)                                             |                   3                   |
          +---------------------------------------+-------------------------------------------+---------------------------------------+
          |              4(300)                   |                     5                     |         6         |         7         |
          +-----------------+---------------------+---------------------+---------------------+---------+---------+---------+---------+
          |      8(210)     |         9(90)       |           10        |           11        |    12   |    13   |    14   |    15   |
          +--------+--------+------------+--------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+
          | 16(110)| 17(100)|   18(90)   |   19   |     20     |    21  |      22    |   23   | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
          +--------+--------+------------+--------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+
        */
        await checkNodeAmountTo(sTree, 1, tokens(300));
        await checkNodeAmountTo(sTree, 2, tokens(300));
        await checkNodeAmountTo(sTree, 4, tokens(300));
        await checkNodeAmountTo(sTree, 8, tokens(210));
        await checkNodeAmountTo(sTree, 9, TOKENS_90);
        await checkNodeAmountTo(sTree, 16, tokens(110));
        await checkNodeAmountTo(sTree, 17, TOKENS_100); // pushed changes
        await checkNodeAmountTo(sTree, 18, TOKENS_90);

        expect(await sTree.nodeWithdrawView(16)).to.be.eq(tokens(110));
        expect(await sTree.nodeWithdrawView(17)).to.be.eq(TOKENS_100);
        expect(await sTree.nodeWithdrawView(18)).to.be.eq(TOKENS_90);

        let withdrawView17 = await sTree.nodeWithdrawView(17);
        expect(await getWithdrawnAmount(await sTree.nodeWithdraw(17))).to.be.equal(withdrawView17);
        // get 50 % of leaf 18 (90)
        expect(await getWithdrawnAmount(await sTree.nodeWithdrawPercent(18, WITHDRAW_50_PERCENT))).to.be.equal(
          tokens(45)
        );
        // get rest of leaf 18 (45)
        let withdrawView18 = await sTree.nodeWithdrawView(18);
        expect(withdrawView18).to.be.equal(tokens(45));
        expect(await getWithdrawnAmount(await sTree.nodeWithdraw(18))).to.be.equal(withdrawView18);

        //check double withdraw
        withdrawView18 = await sTree.nodeWithdrawView(18);
        expect(withdrawView18).to.be.equal(ZERO);
        expect(await getWithdrawnAmount(await sTree.nodeWithdraw(18))).to.be.equal(withdrawView18);

        await sTree.removeLimit(tokens(10), 16);
        /*+---------------------------------------------------------------------------------------------------------------------------+
          |                                                                    1(100)                                                 |
          +-----------------------------------------------------------------------------------+---------------------------------------+
          |                                2(100)                                             |                   3                   |
          +---------------------------------------+-------------------------------------------+---------------------------------------+
          |              4(100)                   |                     5                     |         6         |         7         |
          +-----------------+---------------------+---------------------+---------------------+---------+---------+---------+---------+
          |      8(100)     |         9(0)        |           10        |           11        |    12   |    13   |    14   |    15   |
          +--------+--------+------------+--------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+
          | 16(100)| 17(0)  |   18(0)    |   19   |     20     |    21  |      22    |   23   | 24 | 25 | 26 | 27 | 28 | 29 | 30 | 31 |
          +--------+--------+------------+--------+------------+--------+------------+--------+----+----+----+----+----+----+----+----+*/
        for (const i of Array(4).keys()) {
          await checkNodeAmountTo(sTree, 2 ** i, TOKENS_100);
        }
        expect(await getWithdrawnAmount(await sTree.nodeWithdraw(16))).to.be.equal(TOKENS_100);
        for (const i of Array(32).keys()) {
          await checkNodeAmountTo(sTree, i + 1, ZERO);
        }
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

      await checkNodeAmountTo(sTree, 1, TOKENS_20);
      await checkNodeAmountTo(sTree, 2, TOKENS_20);
      await checkNodeAmountTo(sTree, 3, ZERO);
      await checkNodeAmountTo(sTree, 4, TOKENS_20);
      for (const i of Array(3).keys()) await checkNodeAmountTo(sTree, i + 5, ZERO);
      await checkNodeAmountTo(sTree, 8, TOKENS_20);
      for (const i of Array(6).keys()) await checkNodeAmountTo(sTree, i + 9, ZERO);
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
        +-----------------------------------+-----------------------------------+---------------------------------------+-----------------------------+
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
      for (const i of Array(3).keys()) await checkNodeAmountTo(sTree, i + 5, ZERO);
      await checkNodeAmountTo(sTree, 8, TOKENS_10);
      for (const i of Array(7).keys()) await checkNodeAmountTo(sTree, i + 9, ZERO);
      await checkNodeAmountTo(sTree, 17, TOKENS_10);

      // remove limit with first leaf. Leaf is emty, removing from right leaf's branch
      await sTree.removeLimit(tokens(5), 16);
      /*
        Liquidity tree structure after removeLimit:
        +---------------------------------------------------------------------------------------------------------------------------------------------+
        |                                                                     1(5)                                                                    |
        +-----------------------------------------------------------------------+---------------------------------------------------------------------+
        |                                  2(5)                                 |                                       3                             |
        +-----------------------------------+-----------------------------------+---------------------------------------+-----------------------------+
        |               4(5)                |                 5                 |                   6                   |                   7         |
        +-----------------+-----------------+-----------------+-----------------+-------------------+-------------------+-------------------+---------+
        |      8(5)       |        9        |       10        |       11        |        12         |        13         |        14         |    15   |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+
        | 16(0)  | 17(10) |   18   |    19  |    20  |    21  |    22  |    23  |    24   |    25   |    26   |    27   |    28   |    29   | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+*/

      await checkNodeAmountTo(sTree, 1, TOKENS_5);
      await checkNodeAmountTo(sTree, 2, TOKENS_5);
      await checkNodeAmountTo(sTree, 3, ZERO);
      await checkNodeAmountTo(sTree, 4, TOKENS_5);
      for (const i of Array(3).keys()) await checkNodeAmountTo(sTree, i + 5, ZERO);
      await checkNodeAmountTo(sTree, 8, TOKENS_5);
      for (const i of Array(7).keys()) await checkNodeAmountTo(sTree, i + 9, ZERO);
      await checkNodeAmountTo(sTree, 17, TOKENS_10);
      expect(await sTree.nodeWithdrawView(17)).to.be.eq(TOKENS_5);

      await sTree.removeLimit(tokens(5), 16);
      /*
        Liquidity tree structure after nodeAddLiquidity:
        +---------------------------------------------------------------------------------------------------------------------------------------------+
        |                                                                     1(0)                                                                    |
        +-----------------------------------------------------------------------+---------------------------------------------------------------------+
        |                                  2(0)                                 |                                       3                             |
        +-----------------------------------+-----------------------------------+---------------------------------------+-----------------------------+
        |               4(0)                |                 5                 |                   6                   |                   7         |
        +-----------------+-----------------+-----------------+-----------------+-------------------+-------------------+-------------------+---------+
        |      8(0)       |        9        |       10        |       11        |        12         |        13         |        14         |    15   |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+
        | 16(0)  | 17(10) |   18   |    19  |    20  |    21  |    22  |    23  |    24   |    25   |    26   |    27   |    28   |    29   | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+*/

      await checkNodeAmountTo(sTree, 1, ZERO);
      await checkNodeAmountTo(sTree, 2, ZERO);
      await checkNodeAmountTo(sTree, 3, ZERO);
      await checkNodeAmountTo(sTree, 4, ZERO);
      for (const i of Array(3).keys()) await checkNodeAmountTo(sTree, i + 5, ZERO);
      await checkNodeAmountTo(sTree, 8, ZERO);
      for (const i of Array(7).keys()) await checkNodeAmountTo(sTree, i + 9, ZERO);

      await checkNodeAmountTo(sTree, 17, TOKENS_5);
      expect(await getWithdrawnAmount(await sTree.nodeWithdraw(17))).to.be.eq(ZERO);

      await checkTreeIsEmpty(sTree);
    });
    it("add liquidity to 4 leafs, withdraw first 2 leaf, removeLimit first 2 leaves affected right 2 leaves", async () => {
      for (const i of Array(4).keys()) {
        await sTree.nodeAddLiquidity(TOKENS_10);
      }
      /*
        Liquidity tree structure after nodeAddLiquidity:
        +---------------------------------------------------------------------------------------------------------------------------------------------+
        |                                                                     1(40)                                                                   |
        +-----------------------------------------------------------------------+---------------------------------------------------------------------+
        |                                  2(40)                                |                                       3                             |
        +-----------------------------------+-----------------------------------+---------------------------------------+-----------------------------+
        |              4(40)                |                 5                 |                   6                   |                   7         |
        +-----------------+-----------------+-----------------+-----------------+-------------------+-------------------+-------------------+---------+
        |     8(20)       |        9(20)    |       10        |       11        |        12         |        13         |        14         |    15   |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+
        | 16(10) | 17(10) | 18(10) | 19(10) |    20  |    21  |    22  |    23  |    24   |    25   |    26   |    27   |    28   |    29   | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+ 
      */

      for (const i of Array(2).keys()) await checkNodeAmountTo(sTree, i + 1, TOKENS_40);
      await checkNodeAmountTo(sTree, 3, ZERO);
      await checkNodeAmountTo(sTree, 4, TOKENS_40);
      for (const i of Array(3).keys()) await checkNodeAmountTo(sTree, i + 5, ZERO);
      for (const i of Array(2).keys()) await checkNodeAmountTo(sTree, i + 8, TOKENS_20);
      for (const i of Array(5).keys()) await checkNodeAmountTo(sTree, i + 10, ZERO);
      for (const i of Array(4).keys()) await checkNodeAmountTo(sTree, i + 16, TOKENS_10);

      // withdraw first 2 leaves
      await sTree.nodeWithdraw(16);
      await sTree.nodeWithdraw(17);
      /*Liquidity tree structure after nodeWithdraw:
        +---------------------------------------------------------------------------------------------------------------------------------------------+
        |                                                                     1(20)                                                                   |
        +-----------------------------------------------------------------------+---------------------------------------------------------------------+
        |                                  2(20)                                |                                       3                             |
        +-----------------------------------+---------------+-----------------------------------------------------------+-----------------------------+
        |              4(20)                |                 5                 |                   6                   |                   7         |
        +-----------------+-----------------+-----------------+-----------------+-------------------+-------------------+-------------------+---------+
        |     8(0)        |        9(20)    |       10        |       11        |        12         |        13         |        14         |    15   |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+
        | 16(0)  | 17(0)  | 18(10) | 19(10) |    20  |    21  |    22  |    23  |    24   |    25   |    26   |    27   |    28   |    29   | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+*/

      for (const i of Array(2).keys()) await checkNodeAmountTo(sTree, i + 1, TOKENS_20);
      await checkNodeAmountTo(sTree, 3, ZERO);
      await checkNodeAmountTo(sTree, 4, TOKENS_20);
      for (const i of Array(4).keys()) await checkNodeAmountTo(sTree, i + 5, ZERO);
      await checkNodeAmountTo(sTree, 9, TOKENS_20);
      for (const i of Array(7).keys()) await checkNodeAmountTo(sTree, i + 10, ZERO);
      for (const i of Array(2).keys()) await checkNodeAmountTo(sTree, i + 18, TOKENS_10);

      // remove limit with first leaf. Leaf is emty, removing from right leaf's branch
      await sTree.removeLimit(tokens(10), 17);
      /*Liquidity tree structure after removeLimit:
        +---------------------------------------------------------------------------------------------------------------------------------------------+
        |                                                                     1(10)                                                                   |
        +-----------------------------------------------------------------------+---------------------------------------------------------------------+
        |                                  2(10)                                |                                       3                             |
        +-----------------------------------+---------------+-----------------------------------------------------------+-----------------------------+
        |              4(10)                |                 5                 |                   6                   |                   7         |
        +-----------------+-----------------+-----------------+-----------------+-------------------+-------------------+-------------------+---------+
        |     8(0)        |        9(20)    |       10        |       11        |        12         |        13         |        14         |    15   |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+
        | 16(0)  | 17(0)  | 18(10) | 19(10) |    20  |    21  |    22  |    23  |    24   |    25   |    26   |    27   |    28   |    29   | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+*/
      await checkNodeAmountTo(sTree, 1, TOKENS_10);
      await checkNodeAmountTo(sTree, 2, TOKENS_10);
      await checkNodeAmountTo(sTree, 3, ZERO);
      await checkNodeAmountTo(sTree, 4, TOKENS_10);
      for (const i of Array(4).keys()) await checkNodeAmountTo(sTree, i + 5, ZERO);
      await checkNodeAmountTo(sTree, 9, TOKENS_20);
      for (const i of Array(7).keys()) await checkNodeAmountTo(sTree, i + 10, ZERO);
      for (const i of Array(2).keys()) await checkNodeAmountTo(sTree, i + 18, TOKENS_10);

      expect(await sTree.nodeWithdrawView(17)).to.be.eq(ZERO);
      expect(await sTree.nodeWithdrawView(18)).to.be.eq(TOKENS_5);
      expect(await sTree.nodeWithdrawView(19)).to.be.eq(TOKENS_5);

      // withdraw all liquidity, tree zeroed
      await sTree.nodeWithdraw(18);
      await sTree.nodeWithdraw(19);

      await checkTreeIsEmpty(sTree);
    });
    it("add liquidity to 6 leafs, withdraw first 2 leaf, removeLimit first 2 leaves affected right 4 leaves", async () => {
      for (const i of Array(2).keys()) {
        await sTree.nodeAddLiquidity(TOKENS_10);
      }
      for (const i of Array(2).keys()) {
        await sTree.nodeAddLiquidity(tokens(3));
      }
      for (const i of Array(2).keys()) {
        await sTree.nodeAddLiquidity(tokens(12));
      }
      /*Liquidity tree structure after nodeAddLiquidity:
        +---------------------------------------------------------------------------------------------------------------------------------------------+
        |                                                                     1(50)                                                                   |
        +-----------------------------------------------------------------------+---------------------------------------------------------------------+
        |                                  2(50)                                |                                       3                             |
        +-----------------------------------+-----------------------------------+---------------------------------------+-----------------------------+
        |              4(26)                |              5(24)                |                   6                   |                   7         |
        +-----------------+-----------------+-----------------+-----------------+-------------------+-------------------+-------------------+---------+
        |     8(20)       |       9(6)      |    10(24)       |       11        |        12         |        13         |        14         |    15   |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+
        | 16(10) | 17(10) |  18(3) | 19(3)  | 20(12) |  21(12)|    22  |    23  |    24   |    25   |    26   |    27   |    28   |    29   | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+*/
      for (const i of Array(2).keys()) await checkNodeAmountTo(sTree, i + 1, TOKENS_50);
      await checkNodeAmountTo(sTree, 3, ZERO);
      await checkNodeAmountTo(sTree, 4, tokens(26));
      await checkNodeAmountTo(sTree, 5, tokens(24));
      for (const i of Array(2).keys()) await checkNodeAmountTo(sTree, i + 6, ZERO);
      await checkNodeAmountTo(sTree, 8, TOKENS_20);
      await checkNodeAmountTo(sTree, 9, tokens(6));
      await checkNodeAmountTo(sTree, 10, tokens(24));
      for (const i of Array(4).keys()) await checkNodeAmountTo(sTree, i + 11, ZERO);
      for (const i of Array(2).keys()) await checkNodeAmountTo(sTree, i + 16, TOKENS_10);
      for (const i of Array(2).keys()) await checkNodeAmountTo(sTree, i + 18, tokens(3));
      for (const i of Array(2).keys()) await checkNodeAmountTo(sTree, i + 20, tokens(12));

      // withdraw first 2 leaves
      await sTree.nodeWithdraw(16);
      await sTree.nodeWithdraw(17);
      /*Liquidity tree structure after nodeWithdraw:
        +---------------------------------------------------------------------------------------------------------------------------------------------+
        |                                                                     1(30)                                                                   |
        +-----------------------------------------------------------------------+---------------------------------------------------------------------+
        |                                  2(30)                                |                                       3                             |
        +-----------------------------------+-----------------------------------+---------------------------------------+-----------------------------+
        |              4(6)                 |              5(24)                |                   6                   |                   7         |
        +-----------------+-----------------+-----------------+-----------------+-------------------+-------------------+-------------------+---------+
        |     8(0)        |       9(6)      |    10(24)       |       11        |        12         |        13         |        14         |    15   |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+
        | 16(0)  | 17(0)  |  18(3) | 19(3)  | 20(12) |  21(12)|    22  |    23  |    24   |    25   |    26   |    27   |    28   |    29   | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+*/
      for (const i of Array(2).keys()) await checkNodeAmountTo(sTree, i + 1, TOKENS_30);
      await checkNodeAmountTo(sTree, 3, ZERO);
      await checkNodeAmountTo(sTree, 4, tokens(6));
      await checkNodeAmountTo(sTree, 5, tokens(24));
      for (const i of Array(3).keys()) await checkNodeAmountTo(sTree, i + 6, ZERO);
      await checkNodeAmountTo(sTree, 9, tokens(6));
      await checkNodeAmountTo(sTree, 10, tokens(24));
      for (const i of Array(6).keys()) await checkNodeAmountTo(sTree, i + 11, ZERO);
      for (const i of Array(2).keys()) await checkNodeAmountTo(sTree, i + 18, tokens(3));
      for (const i of Array(2).keys()) await checkNodeAmountTo(sTree, i + 20, tokens(12));

      // remove limit with first leaf. Leaf is emty, removing from right leaf's branch
      await sTree.removeLimit(tokens(10), 17);

      /*Liquidity tree structure after removeLimit:
        +---------------------------------------------------------------------------------------------------------------------------------------------+
        |                                                                     1(20)                                                                   |
        +-----------------------------------------------------------------------+---------------------------------------------------------------------+
        |                                  2(20)                                |                                       3                             |
        +-----------------------------------+-----------------------------------+---------------------------------------+-----------------------------+
        |              4(4)                 |              5(16)                |                   6                   |                   7         |
        +-----------------+-----------------+-----------------+-----------------+-------------------+-------------------+-------------------+---------+
        |     8(0)        |       9(6)      |    10(16)       |       11        |        12         |        13         |        14         |    15   |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+
        | 16(0)  | 17(0)  |  18(3) | 19(3)  | 20(12) |  21(12)|    22  |    23  |    24   |    25   |    26   |    27   |    28   |    29   | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+*/
      await checkNodeAmountTo(sTree, 1, TOKENS_20);
      await checkNodeAmountTo(sTree, 2, TOKENS_20);
      await checkNodeAmountTo(sTree, 3, ZERO);
      await checkNodeAmountTo(sTree, 4, tokens(4));
      await checkNodeAmountTo(sTree, 5, tokens(16));
      for (const i of Array(3).keys()) await checkNodeAmountTo(sTree, i + 6, ZERO);
      await checkNodeAmountTo(sTree, 9, tokens(6));
      await checkNodeAmountTo(sTree, 10, tokens(16));
      for (const i of Array(6).keys()) await checkNodeAmountTo(sTree, i + 11, ZERO);
      for (const i of Array(2).keys()) await checkNodeAmountTo(sTree, i + 18, tokens(3));
      for (const i of Array(2).keys()) await checkNodeAmountTo(sTree, i + 20, tokens(12));

      expect(await sTree.nodeWithdrawView(17)).to.be.eq(ZERO);
      expect(await sTree.nodeWithdrawView(18)).to.be.eq(tokens(2));
      expect(await sTree.nodeWithdrawView(19)).to.be.eq(tokens(2));
      expect(await sTree.nodeWithdrawView(20)).to.be.eq(tokens(8));
      expect(await sTree.nodeWithdrawView(21)).to.be.eq(tokens(8));

      // withdraw all liquidity, tree zeroed
      await sTree.nodeWithdraw(18);
      await sTree.nodeWithdraw(19);
      await sTree.nodeWithdraw(20);
      await sTree.nodeWithdraw(21);

      await checkTreeIsEmpty(sTree);
    });
    it("add liquidity to 6 leafs, withdraw first 2 leaf, addLimit first 2 leaves affected right 4 leaves", async () => {
      for (const i of Array(2).keys()) await sTree.nodeAddLiquidity(TOKENS_10);
      for (const i of Array(2).keys()) await sTree.nodeAddLiquidity(tokens(3));
      for (const i of Array(2).keys()) await sTree.nodeAddLiquidity(tokens(12));
      /*
        Liquidity tree structure after nodeAddLiquidity:
        +---------------------------------------------------------------------------------------------------------------------------------------------+
        |                                                                     1(50)                                                                   |
        +-----------------------------------------------------------------------+---------------------------------------------------------------------+
        |                                  2(50)                                |                                       3                             |
        +-----------------------------------+-----------------------------------+---------------------------------------+-----------------------------+
        |              4(26)                |              5(24)                |                   6                   |                   7         |
        +-----------------+-----------------+-----------------+-----------------+-------------------+-------------------+-------------------+---------+
        |     8(20)       |       9(6)      |    10(24)       |       11        |        12         |        13         |        14         |    15   |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+
        | 16(10) | 17(10) |  18(3) | 19(3)  | 20(12) |  21(12)|    22  |    23  |    24   |    25   |    26   |    27   |    28   |    29   | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+ 
      */

      await checkNodeAmountTo(sTree, 1, TOKENS_50);
      await checkNodeAmountTo(sTree, 2, TOKENS_50);
      await checkNodeAmountTo(sTree, 3, ZERO);
      await checkNodeAmountTo(sTree, 4, tokens(26));
      await checkNodeAmountTo(sTree, 5, tokens(24));
      await checkNodeAmountTo(sTree, 6, ZERO);
      await checkNodeAmountTo(sTree, 7, ZERO);
      await checkNodeAmountTo(sTree, 8, TOKENS_20);
      await checkNodeAmountTo(sTree, 9, tokens(6));
      await checkNodeAmountTo(sTree, 10, tokens(24));
      for (const i of Array(4).keys()) await checkNodeAmountTo(sTree, i + 11, ZERO);
      await checkNodeAmountTo(sTree, 16, TOKENS_10);
      await checkNodeAmountTo(sTree, 17, TOKENS_10);
      await checkNodeAmountTo(sTree, 18, tokens(3));
      await checkNodeAmountTo(sTree, 19, tokens(3));
      await checkNodeAmountTo(sTree, 20, tokens(12));
      await checkNodeAmountTo(sTree, 21, tokens(12));

      // withdraw first 2 leaves
      await sTree.nodeWithdraw(16);
      await sTree.nodeWithdraw(17);
      /*
        Liquidity tree structure after nodeWithdraw:
        +---------------------------------------------------------------------------------------------------------------------------------------------+
        |                                                                     1(30)                                                                   |
        +-----------------------------------------------------------------------+---------------------------------------------------------------------+
        |                                  2(30)                                |                                       3                             |
        +-----------------------------------+-----------------------------------+---------------------------------------+-----------------------------+
        |              4(6)                 |              5(24)                |                   6                   |                   7         |
        +-----------------+-----------------+-----------------+-----------------+-------------------+-------------------+-------------------+---------+
        |     8(0)        |       9(6)      |    10(24)       |       11        |        12         |        13         |        14         |    15   |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+
        | 16(0)  | 17(0)  |  18(3) | 19(3)  | 20(12) |  21(12)|    22  |    23  |    24   |    25   |    26   |    27   |    28   |    29   | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+ 
      */

      await checkNodeAmountTo(sTree, 1, TOKENS_30);
      await checkNodeAmountTo(sTree, 2, TOKENS_30);
      await checkNodeAmountTo(sTree, 3, ZERO);
      await checkNodeAmountTo(sTree, 4, tokens(6));
      await checkNodeAmountTo(sTree, 5, tokens(24));
      for (const i of Array(3).keys()) await checkNodeAmountTo(sTree, i + 6, ZERO);
      await checkNodeAmountTo(sTree, 9, tokens(6));
      await checkNodeAmountTo(sTree, 10, tokens(24));
      for (const i of Array(6).keys()) await checkNodeAmountTo(sTree, i + 11, ZERO);
      await checkNodeAmountTo(sTree, 18, tokens(3));
      await checkNodeAmountTo(sTree, 19, tokens(3));
      await checkNodeAmountTo(sTree, 20, tokens(12));
      await checkNodeAmountTo(sTree, 21, tokens(12));

      // remove limit with first leaf. Leaf is emty, removing from right leaf's branch
      await sTree.addLimit(tokens(10), 17);
      /*
        Liquidity tree structure after removeLimit:
        +---------------------------------------------------------------------------------------------------------------------------------------------+
        |                                                                     1(40)                                                                   |
        +-----------------------------------------------------------------------+---------------------------------------------------------------------+
        |                                  2(40)                                |                                       3                             |
        +-----------------------------------+-----------------------------------+---------------------------------------+-----------------------------+
        |              4(8)                 |              5(32)                |                   6                   |                   7         |
        +-----------------+-----------------+-----------------+-----------------+-------------------+-------------------+-------------------+---------+
        |     8(0)        |       9(6)      |    10(32)       |       11        |        12         |        13         |        14         |    15   |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+
        | 16(0)  | 17(0)  |  18(3) | 19(3)  | 20(12) |  21(12)|    22  |    23  |    24   |    25   |    26   |    27   |    28   |    29   | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+----+----+ 
      */

      await checkNodeAmountTo(sTree, 1, TOKENS_40);
      await checkNodeAmountTo(sTree, 2, TOKENS_40);
      await checkNodeAmountTo(sTree, 3, ZERO);
      await checkNodeAmountTo(sTree, 4, tokens(8));
      await checkNodeAmountTo(sTree, 5, tokens(32));
      for (const i of Array(3).keys()) await checkNodeAmountTo(sTree, i + 6, ZERO);
      await checkNodeAmountTo(sTree, 9, tokens(6));
      await checkNodeAmountTo(sTree, 10, tokens(32));
      for (const i of Array(6).keys()) await checkNodeAmountTo(sTree, i + 11, ZERO);
      await checkNodeAmountTo(sTree, 18, tokens(3));
      await checkNodeAmountTo(sTree, 19, tokens(3));
      await checkNodeAmountTo(sTree, 20, tokens(12));
      await checkNodeAmountTo(sTree, 21, tokens(12));

      expect(await sTree.nodeWithdrawView(17)).to.be.eq(ZERO);
      expect(await sTree.nodeWithdrawView(18)).to.be.eq(tokens(4));
      expect(await sTree.nodeWithdrawView(19)).to.be.eq(tokens(4));
      expect(await sTree.nodeWithdrawView(20)).to.be.eq(tokens(16));
      expect(await sTree.nodeWithdrawView(21)).to.be.eq(tokens(16));

      // withdraw all liquidity, tree zeroed
      for (const i of Array(4).keys()) await sTree.nodeWithdraw(i + 18);

      await checkTreeIsEmpty(sTree);
    });
    it("add liquidity to 16 leafs, withdraw first 15 leaf, addLimit, removeLimit affected last leaf", async () => {
      for (const i of Array(16).keys()) {
        await sTree.nodeAddLiquidity(TOKENS_10);
      }
      /*Liquidity tree structure after nodeAddLiquidity:
        +-----------------------------------------------------------------------------------------------------------------------------------------------------+
        |                                                                   1(160)                                                                            |
        +-----------------------------------------------------------------------+-----------------------------------------------------------------------------+
        |                                  2(80)                                |                                     3(80)                                   |
        +-----------------------------------+-----------------------------------+---------------------------------------+-------------------------------------+
        |              4(40)                |              5(40)                |                 6(40)                 |                 7(40)               |
        +-----------------+-----------------+-----------------+-----------------+-------------------+-------------------+-------------------+-----------------+
        |     8(20)       |       9(20)     |    10(20)       |     11(20)      |      12(20)       |      13(20)       |      14(20)       |      15(20)     |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+--------+--------+
        | 16(10) | 17(10) |  18(10)| 19(10) | 20(10) |  21(10)|  22(10)| 23(10) |  24(10) |  25(10) |  26(10) |  27(10) | 28(10)  | 29(10)  | 30(10) | 31(10) |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+--------+--------+*/
      await checkNodeAmountTo(sTree, 1, tokens(160));
      await checkNodeAmountTo(sTree, 2, TOKENS_80);
      await checkNodeAmountTo(sTree, 3, TOKENS_80);
      for (const i of Array(4).keys()) await checkNodeAmountTo(sTree, i + 4, TOKENS_40);
      for (const i of Array(8).keys()) await checkNodeAmountTo(sTree, i + 8, TOKENS_20);
      for (const i of Array(16).keys()) await checkNodeAmountTo(sTree, i + 16, TOKENS_10);

      // withdraw first 15 leaves
      for (const i of Array(15).keys()) await sTree.nodeWithdraw(i + 16);

      /*Liquidity tree structure after nodeWithdraw:
        +-----------------------------------------------------------------------------------------------------------------------------------------------------+
        |                                                                   1(10)                                                                             |
        +-----------------------------------------------------------------------+-----------------------------------------------------------------------------+
        |                                  2(0)                                 |                                     3(10)                                   |
        +-----------------------------------+-----------------------------------+---------------------------------------+-------------------------------------+
        |              4(0)                 |              5(0)                 |                 6(0)                  |                 7(10)               |
        +-----------------+-----------------+-----------------+-----------------+-------------------+-------------------+-------------------+-----------------+
        |     8(0)        |       9(0)      |    10(0)        |     11(0)       |      12(0)        |      13(0)        |      14(0)        |      15(10)     |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+--------+--------+
        | 16(0)  | 17(0)  |  18(0) | 19(0)  | 20(0)  |  21(0) |  22(0) | 23(0)  |  24(0)  |  25(0)  |  26(0)  |  27(0)  | 28(0)   | 29(0)   | 30(0)  | 31(10) |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+--------+--------+*/
      await checkNodeAmountTo(sTree, 1, TOKENS_10);
      await checkNodeAmountTo(sTree, 2, ZERO);
      await checkNodeAmountTo(sTree, 3, TOKENS_10);
      for (const i of Array(3).keys()) await checkNodeAmountTo(sTree, i + 4, ZERO);
      await checkNodeAmountTo(sTree, 7, TOKENS_10);
      for (const i of Array(7).keys()) await checkNodeAmountTo(sTree, i + 8, ZERO);
      await checkNodeAmountTo(sTree, 15, TOKENS_10);
      for (const i of Array(15).keys()) await checkNodeAmountTo(sTree, i + 16, ZERO);
      await checkNodeAmountTo(sTree, 31, TOKENS_10);

      // remove limit with first leaf. Leaf is emty, removing from right leaf's branch
      await sTree.addLimit(tokens(5), 16);
      /*Liquidity tree structure after addLimit:
        +-----------------------------------------------------------------------------------------------------------------------------------------------------+
        |                                                                   1(15)                                                                             |
        +-----------------------------------------------------------------------+-----------------------------------------------------------------------------+
        |                                  2(0)                                 |                                     3(10)                                   |
        +-----------------------------------+-----------------------------------+---------------------------------------+-------------------------------------+
        |              4(0)                 |              5(0)                 |                 6(0)                  |                 7(10)               |
        +-----------------+-----------------+-----------------+-----------------+-------------------+-------------------+-------------------+-----------------+
        |     8(0)        |       9(0)      |    10(0)        |     11(0)       |      12(0)        |      13(0)        |      14(0)        |      15(10)     |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+--------+--------+
        | 16(0)  | 17(0)  |  18(0) | 19(0)  | 20(0)  |  21(0) |  22(0) | 23(0)  |  24(0)  |  25(0)  |  26(0)  |  27(0)  | 28(0)   | 29(0)   | 30(0)  | 31(10) |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+--------+--------+*/
      await checkNodeAmountTo(sTree, 1, tokens(15));
      await checkNodeAmountTo(sTree, 2, ZERO);
      await checkNodeAmountTo(sTree, 3, TOKENS_10);
      for (const i of Array(3).keys()) await checkNodeAmountTo(sTree, i + 4, ZERO);
      await checkNodeAmountTo(sTree, 7, TOKENS_10);
      for (const i of Array(7).keys()) await checkNodeAmountTo(sTree, i + 8, ZERO);
      await checkNodeAmountTo(sTree, 15, TOKENS_10);
      for (const i of Array(15).keys()) await checkNodeAmountTo(sTree, i + 16, ZERO);
      await checkNodeAmountTo(sTree, 31, TOKENS_10); // unchanged because of lazy (update stoped at #1)

      expect(await sTree.nodeWithdrawView(31)).to.be.eq(tokens(15));

      // remove limit with first leaf. Leaf is emty, removing from right leaf's branch
      await sTree.removeLimit(tokens(10), 30);
      /*Liquidity tree structure after removeLimit:
        +-----------------------------------------------------------------------------------------------------------------------------------------------------+
        |                                                                   1(5)                                                                              |
        +-----------------------------------------------------------------------+-----------------------------------------------------------------------------+
        |                                  2(0)                                 |                                     3(10)                                   |
        +-----------------------------------+-----------------------------------+---------------------------------------+-------------------------------------+
        |              4(0)                 |              5(0)                 |                 6(0)                  |                 7(10)               |
        +-----------------+-----------------+-----------------+-----------------+-------------------+-------------------+-------------------+-----------------+
        |     8(0)        |       9(0)      |    10(0)        |     11(0)       |      12(0)        |      13(0)        |      14(0)        |      15(10)     |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+--------+--------+
        | 16(0)  | 17(0)  |  18(0) | 19(0)  | 20(0)  |  21(0) |  22(0) | 23(0)  |  24(0)  |  25(0)  |  26(0)  |  27(0)  | 28(0)   | 29(0)   | 30(0)  | 31(10) |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+--------+--------+*/
      await checkNodeAmountTo(sTree, 1, TOKENS_5);
      await checkNodeAmountTo(sTree, 2, ZERO);
      await checkNodeAmountTo(sTree, 3, tokens(15));
      for (const i of Array(3).keys()) await checkNodeAmountTo(sTree, i + 4, ZERO);
      await checkNodeAmountTo(sTree, 7, tokens(15));
      for (const i of Array(7).keys()) await checkNodeAmountTo(sTree, i + 8, ZERO);
      await checkNodeAmountTo(sTree, 15, tokens(15));
      for (const i of Array(15).keys()) await checkNodeAmountTo(sTree, i + 16, ZERO);
      await checkNodeAmountTo(sTree, 31, tokens(15));

      // withdraw all liquidity, tree zeroed
      await sTree.nodeWithdraw(31);
      await checkTreeIsEmpty(sTree);
    });
    it("add liquidity to 16 leafs, removeLimit for insufficient leaves (left subtree), affected last leaves", async () => {
      for (const i of Array(16).keys()) {
        await sTree.nodeAddLiquidity(TOKENS_10);
      }
      /*Liquidity tree structure after nodeAddLiquidity:
        +-----------------------------------------------------------------------------------------------------------------------------------------------------+
        |                                                                   1(160)                                                                            |
        +-----------------------------------------------------------------------+-----------------------------------------------------------------------------+
        |                                  2(80)                                |                                     3(80)                                   |
        +-----------------------------------+-----------------------------------+---------------------------------------+-------------------------------------+
        |              4(40)                |              5(40)                |                 6(40)                 |                 7(40)               |
        +-----------------+-----------------+-----------------+-----------------+-------------------+-------------------+-------------------+-----------------+
        |     8(20)       |       9(20)     |    10(20)       |     11(20)      |      12(20)       |      13(20)       |      14(20)       |      15(20)     |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+--------+--------+
        | 16(10) | 17(10) |  18(10)| 19(10) | 20(10) |  21(10)|  22(10)| 23(10) |  24(10) |  25(10) |  26(10) |  27(10) | 28(10)  | 29(10)  | 30(10) | 31(10) |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+--------+--------+*/
      await checkNodeAmountTo(sTree, 1, tokens(160));
      for (const i of Array(2).keys()) await checkNodeAmountTo(sTree, i + 2, TOKENS_80); // unchanged because of lazy (update stoped at #1)
      for (const i of Array(4).keys()) await checkNodeAmountTo(sTree, i + 4, TOKENS_40); // unchanged because of lazy (update stoped at #1)
      for (const i of Array(8).keys()) await checkNodeAmountTo(sTree, i + 8, TOKENS_20); // unchanged because of lazy (update stoped at #1)
      for (const i of Array(16).keys()) await checkNodeAmountTo(sTree, i + 16, TOKENS_10); // unchanged because of lazy (update stoped at #1)

      await sTree.removeLimit(tokens(96), 22); // insufficient for total 7*10 = 70 amount, remove from top
      /*
        Liquidity tree structure after nodeAddLiquidity:
        +-----------------------------------------------------------------------------------------------------------------------------------------------------+
        |                                                                    1(64)                                                                            |
        +-----------------------------------------------------------------------+-----------------------------------------------------------------------------+
        |                                  2(80)                                |                                     3(80)                                   |
        +-----------------------------------+-----------------------------------+---------------------------------------+-------------------------------------+
        |              4(40)                |              5(40)                |                 6(40)                 |                 7(40)               |
        +-----------------+-----------------+-----------------+-----------------+-------------------+-------------------+-------------------+-----------------+
        |     8(20)       |       9(20)     |    10(20)       |     11(20)      |      12(20)       |      13(20)       |      14(20)       |      15(20)     |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+--------+--------+
        | 16(10) | 17(10) |  18(10)| 19(10) | 20(10) |  21(10)|  22(10)| 23(10) |  24(10) |  25(10) |  26(10) |  27(10) | 28(10)  | 29(10)  | 30(10) | 31(10) |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+--------+--------+ 
      */
      await checkNodeAmountTo(sTree, 1, tokens(64));
      for (const i of Array(2).keys()) await checkNodeAmountTo(sTree, i + 2, TOKENS_80); // unchanged because of lazy (update stoped at #1)
      for (const i of Array(4).keys()) await checkNodeAmountTo(sTree, i + 4, TOKENS_40); // unchanged because of lazy (update stoped at #1)
      for (const i of Array(8).keys()) await checkNodeAmountTo(sTree, i + 8, TOKENS_20); // unchanged because of lazy (update stoped at #1)
      for (const i of Array(16).keys()) await checkNodeAmountTo(sTree, i + 16, TOKENS_10); // unchanged because of lazy (update stoped at #1)

      for (const i of Array(16).keys()) expect(await sTree.nodeWithdrawView(i + 16)).to.be.eq(tokens(4)); //10 - 6 for every leaf

      for (const i of Array(16).keys()) await sTree.nodeWithdraw(i + 16);
      await checkTreeIsEmpty(sTree);
    });
    it("add liquidity to 16 leafs, addLimit for zeroed leaves (left subtree), affected all non zero leaves", async () => {
      for (const i of Array(16).keys()) await sTree.nodeAddLiquidity(TOKENS_10);
      for (const i of Array(7).keys()) await sTree.nodeWithdraw(i + 16);
      /*Liquidity tree structure after nodeAddLiquidity and removed #16 - #22:
        +-----------------------------------------------------------------------------------------------------------------------------------------------------+
        |                                                                   1(90)                                                                            |
        +-----------------------------------------------------------------------+-----------------------------------------------------------------------------+
        |                                  2(10)                                |                                     3(80)                                   |
        +-----------------------------------+-----------------------------------+---------------------------------------+-------------------------------------+
        |               4(0)                |              5(10)                |                 6(40)                 |                 7(40)               |
        +-----------------+-----------------+-----------------+-----------------+-------------------+-------------------+-------------------+-----------------+
        |      8(0)       |       9(0)      |     10(0)       |     11(10)      |      12(20)       |      13(20)       |      14(20)       |      15(20)     |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+--------+--------+
        | 16(0)  | 17(0)  |  18(0) | 19(0)  | 20(0)  |  21(0) |  22(0) | 23(10) |  24(10) |  25(10) |  26(10) |  27(10) | 28(10)  | 29(10)  | 30(10) | 31(10) |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+--------+--------+*/
      await checkNodeAmountTo(sTree, 1, TOKENS_90);
      await checkNodeAmountTo(sTree, 2, TOKENS_10);
      await checkNodeAmountTo(sTree, 3, TOKENS_80);
      await checkNodeAmountTo(sTree, 4, ZERO);
      await checkNodeAmountTo(sTree, 5, TOKENS_10);
      for (const i of Array(2).keys()) await checkNodeAmountTo(sTree, i + 6, TOKENS_40);
      for (const i of Array(3).keys()) await checkNodeAmountTo(sTree, i + 8, ZERO);
      await checkNodeAmountTo(sTree, 11, TOKENS_10);
      for (const i of Array(4).keys()) await checkNodeAmountTo(sTree, i + 12, TOKENS_20);
      for (const i of Array(7).keys()) await checkNodeAmountTo(sTree, i + 16, ZERO);
      for (const i of Array(9).keys()) await checkNodeAmountTo(sTree, i + 23, TOKENS_10);

      await sTree.addLimit(TOKENS_90, 22);
      /*Liquidity tree structure after addLimit to zeroed #22, add to all tree:
        +-----------------------------------------------------------------------------------------------------------------------------------------------------+
        |                                                                   1(180)                                                                            |
        +-----------------------------------------------------------------------+-----------------------------------------------------------------------------+
        |                                  2(10)                                |                                     3(80)                                   |
        +-----------------------------------+-----------------------------------+---------------------------------------+-------------------------------------+
        |               4(0)                |              5(10)                |                 6(40)                 |                 7(40)               |
        +-----------------+-----------------+-----------------+-----------------+-------------------+-------------------+-------------------+-----------------+
        |      8(0)       |       9(0)      |     10(0)       |     11(10)      |      12(20)       |      13(20)       |      14(20)       |      15(20)     |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+--------+--------+
        | 16(0)  | 17(0)  |  18(0) | 19(0)  | 20(0)  |  21(0) |  22(0) | 23(10) |  24(10) |  25(10) |  26(10) |  27(10) | 28(10)  | 29(10)  | 30(10) | 31(10) |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+--------+--------+*/
      await checkNodeAmountTo(sTree, 1, tokens(180));
      // All rest nodes unchanged because of lazy (update stoped at #1)
      await checkNodeAmountTo(sTree, 2, TOKENS_10);
      await checkNodeAmountTo(sTree, 3, TOKENS_80);
      await checkNodeAmountTo(sTree, 4, ZERO);
      await checkNodeAmountTo(sTree, 5, TOKENS_10);
      for (const i of Array(2).keys()) await checkNodeAmountTo(sTree, i + 6, TOKENS_40);
      for (const i of Array(3).keys()) await checkNodeAmountTo(sTree, i + 8, ZERO);
      await checkNodeAmountTo(sTree, 11, TOKENS_10);
      for (const i of Array(4).keys()) await checkNodeAmountTo(sTree, i + 12, TOKENS_20);
      for (const i of Array(7).keys()) await checkNodeAmountTo(sTree, i + 16, ZERO);
      for (const i of Array(9).keys()) await checkNodeAmountTo(sTree, i + 23, TOKENS_10);

      for (const i of Array(7).keys()) expect(await sTree.nodeWithdrawView(i + 16)).to.be.eq(ZERO); //not distributed on zero values
      for (const i of Array(9).keys()) expect(await sTree.nodeWithdrawView(i + 23)).to.be.eq(TOKENS_20); //10 + 10 for every leaf from #23

      // withdraw all and check tree zeroed
      for (const i of Array(9).keys()) await sTree.nodeWithdraw(i + 23);
      await checkTreeIsEmpty(sTree);
    });
    it("add liquidity to 15 leafs, addLimit for zeroed leaves (right subtree), affected all non zero leaves", async () => {
      for (const i of Array(15).keys()) await sTree.nodeAddLiquidity(TOKENS_10);
      for (const i of Array(9).keys()) await sTree.nodeWithdraw(i + 16);
      /*Liquidity tree structure after nodeAddLiquidity and removed #16 - #24:
        +-----------------------------------------------------------------------------------------------------------------------------------------------------+
        |                                                                    1(60)                                                                            |
        +-----------------------------------------------------------------------+-----------------------------------------------------------------------------+
        |                                   2(0)                                |                                     3(60)                                   |
        +-----------------------------------+-----------------------------------+---------------------------------------+-------------------------------------+
        |               4(0)                |               5(0)                |                 6(30)                 |                 7(30)               |
        +-----------------+-----------------+-----------------+-----------------+-------------------+-------------------+-------------------+-----------------+
        |      8(0)       |       9(0)      |     10(0)       |      11(0)      |      12(10)       |      13(20)       |      14(20)       |      15(10)     |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+--------+--------+
        | 16(0)  | 17(0)  |  18(0) | 19(0)  | 20(0)  |  21(0) |  22(0) |  23(0) |  24(0)  |  25(10) |  26(10) |  27(10) | 28(10)  | 29(10)  | 30(10) | 31(0)  |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+--------+--------+*/
      await checkNodeAmountTo(sTree, 1, TOKENS_60);
      await checkNodeAmountTo(sTree, 2, ZERO);
      await checkNodeAmountTo(sTree, 3, TOKENS_60);
      await checkNodeAmountTo(sTree, 4, ZERO);
      await checkNodeAmountTo(sTree, 5, ZERO);
      for (const i of Array(2).keys()) await checkNodeAmountTo(sTree, i + 6, TOKENS_30);
      for (const i of Array(4).keys()) await checkNodeAmountTo(sTree, i + 8, ZERO);
      await checkNodeAmountTo(sTree, 12, TOKENS_10);
      for (const i of Array(2).keys()) await checkNodeAmountTo(sTree, i + 13, TOKENS_20);
      await checkNodeAmountTo(sTree, 15, TOKENS_10);
      for (const i of Array(9).keys()) await checkNodeAmountTo(sTree, i + 16, ZERO);
      for (const i of Array(6).keys()) await checkNodeAmountTo(sTree, i + 25, TOKENS_10);
      await checkNodeAmountTo(sTree, 31, ZERO);

      await sTree.addLimit(TOKENS_60, 24);
      /*Liquidity tree structure after nodeAddLiquidity and removed #16 - #24:
        +-----------------------------------------------------------------------------------------------------------------------------------------------------+
        |                                                                    1(120)                                                                           |
        +-----------------------------------------------------------------------+-----------------------------------------------------------------------------+
        |                                   2(0)                                |                                     3(120)                                  |
        +-----------------------------------+-----------------------------------+---------------------------------------+-------------------------------------+
        |               4(0)                |               5(0)                |                 6(60)                 |                 7(60)               |
        +-----------------+-----------------+-----------------+-----------------+-------------------+-------------------+-------------------+-----------------+
        |      8(0)       |       9(0)      |     10(0)       |      11(0)      |      12(10)       |      13(20)       |      14(20)       |      15(20)     |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+--------+--------+
        | 16(0)  | 17(0)  |  18(0) | 19(0)  | 20(0)  |  21(0) |  22(0) |  23(0) |  24(0)  |  25(10) |  26(10) |  27(10) | 28(10)  | 29(10)  | 30(20) | 31(0)  |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+---------+---------+--------+--------+*/
      await checkNodeAmountTo(sTree, 1, tokens(120));
      await checkNodeAmountTo(sTree, 2, ZERO);
      await checkNodeAmountTo(sTree, 3, tokens(120));
      await checkNodeAmountTo(sTree, 4, ZERO);
      await checkNodeAmountTo(sTree, 5, ZERO);
      for (const i of Array(2).keys()) await checkNodeAmountTo(sTree, i + 6, TOKENS_60);
      for (const i of Array(4).keys()) await checkNodeAmountTo(sTree, i + 8, ZERO);
      await checkNodeAmountTo(sTree, 12, TOKENS_10);
      await checkNodeAmountTo(sTree, 13, TOKENS_20);
      await checkNodeAmountTo(sTree, 14, TOKENS_40);
      await checkNodeAmountTo(sTree, 15, TOKENS_20);
      for (const i of Array(9).keys()) await checkNodeAmountTo(sTree, i + 16, ZERO);
      for (const i of Array(5).keys()) await checkNodeAmountTo(sTree, i + 25, TOKENS_10);
      await checkNodeAmountTo(sTree, 30, TOKENS_20);
      await checkNodeAmountTo(sTree, 31, ZERO);

      // All add distributed to non zero leaves
      for (const i of Array(6).keys()) expect(await sTree.nodeWithdrawView(i + 25)).to.be.eq(TOKENS_20);

      // withdraw all and check tree zeroed
      for (const i of Array(6).keys()) await sTree.nodeWithdraw(i + 25);
      await checkTreeIsEmpty(sTree);
    });
    it("add liquidity to 22 leafs, top remove 7, withdraw leaf", async () => {
      for (const i of Array(14).keys()) await sTree.nodeAddLiquidity(TOKENS_100);
      /*Liquidity tree structure after nodeAddLiquidity:
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
            100    100        100      100      100      100      100      100       100      100       100        100      100      100               */
      expect(await getNodeAmount(sTree, 1)).to.be.equal(tokens(1400));
      expect(await getNodeAmount(sTree, 2)).to.be.equal(tokens(800));
      expect(await getNodeAmount(sTree, 3)).to.be.equal(tokens(600));
      expect(await getNodeAmount(sTree, 4)).to.be.equal(TOKENS_400);
      expect(await getNodeAmount(sTree, 5)).to.be.equal(TOKENS_400);
      expect(await getNodeAmount(sTree, 6)).to.be.equal(TOKENS_400);
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
      expect(await getNodeAmount(sTree, 3)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 4)).to.be.equal(TOKENS_400);
      expect(await getNodeAmount(sTree, 5)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 6)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 7)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 8)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 9)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 10)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 11)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 12)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 13)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 14)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 16)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 17)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 18)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 19)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 20)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 21)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 22)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 23)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 24)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 25)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 26)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 27)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 28)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 29)).to.be.equal(ZERO);

      // remove 7
      await sTree.remove(tokens(7));

      /*
        Liquidity tree structure after nodeAddLiquidity:
        +-----------------------------------------------------------------------------------------------------------------------------------------------------+
        |                                                                    1(693)                                                                           |
        +-----------------------------------------------------------------------+-----------------------------------------------------------------------------+
        |                                2(495)                                 |                                    3(198)                                   |
        +-----------------------------------+---------------+-----------------------------------------------------------+-------------------------------------+
        |              4(400)               |              5(100)               |                  6(198)               |               7(0)                  |
        +-----------------+-----------------+-----------------+-----------------+-------------------+-------------------+---------------------------+---------+
        |     8(200)      |     9(200)      |    10(100)      |      11(0)      |        12(0)      |       13(200)     |             14(0)         |    15   |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+--------------+------------+----+----+
        | 16(100)| 17(100)| 18(100)| 19(100)| 20(100)| 21(0)  | 22(0)  | 23(0)  | 24(0)   | 25(0)   | 26(100) | 27(100) |      28(0)   |    29(0)   | 30 | 31 |
        +--------+--------+--------+--------+--------+--------+--------+--------+---------+---------+---------+---------+--------------+------------+----+----+
            100    100        100      100      100                                                      100      100                         
      */

      expect(await getNodeAmount(sTree, 1)).to.be.equal(tokens(693));
      expect(await getNodeAmount(sTree, 2)).to.be.equal(tokens(495));
      expect(await getNodeAmount(sTree, 3)).to.be.equal(tokens(198));
      expect(await getNodeAmount(sTree, 4)).to.be.equal(TOKENS_400);
      expect(await getNodeAmount(sTree, 5)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 6)).to.be.equal(tokens(198));
      expect(await getNodeAmount(sTree, 7)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 8)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 9)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 10)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 11)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 12)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 13)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 14)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 16)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 17)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 18)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 19)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 20)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 21)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 22)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 23)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 24)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 25)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 26)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 27)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 28)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 29)).to.be.equal(ZERO);

      expect(await sTree.nodeWithdrawView(20)).to.be.equal(tokens(99));
    });
  });
  describe("Example tree (4 leaves)", async () => {
    before(async () => {
      sTree = await prepareTree(ethers, EXAMPLE_TREE_LEAFS);
    });
    it("nodeAddLiquidity(100$)", async () => {
      await sTree.nodeAddLiquidity(TOKENS_100);
      await sTree.nodeAddLiquidity(TOKENS_200);
      /*+---------------------------------------------+
        |                    1 (300$)                 |
        +-------------------------+-------------------+
        |          2 (300$)       |      3 (0$)       |
        +-------------+-----------+---------+---------+
        |   4 (100$)  |  5 (200$) |  6 (0$) |  7 (0$) |
        +-------------+-----------+---------+---------+*/
      expect(await getNodeAmount(sTree, 1)).to.be.equal(TOKENS_300);
      expect(await getNodeAmount(sTree, 2)).to.be.equal(TOKENS_300);
      expect(await getNodeAmount(sTree, 4)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 5)).to.be.equal(TOKENS_200);
    });
    it("remove(30$) and addliquidity", async () => {
      await sTree.remove(TOKENS_30);
      /*+---------------------------------------------+
        |                    1 (270$)                 |
        +-------------------------+-------------------+
        |          2 (270$)       |      3 (0$)       |
        +-------------+-----------+---------+---------+
        |   4 (100$)  |  5 (200$) |  6 (0$) |  7 (0$) |
        +-------------+-----------+---------+---------+*/
      expect(await getNodeAmount(sTree, 1)).to.be.equal(TOKENS_270);
      expect(await getNodeAmount(sTree, 2)).to.be.equal(TOKENS_270);
      expect(await getNodeAmount(sTree, 4)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 5)).to.be.equal(TOKENS_200);

      await sTree.nodeAddLiquidity(TOKENS_300);
      /*+----------------------------------------------+
        |                    1 (570$)                  |
        +-------------------------+--------------------+
        |          2 (270$)       |     3 (300$)       |
        +-------------+-----------+----------+---------+
        |   4 (100$)  |  5 (200$) | 6 (300$) |  7 (0$) |
        +-------------+-----------+---------+---------+*/
      expect(await getNodeAmount(sTree, 1)).to.be.equal(tokens(570));
      expect(await getNodeAmount(sTree, 2)).to.be.equal(TOKENS_270);
      expect(await getNodeAmount(sTree, 3)).to.be.equal(TOKENS_300);
      expect(await getNodeAmount(sTree, 4)).to.be.equal(TOKENS_100);
      expect(await getNodeAmount(sTree, 5)).to.be.equal(TOKENS_200);
      expect(await getNodeAmount(sTree, 6)).to.be.equal(TOKENS_300);
    });
    it("addLimit(15$, #5)", async () => {
      await sTree.addLimit(tokens(15), 5);
      /*+----------------------------------------------+
        |                    1 (585$)                  |
        +-------------------------+--------------------+
        |          2 (285$)       |     3 (300$)       |
        +-------------+-----------+----------+---------+
        |   4 (100$)  |  5 (200$) | 6 (300$) |  7 (0$) |
        +-------------+-----------+---------+---------+*/
      expect(await getNodeAmount(sTree, 1)).to.be.equal(tokens(585));
      expect(await getNodeAmount(sTree, 2)).to.be.equal(tokens(285));
      expect(await getNodeAmount(sTree, 3)).to.be.equal(TOKENS_300);
      expect(await getNodeAmount(sTree, 4)).to.be.equal(TOKENS_90);
      expect(await getNodeAmount(sTree, 5)).to.be.equal(tokens(180));
      expect(await getNodeAmount(sTree, 6)).to.be.equal(TOKENS_300);
    });
    it("nodeWithdraw(4)", async () => {
      let withdrawAmount4 = await sTree.nodeWithdrawView(4);
      let tx4 = await sTree.nodeWithdraw(4);
      /*+----------------------------------------------+
        |                    1 (490$)                  |
        +-------------------------+--------------------+
        |          2 (190$)       |     3 (300$)       |
        +-------------+-----------+----------+---------+
        |    4 (0$)   |  5 (200$) | 6 (300$) |  7 (0$) |
        +-------------+-----------+---------+---------+*/
      expect(await getNodeAmount(sTree, 1)).to.be.equal(tokens(490));
      expect(await getNodeAmount(sTree, 2)).to.be.equal(TOKENS_190);
      expect(await getNodeAmount(sTree, 3)).to.be.equal(TOKENS_300);
      expect(await getNodeAmount(sTree, 4)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 5)).to.be.equal(TOKENS_190);
      expect(await getNodeAmount(sTree, 6)).to.be.equal(TOKENS_300);
      expect(withdrawAmount4).to.be.equal(tokens(95));
      expect(await getWithdrawnAmount(tx4)).to.be.equal(withdrawAmount4);
    });
    it("nodeWithdraw(5)", async () => {
      let withdrawAmount5 = await sTree.nodeWithdrawView(5);
      let tx5 = await sTree.nodeWithdraw(5);
      /*+----------------------------------------------+
        |                    1 (300$)                  |
        +-------------------------+--------------------+
        |           2 (0$)        |     3 (300$)       |
        +-------------+-----------+----------+---------+
        |    4 (0$)   |   5 (0$)  | 6 (300$) |  7 (0$) |
        +-------------+-----------+---------+---------+*/
      expect(await getNodeAmount(sTree, 1)).to.be.equal(TOKENS_300);
      expect(await getNodeAmount(sTree, 2)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 3)).to.be.equal(TOKENS_300);
      expect(await getNodeAmount(sTree, 4)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 5)).to.be.equal(ZERO);
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

      expect(await getNodeAmount(sTree, 1)).to.be.equal(TOKENS_60);
      expect(await getNodeAmount(sTree, 2)).to.be.equal(TOKENS_20);
      expect(await getNodeAmount(sTree, 3)).to.be.equal(TOKENS_40);
      expect(await getNodeAmount(sTree, 4)).to.be.equal(TOKENS_20);
      expect(await getNodeAmount(sTree, 5)).to.be.equal(ZERO);
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
      expect(await getNodeAmount(sTree, 5)).to.be.equal(ZERO);
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
      expect(await getNodeAmount(sTree, 2)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 3)).to.be.equal(TOKENS_20);
      expect(await getNodeAmount(sTree, 4)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 5)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 6)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 7)).to.be.equal(TOKENS_20);
    });
  });
  describe("Example tree (4 leaves) fair distribution removing from range with 0", async () => {
    beforeEach(async () => {
      sTree = await prepareTree(ethers, EXAMPLE_TREE_LEAFS);
    });
    it("add liquidity 60$ for all leaves on tree, withdraw #5, removeLimit(50, 6)", async () => {
      for (const i of Array(4).keys()) await sTree.nodeAddLiquidity(TOKENS_60);
      await sTree.nodeWithdraw(5);
      /*
      +--------------------------------------------+
      |                    1 (180$)                |
      +------------------------+-------------------+
      |         2 (60$)        |     3 (120$)      |
      +-------------+----------+---------+---------+
      |   4 (60$)   |  5 (0$)  | 6 (60$) | 7 (60$) |
      +-------------+----------+---------+---------+
      */
      await checkNodeAmountTo(sTree, 1, tokens(180));
      await checkNodeAmountTo(sTree, 2, TOKENS_60);
      await checkNodeAmountTo(sTree, 3, tokens(120));
      await checkNodeAmountTo(sTree, 4, TOKENS_60);
      await checkNodeAmountTo(sTree, 5, ZERO);
      await checkNodeAmountTo(sTree, 6, TOKENS_60);
      await checkNodeAmountTo(sTree, 7, TOKENS_60);

      await sTree.nodeWithdraw(6);
      await sTree.removeLimit(TOKENS_50, 6);
      /*
      +--------------------------------------------+
      |                    1 (70$)                 |
      +------------------------+-------------------+
      |         2 (10$)        |      3 (60$)      |
      +-------------+----------+---------+---------+
      |   4 (60$)   |  5 (0$)  |  6 (0$) | 7 (60$) |
      +-------------+----------+---------+---------+
      */
      await checkNodeAmountTo(sTree, 1, tokens(70));
      await checkNodeAmountTo(sTree, 2, TOKENS_10);
      await checkNodeAmountTo(sTree, 3, TOKENS_60);
      await checkNodeAmountTo(sTree, 4, TOKENS_60);
      await checkNodeAmountTo(sTree, 5, ZERO);
      await checkNodeAmountTo(sTree, 6, ZERO);
      await checkNodeAmountTo(sTree, 7, TOKENS_60);
    });
    it("add liquidity 60$ for all leaves on tree, withdraw #5, addLimit(50, 6)", async () => {
      for (const i of Array(4).keys()) await sTree.nodeAddLiquidity(TOKENS_60);
      await sTree.nodeWithdraw(5);
      /*
      +--------------------------------------------+
      |                    1 (180$)                |
      +------------------------+-------------------+
      |         2 (60$)        |     3 (120$)      |
      +-------------+----------+---------+---------+
      |   4 (60$)   |  5 (0$)  | 6 (60$) | 7 (60$) |
      +-------------+----------+---------+---------+
      */
      await checkNodeAmountTo(sTree, 1, tokens(180));
      await checkNodeAmountTo(sTree, 2, TOKENS_60);
      await checkNodeAmountTo(sTree, 3, tokens(120));
      await checkNodeAmountTo(sTree, 4, TOKENS_60);
      await checkNodeAmountTo(sTree, 5, ZERO);
      await checkNodeAmountTo(sTree, 6, TOKENS_60);
      await checkNodeAmountTo(sTree, 7, TOKENS_60);

      await sTree.nodeWithdraw(6);
      await sTree.addLimit(TOKENS_50, 6);
      /*
      +--------------------------------------------+
      |                    1 (170$)                |
      +------------------------+-------------------+
      |         2 (110$)       |      3 (60$)      |
      +-------------+----------+---------+---------+
      |   4 (60$)   |  5 (0$)  |  6 (0$) | 7 (60$) |
      +-------------+----------+---------+---------+
      */
      await checkNodeAmountTo(sTree, 1, tokens(170));
      await checkNodeAmountTo(sTree, 2, tokens(110));
      await checkNodeAmountTo(sTree, 3, TOKENS_60);
      await checkNodeAmountTo(sTree, 4, TOKENS_60);
      await checkNodeAmountTo(sTree, 5, ZERO);
      await checkNodeAmountTo(sTree, 6, ZERO);
      await checkNodeAmountTo(sTree, 7, TOKENS_60);
    });
    it("add liquidity 60$ for all leaves on tree, withdraw #4, #5, addLimit(50, 6)", async () => {
      for (const i of Array(4).keys()) await sTree.nodeAddLiquidity(TOKENS_60);
      await sTree.nodeWithdraw(4);
      await sTree.nodeWithdraw(5);
      /*
      +--------------------------------------------+
      |                    1 (120$)                |
      +------------------------+-------------------+
      |          2 (0$)        |     3 (120$)      |
      +-------------+----------+---------+---------+
      |    4 (0$)   |  5 (0$)  | 6 (60$) | 7 (60$) |
      +-------------+----------+---------+---------+
      */
      await checkNodeAmountTo(sTree, 1, tokens(120));
      await checkNodeAmountTo(sTree, 2, ZERO);
      await checkNodeAmountTo(sTree, 3, tokens(120));
      await checkNodeAmountTo(sTree, 4, ZERO);
      await checkNodeAmountTo(sTree, 5, ZERO);
      await checkNodeAmountTo(sTree, 6, TOKENS_60);
      await checkNodeAmountTo(sTree, 7, TOKENS_60);

      await sTree.addLimit(TOKENS_50, 6);
      /*
      +--------------------------------------------+
      |                    1 (170$)                |
      +------------------------+-------------------+
      |           2 (0$)       |      3 (170$)     |
      +-------------+----------+---------+---------+
      |    4 (0$)   |  5 (0$)  | 6 (110$)| 7 (60$) |
      +-------------+----------+---------+---------+
      */
      await checkNodeAmountTo(sTree, 1, tokens(170));
      await checkNodeAmountTo(sTree, 2, ZERO);
      await checkNodeAmountTo(sTree, 3, tokens(170));
      await checkNodeAmountTo(sTree, 4, ZERO);
      await checkNodeAmountTo(sTree, 5, ZERO);
      await checkNodeAmountTo(sTree, 6, tokens(110));
      await checkNodeAmountTo(sTree, 7, TOKENS_60);
    });
  });
  describe("Example tree (4 leaves) fair distribution Alice, Bob, Clarc", async () => {
    beforeEach(async () => {
      sTree = await prepareTree(ethers, EXAMPLE_TREE_LEAFS);
    });
    it("There are 10000$ of liquidity, Bob added 1000$, remove 2000$ lose of leaves 4, 5, Clarc not affected", async () => {
      // Alice and Bob added
      await sTree.nodeAddLiquidity(tokens(5000));
      await sTree.nodeAddLiquidity(tokens(5000));
      /*+---------------------------------------------+
        |                  1 (10000$)                 |
        +-------------------------+-------------------+
        |        2 (10000$)       |      3 (0$)       |
        +-------------+-----------+---------+---------+
        |  4 (5000$)  | 5 (5000$) |  6 (0$) |  7 (0$) |
        +-------------+-----------+---------+---------+
              ^              ^
        Alice |          Bob |                          */

      // Clarc added
      await sTree.nodeAddLiquidity(tokens(1000));
      /*+------------------------------------------------+
        |                  1 (11000$)                    |
        +-------------------------+----------------------+
        |        2 (10000$)       |      3 (1000$)       |
        +-------------+-----------+------------+---------+
        |  4 (5000$)  | 5 (5000$) |  6 (1000$) |  7 (0$) |
        +-------------+-----------+------------+---------+
                                        ^
                                  Clarc |                 */

      // remove 2000$, afects only leaves 4, 5
      await sTree.removeLimit(tokens(2000), 5);

      /*+------------------------------------------------+
        |                   1 (9000$)                    |
        +-------------------------+----------------------+
        |         2 (8000$)       |      3 (1000$)       |
        +-------------+-----------+------------+---------+
        |  4 (5000$)  | 5 (4000$) |  6 (1000$) |  7 (0$) |
        +-------------+-----------+------------+---------+*/
      checkNodeAmountTo(sTree, 1, tokens(9000));
      checkNodeAmountTo(sTree, 2, tokens(8000));
      checkNodeAmountTo(sTree, 3, tokens(1000));
      checkNodeAmountTo(sTree, 4, tokens(5000)); // not affected because of lazy update
      checkNodeAmountTo(sTree, 5, tokens(5000)); // not affected because of lazy update
      checkNodeAmountTo(sTree, 6, tokens(1000));
      checkNodeAmountTo(sTree, 7, tokens(0));

      expect(await sTree.nodeWithdrawView(4)).to.be.equal(tokens(4000));
      expect(await sTree.nodeWithdrawView(5)).to.be.equal(tokens(4000));
      expect(await sTree.nodeWithdrawView(6)).to.be.equal(tokens(1000));

      expect(await getWithdrawnAmount(await sTree.nodeWithdraw(4))).to.be.equal(tokens(4000));
      expect(await getWithdrawnAmount(await sTree.nodeWithdraw(5))).to.be.equal(tokens(4000));
      expect(await getWithdrawnAmount(await sTree.nodeWithdraw(6))).to.be.equal(tokens(1000));
    });
    it("There are 15000$ of liquidity, Bob added 1000$, remove 3000$ lose of leaves 4, 5, 6. Clarc affected", async () => {
      // Alice, Bob and Clarc added
      await sTree.nodeAddLiquidity(tokens(5000));
      await sTree.nodeAddLiquidity(tokens(5000));
      await sTree.nodeAddLiquidity(tokens(5000));
      /*+------------------------------------------------+
        |                  1 (15000$)                    |
        +-------------------------+----------------------+
        |        2 (10000$)       |      3 (5000$)       |
        +-------------+-----------+------------+---------+
        |  4 (5000$)  | 5 (5000$) |  6 (5000$) |  7 (0$) |
        +-------------+-----------+------------+---------+
              ^             ^            ^
        Alice |         Bob |      Clarc |                */

      // condition resolves with 3000$ lose of LP (afects only leaves 4, 5, 6)
      await sTree.removeLimit(tokens(3000), 6);

      /*+------------------------------------------------+
        |                  1 (12000$)                    |
        +-------------------------+----------------------+
        |        2 (10000$)       |      3 (4000$)       |
        +-------------+-----------+------------+---------+
        |  4 (5000$)  | 5 (5000$) |  6 (4000$) |  7 (0$) |
        +-------------+-----------+------------+---------+*/
      checkNodeAmountTo(sTree, 1, tokens(12000));
      checkNodeAmountTo(sTree, 2, tokens(10000));
      checkNodeAmountTo(sTree, 3, tokens(4000));
      checkNodeAmountTo(sTree, 4, tokens(5000)); // not affected because of lazy update
      checkNodeAmountTo(sTree, 5, tokens(5000)); // not affected because of lazy update
      checkNodeAmountTo(sTree, 6, tokens(4000));
      checkNodeAmountTo(sTree, 7, tokens(0));

      expect(await sTree.nodeWithdrawView(4)).to.be.equal(tokens(4000));
      expect(await sTree.nodeWithdrawView(5)).to.be.equal(tokens(4000));
      expect(await sTree.nodeWithdrawView(6)).to.be.equal(tokens(4000));

      expect(await getWithdrawnAmount(await sTree.nodeWithdraw(4))).to.be.equal(tokens(4000));
      expect(await getWithdrawnAmount(await sTree.nodeWithdraw(5))).to.be.equal(tokens(4000));
      expect(await getWithdrawnAmount(await sTree.nodeWithdraw(6))).to.be.equal(tokens(4000));
    });
    it("Try add 0 liquidity", async () => {
      await expect(sTree.nodeAddLiquidity(0)).to.be.revertedWith("IncorrectAmount");
    });
    it("Try add liquidity to already filled leaves range", async () => {
      // fill up keaves range
      for (const i of Array(4).keys()) await sTree.nodeAddLiquidity(tokens(1));
      await expect(sTree.nodeAddLiquidity(tokens(1))).to.be.revertedWith("LeafNumberRangeExceeded");
    });
    it("Try remove more liquidity than exists", async () => {
      await sTree.nodeAddLiquidity(TOKENS_10);
      await expect(sTree.removeLimit(TOKENS_100, 4)).to.be.revertedWith("InsufficientTopNodeAmount");
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
    beforeEach(async () => {
      sTree = await prepareTree(ethers, MIDDLE_TREE_LEAFS);
    });
    it("add liquidity 45$, remove 45$, try withdraw it", async () => {
      // Add three leaves so the one we will be using is the last of the left "main branch"
      await sTree.nodeAddLiquidity(1);
      await sTree.nodeWithdraw(8);
      await sTree.nodeAddLiquidity(1);
      await sTree.nodeWithdraw(9);
      await sTree.nodeAddLiquidity(1);
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

      expect(await getNodeAmount(sTree, 1)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 2)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 5)).to.be.equal(TOKENS_45);
      expect(await getNodeAmount(sTree, 11)).to.be.equal(TOKENS_45);

      // Add another node so 'tree.updateId' propagates back to the root when we do a push
      await sTree.nodeAddLiquidity(1);
      await sTree.nodeWithdraw(12);

      // Deposited 45 but removed from top and nothing to withdraw. This is 0 as we expect.
      expect(await sTree.nodeWithdrawView(11)).to.be.equal(ZERO);
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
      expect(await getNodeAmount(sTree, 1)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 2)).to.be.equal(ZERO);
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
      expect(await getNodeAmount(sTree, 1)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 2)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 5)).to.be.equal(ZERO);
      expect(await getNodeAmount(sTree, 11)).to.be.equal(ZERO);
    });
    it("add liquidity add/withdraw, removeLimit and remove", async () => {
      await sTree.nodeAddLiquidity(3); // leaf #8

      await sTree.nodeAddLiquidity(1); // leaf #9
      await sTree.nodeWithdraw(9);

      await sTree.nodeAddLiquidity(1); // leaf #10
      await sTree.nodeWithdraw(10);
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (3$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (3$)                |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (3$)       |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (3$)   |  9 (0$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/

      //for (const i of Array(2).keys()) await checkNodeAmountTo(sTree, i + 1, 3);
      await checkNodeAmountTo(sTree, 1, 3);
      await checkNodeAmountTo(sTree, 2, 3);
      await checkNodeAmountTo(sTree, 3, 0);
      await checkNodeAmountTo(sTree, 4, 3);
      for (const i of Array(3).keys()) await checkNodeAmountTo(sTree, i + 5, 0);
      await checkNodeAmountTo(sTree, 8, 3);
      for (const i of Array(7).keys()) await checkNodeAmountTo(sTree, i + 9, 0);

      // remove from unused leaf #11
      await sTree.removeLimit(1, 11);
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (2$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (2$)                |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (2$)       |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (3$)   |  9 (0$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      for (const i of Array(2).keys()) await checkNodeAmountTo(sTree, i + 1, 2);
      await checkNodeAmountTo(sTree, 3, 0);
      await checkNodeAmountTo(sTree, 4, 2);
      for (const i of Array(3).keys()) await checkNodeAmountTo(sTree, i + 5, 0);
      await checkNodeAmountTo(sTree, 8, 3);
      for (const i of Array(7).keys()) await checkNodeAmountTo(sTree, i + 9, 0);

      expect(await sTree.nodeWithdrawView(8)).to.be.equal(2);
      expect(await sTree.nodeWithdrawView(10)).to.be.equal(0);

      // remove from top node
      await sTree.remove(1);
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (1$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (1$)                |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (1$)       |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (3$)   |  9 (0$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      await checkNodeAmountTo(sTree, 1, 1);
      await checkNodeAmountTo(sTree, 2, 1);
      await checkNodeAmountTo(sTree, 3, 0);
      await checkNodeAmountTo(sTree, 4, 1);
      for (const i of Array(3).keys()) await checkNodeAmountTo(sTree, i + 5, 0);
      await checkNodeAmountTo(sTree, 8, 3);
      for (const i of Array(7).keys()) await checkNodeAmountTo(sTree, i + 9, 0);

      expect(await sTree.nodeWithdrawView(8)).to.be.equal(1);
      expect(await getWithdrawnAmount(await await sTree.nodeWithdraw(8))).to.be.eq(1);

      expect(await sTree.nodeWithdrawView(10)).to.be.equal(0);
      expect(await getWithdrawnAmount(await await sTree.nodeWithdraw(10))).to.be.eq(0);

      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (0$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (0$)                |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (0$)       |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      await checkTreeIsEmpty(sTree);

      await sTree.nodeAddLiquidity(1); // leaf #11
      expect(await sTree.nodeWithdrawView(11)).to.be.equal(1);
      expect(await getWithdrawnAmount(await sTree.nodeWithdraw(11))).to.be.eq(1);
    });
    it("add liquidity add/withdraw all, add whole tree, removeLimit, add/withdraw", async () => {
      await sTree.nodeAddLiquidity(3); // leaf #8
      await sTree.nodeWithdraw(8);

      // add to the top node (whole tree)
      await sTree.add(1);
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (1$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (0$)                |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (0$)       |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      await checkNodeAmountTo(sTree, 1, 1);
      for (const i of Array(15).keys()) await checkNodeAmountTo(sTree, i + 2, 0);

      // remove from unused leaf #9, actually remove from the whole tree
      await sTree.removeLimit(1, 9);
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (0$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (0$)                |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (0$)       |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      for (const i of Array(16).keys()) await checkNodeAmountTo(sTree, i + 1, 0);

      await sTree.nodeAddLiquidity(2); // leaf #9
      expect(await getWithdrawnAmount(await sTree.nodeWithdraw(9))).to.be.eq(2);
      // Empty tree
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (0$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (0$)                |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (0$)       |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      for (const i of Array(16).keys()) await checkNodeAmountTo(sTree, i + 1, 0);
    });
    it("add liquidity add/withdraw all, add whole tree, addLimit, add/withdraw", async () => {
      await sTree.nodeAddLiquidity(1); // leaf #8
      await sTree.nodeWithdraw(8);

      // add to the top node (whole tree)
      await sTree.add(1);
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (1$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (0$)                |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (0$)       |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      await checkNodeAmountTo(sTree, 1, 1);
      for (const i of Array(15).keys()) await checkNodeAmountTo(sTree, i + 2, 0);

      // add to unused leaf #9, actually add from the whole tree
      await sTree.addLimit(1, 9);
      /*+-----------------------------------------------------------------------------------------+
        |                                          2 (2$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (0$)                |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (0$)       |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      await checkNodeAmountTo(sTree, 1, 2);
      for (const i of Array(15).keys()) await checkNodeAmountTo(sTree, i + 2, 0);

      await sTree.nodeAddLiquidity(2); // leaf #9
      expect(await getWithdrawnAmount(await sTree.nodeWithdraw(9))).to.be.eq(4); // take depo 2 + undistributed 2
      // Empty tree
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (0$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (0$)                |                      3 (1$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (0$)       |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      for (const i of Array(16).keys()) await checkNodeAmountTo(sTree, i + 1, 0);
    });
    it("leaf #8 +1 -1, addLimit(1, #8), remove(1), leaf #9 +100, -100", async () => {
      const HUNDRED = 100;
      await sTree.nodeAddLiquidity(1); // leaf #8
      await sTree.nodeWithdraw(8);
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (0$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (0$)                |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (0$)       |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      for (const i of Array(16).keys()) await checkNodeAmountTo(sTree, i + 1, 0);

      // add to #8
      await sTree.addLimit(1, 8);
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (1$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (0$)                |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (0$)       |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      expect(await getNodeAmount(sTree, 1)).to.be.equal(1);
      for (const i of Array(15).keys()) await checkNodeAmountTo(sTree, i + 2, 0);

      await sTree.remove(1);
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (0$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (0$)                |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (0$)       |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      for (const i of Array(16).keys()) await checkNodeAmountTo(sTree, i + 1, 0);
      await sTree.nodeAddLiquidity(HUNDRED); // leaf #9
      expect(await sTree.nodeWithdrawView(9)).to.be.eq(HUNDRED);
      expect(await getWithdrawnAmount(await sTree.nodeWithdraw(9))).to.be.eq(HUNDRED);
      for (const i of Array(16).keys()) await checkNodeAmountTo(sTree, i + 1, 0);
    });
    it("leaf #8 +2, removeLimit(2, #8-#9), leaf #9 +100, -100", async () => {
      const HUNDRED = 100;
      await sTree.nodeAddLiquidity(2); // leaf #8
      await sTree.removeLimit(2, 9); // #9 not used
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (0$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (0$)                |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (0$)       |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      for (const i of Array(14).keys()) await checkNodeAmountTo(sTree, i + 1, 0);

      await sTree.nodeAddLiquidity(HUNDRED); // leaf #9
      expect(await sTree.nodeWithdrawView(9)).to.be.eq(HUNDRED);
      await sTree.nodeWithdraw(9);

      for (const i of Array(14).keys()) await checkNodeAmountTo(sTree, i + 1, 0);
    });
    it("leaf #8 +1 -1, #9 +1, removeLimit(1, #8), +100", async () => {
      const HUNDRED = 100;
      await sTree.nodeAddLiquidity(1); // leaf #8
      await sTree.nodeWithdraw(8);

      await sTree.nodeAddLiquidity(1); // leaf #9
      await sTree.removeLimit(1, 8);
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (0$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (0$)                |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (0$)       |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (1$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/

      await sTree.add(HUNDRED);
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (100$)                                       |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (0$)                |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (0$)       |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (1$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/

      await sTree.nodeAddLiquidity(1); // leaf #10
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (101$)                                       |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (1$)                |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (0$)       |        5 (1$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (1$)  | 10 (1$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      expect(await checkNodeAmountTo(sTree, 1, HUNDRED + 1));
      expect(await checkNodeAmountTo(sTree, 2, 1));
      expect(await checkNodeAmountTo(sTree, 3, ZERO));
      expect(await checkNodeAmountTo(sTree, 4, ZERO));
      expect(await checkNodeAmountTo(sTree, 5, 1));
      expect(await checkNodeAmountTo(sTree, 8, ZERO));
      expect(await checkNodeAmountTo(sTree, 9, 1)); // not zeroed because of lazy (withdrawview is 0)
      expect(await checkNodeAmountTo(sTree, 10, 1));

      expect(await sTree.nodeWithdrawView(9)).to.be.eq(ZERO);
      expect(await sTree.nodeWithdrawView(10)).to.be.eq(HUNDRED + 1);
    });
    it("leaves (#8 - #12) -> {+1 -1}, removeLimit(1, #8), +100", async () => {
      const HUNDRED = 100;

      for (const i of Array(5).keys()) {
        await sTree.nodeAddLiquidity(1);
        await sTree.nodeWithdraw(i + 8);
      }
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (0$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (0$)                |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (0$)       |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      for (const i of Array(15).keys()) await checkNodeAmountTo(sTree, i, ZERO);

      await sTree.addLimit(1, 8); // addlimit 1 to #8
      /*+-----------------------------------------------------------------------------------------+
        |                                           1 (1$)                                        |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (0$)                |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (0$)       |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      expect(await checkNodeAmountTo(sTree, 1, 1));
      for (const i of Array(13).keys()) await checkNodeAmountTo(sTree, i + 2, ZERO);

      await sTree.add(HUNDRED);
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (101$)                                       |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (0$)                |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (0$)       |        5 (1$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      expect(await checkNodeAmountTo(sTree, 1, HUNDRED + 1));
      for (const i of Array(13).keys()) await checkNodeAmountTo(sTree, i + 2, ZERO);
    });
    it("add(1), #8 +1 -1, (#9-#12) -> {+1}, #12 -1, (#13-#14) +1, (#13-#14) -1, #15 +3, removeLimit(2, #14) all withdrawview", async () => {
      await sTree.add(1);

      await sTree.nodeAddLiquidity(1); // #8
      let tx8 = await sTree.nodeWithdraw(8); // 2
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (0$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (0$)                |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (0$)       |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      expect(await getWithdrawnAmount(tx8)).to.be.eq(2);
      await checkTreeIsEmpty(sTree);

      for (const i of Array(4).keys()) await sTree.nodeAddLiquidity(1); // #9-#12
      await sTree.nodeWithdraw(12);
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (3$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (3$)                |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (1$)       |        5 (2$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (1$)  | 10 (1$) | 11 (1$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      expect(await checkNodeAmountTo(sTree, 1, 3));
      expect(await checkNodeAmountTo(sTree, 2, 3));
      expect(await checkNodeAmountTo(sTree, 3, ZERO));
      expect(await checkNodeAmountTo(sTree, 4, 1));
      expect(await checkNodeAmountTo(sTree, 5, 2));
      for (const i of Array(3).keys()) expect(await checkNodeAmountTo(sTree, 9 + i, 1));

      for (const i of Array(2).keys()) await sTree.nodeAddLiquidity(1); // #13-#14
      for (const i of Array(2).keys()) await sTree.nodeWithdraw(13 + i); // #13-#14

      expect(await checkNodeAmountTo(sTree, 1, 3));
      expect(await checkNodeAmountTo(sTree, 2, 3));
      expect(await checkNodeAmountTo(sTree, 3, ZERO));
      expect(await checkNodeAmountTo(sTree, 4, 1));
      expect(await checkNodeAmountTo(sTree, 5, 2));
      for (const i of Array(3).keys()) expect(await checkNodeAmountTo(sTree, 9 + i, 1));

      await sTree.nodeAddLiquidity(3); // #15
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (6$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (3$)                |                      3 (3$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (1$)       |        5 (2$)     |           6 (0$)       |       7 (3$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (1$)  | 10 (1$) | 11 (1$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (3$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      expect(await checkNodeAmountTo(sTree, 1, 6));
      expect(await checkNodeAmountTo(sTree, 2, 3));
      expect(await checkNodeAmountTo(sTree, 3, 3));
      expect(await checkNodeAmountTo(sTree, 4, 1));
      expect(await checkNodeAmountTo(sTree, 5, 2));
      expect(await checkNodeAmountTo(sTree, 6, ZERO));
      expect(await checkNodeAmountTo(sTree, 7, 3));
      for (const i of Array(3).keys()) expect(await checkNodeAmountTo(sTree, 9 + i, 1));
      for (const i of Array(3).keys()) expect(await checkNodeAmountTo(sTree, 12 + i, ZERO));
      expect(await sTree.nodeWithdrawView(9)).to.be.eq(1);
      expect(await sTree.nodeWithdrawView(10)).to.be.eq(1);
      expect(await sTree.nodeWithdrawView(11)).to.be.eq(1);
      expect(await sTree.nodeWithdrawView(15)).to.be.eq(3);

      await sTree.removeLimit(2, 14); // removelimit 2 from #14 becomes remove() from whole tree
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (4$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (1$)                |                      3 (3$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (1$)       |        5 (2$)     |           6 (0$)       |       7 (3$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (1$)  | 10 (1$) | 11 (1$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (3$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      expect(await checkNodeAmountTo(sTree, 1, 4));
      expect(await checkNodeAmountTo(sTree, 2, 1));
      expect(await checkNodeAmountTo(sTree, 3, 3));
      expect(await checkNodeAmountTo(sTree, 4, 1));
      expect(await checkNodeAmountTo(sTree, 5, 2));
      expect(await checkNodeAmountTo(sTree, 6, ZERO));
      expect(await checkNodeAmountTo(sTree, 7, 3));
      for (const i of Array(3).keys()) expect(await checkNodeAmountTo(sTree, 9 + i, 1));
      for (const i of Array(3).keys()) expect(await checkNodeAmountTo(sTree, 12 + i, ZERO));

      expect(await sTree.nodeWithdrawView(9)).to.be.eq(0);
      expect(await sTree.nodeWithdrawView(10)).to.be.eq(0);
      expect(await sTree.nodeWithdrawView(11)).to.be.eq(1);
      expect(await sTree.nodeWithdrawView(15)).to.be.eq(3);
    });
    it("add(1), #8 +1 -1, (#9-#12) -> {+1}, #12 -1, (#13-#14) +1, (#13-#14) -1, #15 +3, removeLimit(2, #13), all withdrawview", async () => {
      await sTree.add(1);

      await sTree.nodeAddLiquidity(1); // #8
      let tx8 = await sTree.nodeWithdraw(8); // 2
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (0$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (0$)                |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (0$)       |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      expect(await getWithdrawnAmount(tx8)).to.be.eq(2);
      await checkTreeIsEmpty(sTree);

      for (const i of Array(4).keys()) await sTree.nodeAddLiquidity(1); // #9-#12
      await sTree.nodeWithdraw(12);
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (3$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (3$)                |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (1$)       |        5 (2$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (1$)  | 10 (1$) | 11 (1$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      expect(await checkNodeAmountTo(sTree, 1, 3));
      expect(await checkNodeAmountTo(sTree, 2, 3));
      expect(await checkNodeAmountTo(sTree, 3, ZERO));
      expect(await checkNodeAmountTo(sTree, 4, 1));
      expect(await checkNodeAmountTo(sTree, 5, 2));
      for (const i of Array(3).keys()) expect(await checkNodeAmountTo(sTree, 9 + i, 1));

      for (const i of Array(2).keys()) await sTree.nodeAddLiquidity(1); // #13-#14
      for (const i of Array(2).keys()) await sTree.nodeWithdraw(13 + i); // #13-#14

      expect(await checkNodeAmountTo(sTree, 1, 3));
      expect(await checkNodeAmountTo(sTree, 2, 3));
      expect(await checkNodeAmountTo(sTree, 3, ZERO));
      expect(await checkNodeAmountTo(sTree, 4, 1));
      expect(await checkNodeAmountTo(sTree, 5, 2));
      for (const i of Array(3).keys()) expect(await checkNodeAmountTo(sTree, 9 + i, 1));

      await sTree.nodeAddLiquidity(3); // #15
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (6$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (3$)                |                      3 (3$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (1$)       |        5 (2$)     |           6 (0$)       |       7 (3$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (1$)  | 10 (1$) | 11 (1$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (3$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      expect(await checkNodeAmountTo(sTree, 1, 6));
      expect(await checkNodeAmountTo(sTree, 2, 3));
      expect(await checkNodeAmountTo(sTree, 3, 3));
      expect(await checkNodeAmountTo(sTree, 4, 1));
      expect(await checkNodeAmountTo(sTree, 5, 2));
      expect(await checkNodeAmountTo(sTree, 6, ZERO));
      expect(await checkNodeAmountTo(sTree, 7, 3));
      for (const i of Array(3).keys()) expect(await checkNodeAmountTo(sTree, 9 + i, 1));
      for (const i of Array(3).keys()) expect(await checkNodeAmountTo(sTree, 12 + i, ZERO));
      expect(await sTree.nodeWithdrawView(9)).to.be.eq(1);
      expect(await sTree.nodeWithdrawView(10)).to.be.eq(1);
      expect(await sTree.nodeWithdrawView(11)).to.be.eq(1);
      expect(await sTree.nodeWithdrawView(15)).to.be.eq(3);

      await sTree.removeLimit(2, 13); // removelimit 2 from #13 becomes remove() from whole tree
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (4$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (1$)                |                      3 (3$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (1$)       |        5 (2$)     |           6 (0$)       |       7 (3$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (1$)  | 10 (1$) | 11 (1$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (3$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      expect(await checkNodeAmountTo(sTree, 1, 4));
      expect(await checkNodeAmountTo(sTree, 2, 1));
      expect(await checkNodeAmountTo(sTree, 3, 3));
      expect(await checkNodeAmountTo(sTree, 4, 1));
      expect(await checkNodeAmountTo(sTree, 5, 2));
      expect(await checkNodeAmountTo(sTree, 6, ZERO));
      expect(await checkNodeAmountTo(sTree, 7, 3));
      for (const i of Array(3).keys()) expect(await checkNodeAmountTo(sTree, 9 + i, 1));
      for (const i of Array(3).keys()) expect(await checkNodeAmountTo(sTree, 12 + i, ZERO));

      expect(await sTree.nodeWithdrawView(9)).to.be.eq(0);
      expect(await sTree.nodeWithdrawView(10)).to.be.eq(0);
      expect(await sTree.nodeWithdrawView(11)).to.be.eq(1);
      expect(await sTree.nodeWithdrawView(15)).to.be.eq(3);
    });
    it("add(1), #8 +1 -1, (#9-#12) -> {+1}, #12 -1, (#13-#14) +1, (#13-#14) -1, #15 +3, removeLimit(2, #12), all withdrawview", async () => {
      await sTree.add(1);

      await sTree.nodeAddLiquidity(1); // #8
      let tx8 = await sTree.nodeWithdraw(8); // 2
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (0$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (0$)                |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (0$)       |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      expect(await getWithdrawnAmount(tx8)).to.be.eq(2);
      await checkTreeIsEmpty(sTree);

      for (const i of Array(4).keys()) await sTree.nodeAddLiquidity(1); // #9-#12
      await sTree.nodeWithdraw(12);
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (3$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (3$)                |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (1$)       |        5 (2$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (1$)  | 10 (1$) | 11 (1$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      expect(await checkNodeAmountTo(sTree, 1, 3));
      expect(await checkNodeAmountTo(sTree, 2, 3));
      expect(await checkNodeAmountTo(sTree, 3, ZERO));
      expect(await checkNodeAmountTo(sTree, 4, 1));
      expect(await checkNodeAmountTo(sTree, 5, 2));
      for (const i of Array(3).keys()) expect(await checkNodeAmountTo(sTree, 9 + i, 1));

      for (const i of Array(2).keys()) await sTree.nodeAddLiquidity(1); // #13-#14
      for (const i of Array(2).keys()) await sTree.nodeWithdraw(13 + i); // #13-#14

      expect(await checkNodeAmountTo(sTree, 1, 3));
      expect(await checkNodeAmountTo(sTree, 2, 3));
      expect(await checkNodeAmountTo(sTree, 3, ZERO));
      expect(await checkNodeAmountTo(sTree, 4, 1));
      expect(await checkNodeAmountTo(sTree, 5, 2));
      for (const i of Array(3).keys()) expect(await checkNodeAmountTo(sTree, 9 + i, 1));

      await sTree.nodeAddLiquidity(3); // #15
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (6$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (3$)                |                      3 (3$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (1$)       |        5 (2$)     |           6 (0$)       |       7 (3$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (1$)  | 10 (1$) | 11 (1$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (3$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      expect(await checkNodeAmountTo(sTree, 1, 6));
      expect(await checkNodeAmountTo(sTree, 2, 3));
      expect(await checkNodeAmountTo(sTree, 3, 3));
      expect(await checkNodeAmountTo(sTree, 4, 1));
      expect(await checkNodeAmountTo(sTree, 5, 2));
      expect(await checkNodeAmountTo(sTree, 6, ZERO));
      expect(await checkNodeAmountTo(sTree, 7, 3));
      for (const i of Array(3).keys()) expect(await checkNodeAmountTo(sTree, 9 + i, 1));
      for (const i of Array(3).keys()) expect(await checkNodeAmountTo(sTree, 12 + i, ZERO));
      expect(await sTree.nodeWithdrawView(9)).to.be.eq(1);
      expect(await sTree.nodeWithdrawView(10)).to.be.eq(1);
      expect(await sTree.nodeWithdrawView(11)).to.be.eq(1);
      expect(await sTree.nodeWithdrawView(15)).to.be.eq(3);

      await sTree.removeLimit(2, 12); // removelimit 2 from #12 becomes remove() from whole tree
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (4$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (1$)                |                      3 (3$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (1$)       |        5 (2$)     |           6 (0$)       |       7 (3$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (1$)  | 10 (1$) | 11 (1$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (3$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      expect(await checkNodeAmountTo(sTree, 1, 4));
      expect(await checkNodeAmountTo(sTree, 2, 1));
      expect(await checkNodeAmountTo(sTree, 3, 3));
      expect(await checkNodeAmountTo(sTree, 4, 1));
      expect(await checkNodeAmountTo(sTree, 5, 2));
      expect(await checkNodeAmountTo(sTree, 6, ZERO));
      expect(await checkNodeAmountTo(sTree, 7, 3));
      for (const i of Array(3).keys()) expect(await checkNodeAmountTo(sTree, 9 + i, 1));
      for (const i of Array(3).keys()) expect(await checkNodeAmountTo(sTree, 12 + i, ZERO));

      expect(await sTree.nodeWithdrawView(9)).to.be.eq(0);
      expect(await sTree.nodeWithdrawView(10)).to.be.eq(0);
      expect(await sTree.nodeWithdrawView(11)).to.be.eq(1);
      expect(await sTree.nodeWithdrawView(15)).to.be.eq(3);
    });
    it("leaf #8 +1, #9 +1 -1, #10 +1, #11 +1, #8 -1, addLimit(10, #10), #10 -11, #11 -1", async () => {
      await sTree.nodeAddLiquidity(1); // #8
      await sTree.nodeAddLiquidity(1); // #9
      await sTree.nodeWithdraw(9);

      await sTree.nodeAddLiquidity(1); // #10
      await sTree.nodeAddLiquidity(1); // #11
      await sTree.nodeWithdraw(8);
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (2$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (2$)                |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (0$)       |        5 (2$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (1$) | 11 (1$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      expect(await sTree.nodeWithdrawView(10)).to.be.eq(1);
      expect(await sTree.nodeWithdrawView(11)).to.be.eq(1);

      await sTree.addLimit(10, 10);
      /*+-----------------------------------------------------------------------------------------+
        |                                         1 (12$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                     2 (12$)                |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (0$)       |       5 (12$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (11$)| 11 (1$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      expect(await sTree.nodeWithdrawView(10)).to.be.eq(11);
      expect(await sTree.nodeWithdrawView(11)).to.be.eq(1);
    });
    it("leaf #8 +1, #9 +1 -1, #10 +11, #11 +11, #8 -1, removeLimit(10, #10), #10 -1, #11 -11", async () => {
      await sTree.nodeAddLiquidity(1); // #8
      await sTree.nodeAddLiquidity(1); // #9
      await sTree.nodeWithdraw(9);

      await sTree.nodeAddLiquidity(11); // #10
      await sTree.nodeAddLiquidity(11); // #11
      await sTree.nodeWithdraw(8);
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (22$)                                        |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (22$)               |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (0$)       |        5 (22$)    |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (11$)| 11 (11$)|    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      await checkNodeAmountTo(sTree, 1, 22);
      await checkNodeAmountTo(sTree, 2, 22);
      await checkNodeAmountTo(sTree, 4, ZERO);
      await checkNodeAmountTo(sTree, 5, 22);
      expect(await sTree.nodeWithdrawView(10)).to.be.eq(11);
      expect(await sTree.nodeWithdrawView(11)).to.be.eq(11);

      await sTree.removeLimit(10, 10);
      /*+-----------------------------------------------------------------------------------------+
        |                                         1 (12$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                     2 (12$)                |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (0$)       |       5 (12$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (1$) | 11 (11$)|    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      await checkNodeAmountTo(sTree, 1, 12);
      await checkNodeAmountTo(sTree, 2, 12);
      await checkNodeAmountTo(sTree, 4, ZERO);
      await checkNodeAmountTo(sTree, 5, 12);
      expect(await sTree.nodeWithdrawView(10)).to.be.eq(1);
      expect(await sTree.nodeWithdrawView(11)).to.be.eq(11);
    });
    it("leaf #8 +1, #9 +2e18, removeLimit(1e18, #8), #8 0, #9 -(1e18+1)", async () => {
      await sTree.nodeAddLiquidity(1); // #8
      await sTree.nodeAddLiquidity(tokens(2)); // #9
      const tokens2and1 = BigNumber.from(tokens(2)).add(1);
      const tokens1and1 = BigNumber.from(tokens(1)).add(1);
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (2e18 + 1$)                                  |
        +--------------------------------------------+--------------------------------------------+
        |                    2 (2e18 + 1$)           |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |        4 (2e18 + 1$)   |        5 (22$)    |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (1$)   | 9 (2e18$)| 10 (11$)| 11 (11$)|    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      await checkNodeAmountTo(sTree, 1, tokens2and1);
      await checkNodeAmountTo(sTree, 2, tokens2and1);
      await checkNodeAmountTo(sTree, 4, tokens2and1);
      await checkNodeAmountTo(sTree, 8, 1);
      await checkNodeAmountTo(sTree, 9, tokens(2));

      await sTree.removeLimit(tokens(1), 8);
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (1e18 + 1$)                                  |
        +--------------------------------------------+--------------------------------------------+
        |                    2 (1e18 + 1$)           |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |        4 (1e18 + 1$)   |        5 (22$)    |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (1$)   | 9 (2e18$)| 10 (11$)| 11 (11$)|    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      await checkNodeAmountTo(sTree, 1, tokens1and1);
      await checkNodeAmountTo(sTree, 2, tokens1and1);
      await checkNodeAmountTo(sTree, 4, tokens1and1);
      await checkNodeAmountTo(sTree, 8, 1);
      await checkNodeAmountTo(sTree, 9, tokens(2));

      expect(await sTree.nodeWithdrawView(8)).to.be.eq(0);
      expect(await sTree.nodeWithdrawView(9)).to.be.eq(tokens1and1);
    });
    it("leaf #8 +2, leaf #9 +2, removeLimit(4, #8-#10), leaf #10 +100, -100", async () => {
      const HUNDRED = 100;
      await sTree.nodeAddLiquidity(2); // leaf #8
      await sTree.nodeAddLiquidity(2); // leaf #9
      await sTree.removeLimit(4, 10); // #9 not used
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (0$)                                         |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (0$)                |                      3 (0$)                |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |           4 (0$)       |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (2$)   |  9 (2$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      for (const i of Array(7).keys()) await checkNodeAmountTo(sTree, i + 1, 0);
      await checkNodeAmountTo(sTree, 8, 2);
      await checkNodeAmountTo(sTree, 9, 2);
      for (const i of Array(5).keys()) await checkNodeAmountTo(sTree, i + 10, 0);

      await sTree.nodeAddLiquidity(HUNDRED); // leaf #10
      expect(await sTree.nodeWithdrawView(10)).to.be.eq(HUNDRED);
      await sTree.nodeWithdraw(10);

      for (const i of Array(7).keys()) await checkNodeAmountTo(sTree, i + 1, 0);
      for (const i of Array(2).keys()) {
        await checkNodeAmountTo(sTree, i + 8, 2);
        expect(await sTree.nodeWithdrawView(i + 8)).to.be.eq(0);
      }
    });
    it("leaf #8 +1 -1, addLimit(32.90^30, #8), leaf #9 +515556.06^30, removeLimit(515588.91^30, #9), leaf #10 +100000^30 -100000^30", async () => {
      const addAmount10 = BigNumber.from("32909642389261143889570747177414"); // 32.90^30
      const depoAmount9 = BigNumber.from("515556062021096007729272146718164462"); // 515556.06^30
      const depoAmount10 = BigNumber.from("100000000000000000000000000000000000"); // 100000^30
      const removeFrom9 = BigNumber.from("515588916704879708584667603097088197"); // 515588.91^30
      await sTree.nodeAddLiquidity(1); // leaf #8
      await sTree.nodeWithdraw(8);

      await sTree.addLimit(addAmount10, 8);
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (32.90^30$)                                  |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (0$)                |                      3 (0$)                |
        +------------------------+---------+---------+------------------------+-------------------+
        |           4 (0$)       |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      await checkNodeAmountTo(sTree, 1, addAmount10);
      for (const i of Array(13).keys()) await checkNodeAmountTo(sTree, i + 2, ZERO);

      await sTree.nodeAddLiquidity(depoAmount9); // leaf #9 515556.06^30
      /*+----------------------------------------------------------------------------------------------------+
        |                                       1 (515588.97^30$)                                            |
        +-------------------------------------------------------+--------------------------------------------+
        |                      2 (515556.06^30$)                |                      3 (0$)                |
        +-----------------------------------+---------+---------+-------------+----------+---------+---------+
        |           4 (515556.06^30$)       |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+---------------------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (515556.06^30$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+---------------------+---------+---------+-------------+----------+---------+---------+*/
      await checkNodeAmountTo(sTree, 1, addAmount10.add(depoAmount9));
      await checkNodeAmountTo(sTree, 2, depoAmount9);
      await checkNodeAmountTo(sTree, 3, ZERO);
      await checkNodeAmountTo(sTree, 4, depoAmount9);
      await checkNodeAmountTo(sTree, 5, ZERO);
      await checkNodeAmountTo(sTree, 9, depoAmount9);
      for (const i of Array(6).keys()) await checkNodeAmountTo(sTree, i + 10, ZERO);

      await sTree.removeLimit(removeFrom9, 9);
      /*+----------------------------------------------------------------------------------------------------+
        |                                               1 (0.05^30$)                                         |
        +-------------------------------------------------------+--------------------------------------------+
        |                        2 (0.05^30$)                   |                      3 (0$)                |
        +-----------------------------------+-------------------+------------------------+-------------------+
        |             4 (0.05^30$)          |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+---------------------+---------+---------+-------------+----------+---------+---------+
        |    8 (2$)   |  9 (515556.06^30$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+---------------------+---------+---------+-------------+----------+---------+---------+*/
      await checkNodeAmountTo(sTree, 1, addAmount10.add(depoAmount9).sub(removeFrom9));
      await checkNodeAmountTo(sTree, 2, addAmount10.add(depoAmount9).sub(removeFrom9));
      await checkNodeAmountTo(sTree, 3, ZERO);
      await checkNodeAmountTo(sTree, 4, addAmount10.add(depoAmount9).sub(removeFrom9));
      await checkNodeAmountTo(sTree, 5, ZERO);
      await checkNodeAmountTo(sTree, 9, depoAmount9.add(addAmount10));
      expect(await sTree.nodeWithdrawView(9)).to.be.eq(addAmount10.add(depoAmount9).sub(removeFrom9));
      for (const i of Array(6).keys()) await checkNodeAmountTo(sTree, i + 10, ZERO);

      await sTree.nodeAddLiquidity(depoAmount10); // leaf #10
      /*+------------------------------------------------------------------------------------------------------------+
        |                                                     1 (100000.05^30$)                                      |
        +---------------------------------------------------------------+--------------------------------------------+
        |                           2 (100000.05^30$)                   |                      3 (0$)                |
        +-----------------------------------+---------------------------+------------------------+-------------------+
        |              4 (0.05^30$)         |       5 (100000^30$)      |           6 (0$)       |       7 (0$)      |
        +-------------+---------------------+-----------------+---------+-------------+----------+---------+---------+
        |    8 (2$)   |  9 (515556.06^30$)  | 10 (100000^30$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+---------------------+-----------------+---------+-------------+----------+---------+---------+*/
      await checkNodeAmountTo(sTree, 1, addAmount10.add(depoAmount9).sub(removeFrom9).add(depoAmount10));
      await checkNodeAmountTo(sTree, 2, addAmount10.add(depoAmount9).sub(removeFrom9).add(depoAmount10));
      await checkNodeAmountTo(sTree, 3, ZERO);
      await checkNodeAmountTo(sTree, 4, addAmount10.add(depoAmount9).sub(removeFrom9));
      await checkNodeAmountTo(sTree, 5, depoAmount10);
      await checkNodeAmountTo(sTree, 9, depoAmount9.add(addAmount10));
      await checkNodeAmountTo(sTree, 10, depoAmount10);
      expect(await sTree.nodeWithdrawView(9)).to.be.eq(addAmount10.add(depoAmount9).sub(removeFrom9));
      for (const i of Array(4).keys()) await checkNodeAmountTo(sTree, i + 11, ZERO);

      const amountWithdrawView = await sTree.nodeWithdrawView(10);
      const amountWithdrawn = await getWithdrawnAmount(await sTree.nodeWithdraw(10));
      /*+----------------------------------------------------------------------------------------------------+
        |                                               1 (0.05^30$)                                         |
        +-------------------------------------------------------+--------------------------------------------+
        |                           2 (0.05^30$)                |                      3 (0$)                |
        +-----------------------------------+-------------------+------------------------+-------------------+
        |           4 (0.05^30$)            |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+---------------------+---------+---------+-------------+----------+---------+---------+
        |    8 (2$)   |  9 (515588.97^30$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+---------------------+---------+---------+-------------+----------+---------+---------+*/
      await checkNodeAmountTo(sTree, 1, addAmount10.add(depoAmount9).sub(removeFrom9));
      await checkNodeAmountTo(sTree, 2, addAmount10.add(depoAmount9).sub(removeFrom9));
      await checkNodeAmountTo(sTree, 3, ZERO);
      await checkNodeAmountTo(sTree, 4, addAmount10.add(depoAmount9).sub(removeFrom9));
      await checkNodeAmountTo(sTree, 5, ZERO);
      await checkNodeAmountTo(sTree, 9, depoAmount9.add(addAmount10));
      await checkNodeAmountTo(sTree, 10, ZERO);
      expect(await sTree.nodeWithdrawView(9)).to.be.eq(addAmount10.add(depoAmount9).sub(removeFrom9));
      for (const i of Array(5).keys()) await checkNodeAmountTo(sTree, i + 10, ZERO);

      expect(amountWithdrawn).to.be.eq(amountWithdrawView);
      expect(amountWithdrawn).to.be.eq(depoAmount10);

      expect(await sTree.nodeWithdrawView(9)).to.be.eq(await getWithdrawnAmount(await sTree.nodeWithdraw(9)));

      await checkTreeIsEmpty(sTree);
    });
    it("leaf #8 +100, #9 +200, remove(30), #10 +300, addLimit(15, #9), #8 -95 #9 -190", async () => {
      await sTree.nodeAddLiquidity(TOKENS_100); // leaf #8
      await sTree.nodeAddLiquidity(TOKENS_200); // leaf #9
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (300$)                                       |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (300$)              |                      3 (0$)                |
        +------------------------+---------+---------+------------------------+-------------------+
        |           4 (300$)     |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (100$) |  9 (200$)| 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      await checkNodeAmountTo(sTree, 1, TOKENS_300);
      await checkNodeAmountTo(sTree, 2, TOKENS_300);
      await checkNodeAmountTo(sTree, 4, TOKENS_300);
      await checkNodeAmountTo(sTree, 8, TOKENS_100);
      await checkNodeAmountTo(sTree, 9, TOKENS_200);
      for (const i of Array(6).keys()) await checkNodeAmountTo(sTree, i + 10, ZERO);

      await sTree.remove(TOKENS_30); // actually executes removeLimit(30, 9)
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (270$)                                       |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (270$)              |                      3 (0$)                |
        +------------------------+---------+---------+------------------------+-------------------+
        |           4 (270$)     |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (100$) |  9 (200$)| 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      await checkNodeAmountTo(sTree, 1, TOKENS_270);
      await checkNodeAmountTo(sTree, 2, TOKENS_270);
      await checkNodeAmountTo(sTree, 4, TOKENS_270);
      await checkNodeAmountTo(sTree, 8, TOKENS_100);
      await checkNodeAmountTo(sTree, 9, TOKENS_200);
      for (const i of Array(6).keys()) await checkNodeAmountTo(sTree, i + 10, ZERO);

      await sTree.nodeAddLiquidity(TOKENS_300); // leaf #10
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (570$)                                       |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (570$)              |                      3 (0$)                |
        +------------------------+---------+---------+------------------------+-------------------+
        |           4 (270$)     |      5 (300$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (100$) |  9 (200$)|10 (300$)| 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      await checkNodeAmountTo(sTree, 1, tokens(570));
      await checkNodeAmountTo(sTree, 2, tokens(570));
      await checkNodeAmountTo(sTree, 4, TOKENS_270);
      await checkNodeAmountTo(sTree, 5, TOKENS_300);
      await checkNodeAmountTo(sTree, 8, TOKENS_100);
      await checkNodeAmountTo(sTree, 9, TOKENS_200);
      await checkNodeAmountTo(sTree, 10, TOKENS_300);
      for (const i of Array(5).keys()) await checkNodeAmountTo(sTree, i + 11, ZERO);

      await sTree.addLimit(tokens(15), 9);
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (585$)                                       |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (585$)              |                      3 (0$)                |
        +------------------------+---------+---------+------------------------+-------------------+
        |           4 (285$)     |      5 (300$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (90$)  |  9 (180$)|10 (300$)| 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      await checkNodeAmountTo(sTree, 1, tokens(585));
      await checkNodeAmountTo(sTree, 2, tokens(585));
      await checkNodeAmountTo(sTree, 4, tokens(285));
      await checkNodeAmountTo(sTree, 5, TOKENS_300);
      await checkNodeAmountTo(sTree, 8, TOKENS_90); // pushed previouse update (remove(30)), and not updated (addLimit(15, #9)) because of lazy
      await checkNodeAmountTo(sTree, 9, tokens(180)); // pushed previouse update (remove(30)), and not updated (addLimit(15, #9)) because of lazy
      await checkNodeAmountTo(sTree, 10, TOKENS_300);
      for (const i of Array(5).keys()) await checkNodeAmountTo(sTree, i + 11, ZERO);

      const withdraw8 = await sTree.nodeWithdrawView(8);
      const withdraw9 = await sTree.nodeWithdrawView(9);
      const tx8 = await sTree.nodeWithdraw(8);
      const tx9 = await sTree.nodeWithdraw(9);
      /*+-----------------------------------------------------------------------------------------+
        |                                          1 (300$)                                       |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (300$)              |                      3 (0$)                |
        +------------------------+---------+---------+------------------------+-------------------+
        |            4 (0$)      |      5 (300$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |     8 (0$)  |   9 (0$) |10 (300$)| 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      expect(await getWithdrawnAmount(tx8)).to.be.eq(withdraw8);
      expect(await getWithdrawnAmount(tx9)).to.be.eq(withdraw9);
      expect(withdraw8).to.be.eq(tokens(95)); // pushed update of (addLimit(15, #9)) 90 + 5
      expect(withdraw9).to.be.eq(tokens(190)); // pushed update of (addLimit(15, #9)) 180 + 10

      await checkNodeAmountTo(sTree, 1, TOKENS_300);
      await checkNodeAmountTo(sTree, 2, TOKENS_300);
      await checkNodeAmountTo(sTree, 4, ZERO);
      await checkNodeAmountTo(sTree, 5, TOKENS_300);
      await checkNodeAmountTo(sTree, 8, ZERO);
      await checkNodeAmountTo(sTree, 9, ZERO);
      await checkNodeAmountTo(sTree, 10, TOKENS_300);
      for (const i of Array(5).keys()) await checkNodeAmountTo(sTree, i + 11, ZERO);
    });
    it("loss distribution for new leaves, leaf #8 +1 -1 #9 +1 -1, addLimit(0.009694838^40, #8), add(0.009694838^40), removeLimit(0.001205549^40, #10 +0.000003125^40, removeLimit(0.013858226^40, 9), #11 +0.00001^40 -0.000007633^40)", async () => {
      const addAmount8 = BigNumber.from("96948376346165723596581337601820494654"); // 0.009694838^40
      const addAmount = BigNumber.from("53658303428241312846456929242569730335"); // 0.009694838^40
      const removeAmount8 = BigNumber.from("12055489045607977961174742188674589737"); // 0.001205549^40
      const depoAmount10 = BigNumber.from("31254422809208851435692772303608874"); // 0.000003125^40
      const removeFrom9 = BigNumber.from("138582264270549204342936304200143962123"); // 0.013858226^40
      const depoAmount11 = BigNumber.from("100000000000000000000000000000000000"); // 0.00001^40
      await sTree.nodeAddLiquidity(1); // leaf #8
      await sTree.nodeWithdraw(8);
      await sTree.nodeAddLiquidity(1); // leaf #9
      await sTree.nodeWithdraw(9);

      await sTree.addLimit(addAmount8, 8);
      /*+-----------------------------------------------------------------------------------------+
        |                                    1 (0.009694838^40$)                                  |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (0$)                |                      3 (0$)                |
        +------------------------+---------+---------+------------------------+-------------------+
        |           4 (0$)       |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      await checkNodeAmountTo(sTree, 1, addAmount8);
      for (const i of Array(13).keys()) await checkNodeAmountTo(sTree, i + 2, ZERO);

      await sTree.add(addAmount);
      /*+-----------------------------------------------------------------------------------------+
        |                                    1 (0.015060668^40$)                                  |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (0$)                |                      3 (0$)                |
        +------------------------+---------+---------+------------------------+-------------------+
        |           4 (0$)       |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      await checkNodeAmountTo(sTree, 1, addAmount8.add(addAmount));
      for (const i of Array(13).keys()) await checkNodeAmountTo(sTree, i + 2, ZERO);

      await sTree.removeLimit(removeAmount8, 8);
      /*+-----------------------------------------------------------------------------------------+
        |                                    1 (0.013855119^40$)                                  |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (0$)                |                      3 (0$)                |
        +------------------------+---------+---------+------------------------+-------------------+
        |           4 (0$)       |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      await checkNodeAmountTo(sTree, 1, addAmount8.add(addAmount).sub(removeAmount8));
      for (const i of Array(13).keys()) await checkNodeAmountTo(sTree, i + 2, ZERO);

      await sTree.nodeAddLiquidity(depoAmount10); // leaf #10
      /*+------------------------------------------------------------------------------------------------------+
        |                                                 1 (0.013858245^40$)                                  |
        +---------------------------------------------------------+--------------------------------------------+
        |                      2 (0.000003125^40$)                |                      3 (0$)                |
        +------------------------+--------------------------------+------------------------+-------------------+
        |           4 (0$)       |       5 (0.000003125^40$)      |           6 (0$)       |       7 (0$)      |
        +-------------+----------+----------------------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (0.000003125^40$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+----------------------+---------+-------------+----------+---------+---------+*/
      await checkNodeAmountTo(sTree, 1, addAmount8.add(addAmount).sub(removeAmount8).add(depoAmount10));
      await checkNodeAmountTo(sTree, 2, depoAmount10);
      await checkNodeAmountTo(sTree, 3, ZERO);
      await checkNodeAmountTo(sTree, 5, depoAmount10);
      await checkNodeAmountTo(sTree, 8, ZERO);
      await checkNodeAmountTo(sTree, 9, ZERO);
      await checkNodeAmountTo(sTree, 10, depoAmount10);
      for (const i of Array(5).keys()) await checkNodeAmountTo(sTree, i + 11, ZERO);

      await sTree.removeLimit(removeFrom9, 9);
      /*+------------------------------------------------------------------------------------------------------+
        |                                                 1 (0.000000018^40$)                                  |
        +---------------------------------------------------------+--------------------------------------------+
        |                      2 (0.000000018^40$)                |                      3 (0$)                |
        +------------------------+--------------------------------+------------------------+-------------------+
        |           4 (0$)       |       5 (0.000000018^40$)      |           6 (0$)       |       7 (0$)      |
        +-------------+----------+----------------------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (0.000003125^40$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+----------------------+---------+-------------+----------+---------+---------+*/
      top1 = addAmount8.add(addAmount).sub(removeAmount8).add(depoAmount10).sub(removeFrom9);
      await checkNodeAmountTo(sTree, 1, top1);
      await checkNodeAmountTo(sTree, 2, top1);
      await checkNodeAmountTo(sTree, 3, ZERO);
      await checkNodeAmountTo(sTree, 5, top1);
      await checkNodeAmountTo(sTree, 8, ZERO);
      await checkNodeAmountTo(sTree, 9, ZERO);
      // leaf #10 not reduced because depoAmount10 << removeFrom9, so here is undistributed loss (expands for new leaf (leaves))
      await checkNodeAmountTo(sTree, 10, depoAmount10);
      for (const i of Array(5).keys()) await checkNodeAmountTo(sTree, i + 11, ZERO);

      await sTree.nodeAddLiquidity(depoAmount11); // leaf #11
      /*+---------------------------------------------------------------------------------------------------------------+
        |                                                     1 (0.000010018^40$)                                       |
        +------------------------------------------------------------------+--------------------------------------------+
        |                            2 (0.000010018^40$)                   |                      3 (0$)                |
        +------------------------+-----------------------------------------+------------------------+-------------------+
        |           4 (0$)       |             5 (0.000010018^40$)         |           6 (0$)       |       7 (0$)      |
        +-------------+----------+----------------------+------------------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (0.000003125^40$) | 11 (0.00001^40$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+----------------------+------------------+-------------+----------+---------+---------+*/
      top1 = addAmount8.add(addAmount).sub(removeAmount8).add(depoAmount10).sub(removeFrom9).add(depoAmount11);
      await checkNodeAmountTo(sTree, 1, top1);
      await checkNodeAmountTo(sTree, 2, top1);
      await checkNodeAmountTo(sTree, 3, ZERO);
      await checkNodeAmountTo(sTree, 5, top1);
      await checkNodeAmountTo(sTree, 8, ZERO);
      await checkNodeAmountTo(sTree, 9, ZERO);
      await checkNodeAmountTo(sTree, 10, depoAmount10);
      await checkNodeAmountTo(sTree, 11, depoAmount11);
      for (const i of Array(5).keys()) await checkNodeAmountTo(sTree, i + 12, ZERO);

      const amountWithdrawn11 = await sTree.nodeWithdrawView(11);
      await sTree.nodeWithdraw(11);
      /*+---------------------------------------------------------------------------------------------------------------+
        |                                                     1 (0.000002386^40$)                                       |
        +------------------------------------------------------------------+--------------------------------------------+
        |                            2 (0.000002386^40$)                   |                      3 (0$)                |
        +------------------------+-----------------------------------------+------------------------+-------------------+
        |           4 (0$)       |             5 (0.000002386^40$)         |           6 (0$)       |       7 (0$)      |
        +-------------+----------+----------------------+------------------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (0.000002386^40$) |    11 (0$)       |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+----------------------+------------------+-------------+----------+---------+---------+*/
      top1 = addAmount8
        .add(addAmount)
        .sub(removeAmount8)
        .add(depoAmount10)
        .sub(removeFrom9)
        .add(depoAmount11)
        .sub(amountWithdrawn11);
      await checkNodeAmountTo(sTree, 1, top1);
      await checkNodeAmountTo(sTree, 2, top1);
      await checkNodeAmountTo(sTree, 5, top1);
      await checkNodeAmountTo(sTree, 10, top1);
      for (const i of Array(5).keys()) await checkNodeAmountTo(sTree, i + 11, ZERO);
      expect(amountWithdrawn11).lt(depoAmount11); // because of loss distribution from parent nodes
    });
    it("add 100 to empty tree", async () => {
      await sTree.add(TOKENS_10000);
      /*+-----------------------------------------------------------------------------------------+
        |                                    1 (10000$)                                           |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (0$)                |                      3 (0$)                |
        +------------------------+---------+---------+------------------------+-------------------+
        |           4 (0$)       |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      await checkNodeAmountTo(sTree, 1, TOKENS_10000);
      for (const i of Array(15).keys()) await checkNodeAmountTo(sTree, i + 2, ZERO);
    });
    it("add 10 to empty tree, #8 +10 #9 +10 #9 -15 #8 -15", async () => {
      await sTree.add(10);
      /*+-----------------------------------------------------------------------------------------+
        |                                        1 (10$)                                          |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (0$)                |                      3 (0$)                |
        +------------------------+---------+---------+------------------------+-------------------+
        |           4 (0$)       |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      await checkNodeAmountTo(sTree, 1, 10);
      for (const i of Array(15).keys()) await checkNodeAmountTo(sTree, i + 2, ZERO);

      await sTree.nodeAddLiquidity(10); // leaf #8
      /*+-----------------------------------------------------------------------------------------+
        |                                        1 (20$)                                          |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (10$)               |                      3 (0$)                |
        +------------------------+---------+---------+------------------------+-------------------+
        |           4 (10$)      |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (10$)  |  9 (0$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      await checkNodeAmountTo(sTree, 1, 20);
      await checkNodeAmountTo(sTree, 2, 10);
      await checkNodeAmountTo(sTree, 4, 10);
      await checkNodeAmountTo(sTree, 8, 10);
      for (const i of Array(7).keys()) await checkNodeAmountTo(sTree, i + 9, ZERO);

      await sTree.nodeAddLiquidity(10); // leaf #9
      /*+-----------------------------------------------------------------------------------------+
        |                                        1 (30$)                                          |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (20$)               |                      3 (0$)                |
        +------------------------+---------+---------+------------------------+-------------------+
        |           4 (20$)      |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (10$)  |  9 (10$) | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      await checkNodeAmountTo(sTree, 1, 30);
      await checkNodeAmountTo(sTree, 2, 20);
      await checkNodeAmountTo(sTree, 4, 20);
      await checkNodeAmountTo(sTree, 8, 10);
      await checkNodeAmountTo(sTree, 9, 10);
      for (const i of Array(6).keys()) await checkNodeAmountTo(sTree, i + 10, ZERO);

      expect(await sTree.nodeWithdrawView(8)).to.be.eq(15);
      expect(await sTree.nodeWithdrawView(9)).to.be.eq(15);
      let tx9 = await sTree.nodeWithdraw(9);
      let tx8 = await sTree.nodeWithdraw(8);
      /*+-----------------------------------------------------------------------------------------+
        |                                        1 (0$)                                           |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (0$)                |                      3 (0$)                |
        +------------------------+---------+---------+------------------------+-------------------+
        |           4 (0$)       |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (1$)   |  9 (0$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      expect(await getWithdrawnAmount(tx8)).to.be.eq(15);
      expect(await getWithdrawnAmount(tx9)).to.be.eq(15);
      await checkTreeIsEmpty(sTree);
    });
    it("add 100 to empty tree after series of depo/withdraw", async () => {
      // depo/withdraw #8-#12
      for (const i of Array(5).keys()) {
        await sTree.nodeAddLiquidity(1);
        await sTree.nodeWithdraw(i + 8);
      }
      await sTree.add(TOKENS_10000);
      /*+-----------------------------------------------------------------------------------------+
        |                                    1 (10000$)                                           |
        +--------------------------------------------+--------------------------------------------+
        |                      2 (0$)                |                      3 (0$)                |
        +------------------------+---------+---------+------------------------+-------------------+
        |           4 (0$)       |        5 (0$)     |           6 (0$)       |       7 (0$)      |
        +-------------+----------+---------+---------+-------------+----------+---------+---------+
        |    8 (0$)   |  9 (0$)  | 10 (0$) | 11 (0$) |    12 (0$)  |  13 (0$) |  14 (0$)|  15 (0$)|
        +-------------+----------+---------+---------+-------------+----------+---------+---------+*/
      await checkNodeAmountTo(sTree, 1, TOKENS_10000);
      for (const i of Array(15).keys()) await checkNodeAmountTo(sTree, i + 2, ZERO);

      // #13 +1
      await sTree.nodeAddLiquidity(1);
      let tx13 = await sTree.nodeWithdraw(13);
      expect(await getWithdrawnAmount(tx13)).to.be.eq(BigNumber.from(TOKENS_10000).add(1));
    });
    it("addLimit(100, 8) to empty tree after series of depo/withdraw", async () => {
      describe("Example tree (8 leaves) fair distribution", async () => {
        beforeEach(async () => {
          sTree = await prepareTree(ethers, MIDDLE_TREE_LEAFS);
          // depo/withdraw #8-#12
          for (const i of Array(5).keys()) {
            await sTree.nodeAddLiquidity(1);
            await sTree.nodeWithdraw(i + 8);
          }
        });
        it("addLimit(100, 8) to empty tree after series of depo/withdraw", async () => {
          await sTree.addLimit(TOKENS_10000, 8);
        });
        it("addLimit(100, 11) to empty tree after series of depo/withdraw", async () => {
          await sTree.addLimit(TOKENS_10000, 11);
        });
        it("addLimit(100, 12) to empty tree after series of depo/withdraw", async () => {
          await sTree.addLimit(TOKENS_10000, 12);
        });
        it("addLimit(100, 14) to empty tree after series of depo/withdraw", async () => {
          await sTree.addLimit(TOKENS_10000, 14);
        });
        afterEach(async () => {
          await checkNodeAmountTo(sTree, 1, TOKENS_10000);
          for (const i of Array(15).keys()) await checkNodeAmountTo(sTree, i + 2, ZERO);

          // #13 +1
          await sTree.nodeAddLiquidity(1);
          let tx13 = await sTree.nodeWithdraw(13);
          expect(await getWithdrawnAmount(tx13)).to.be.eq(BigNumber.from(TOKENS_10000).add(1));
        });
      });
    });
  });
});
