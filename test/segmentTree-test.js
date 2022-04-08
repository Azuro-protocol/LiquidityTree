const { expect } = require("chai");
const { ethers } = require("hardhat");
const { tokens, getNodeAmount, prepareTree, getWithdrawnAmount } = require("../utils/utils");

const TOKENS_100 = tokens(100);
const BIG_TREE_LEAFS = 1_099_511_627_776;
const SMALL_TREE_LEAFS = 16;

describe("SegmentTree", () => {
  let sTree;
  describe.skip("Big tree", async () => {
    beforeEach(async () => {
      sTree = await prepareTree(ethers, BIG_TREE_LEAFS);
    });
    it("res", async () => {
      console.log("before add nextNode", (await sTree.nextNode()).toString());
      //console.log((await sTree.nextNode())-2);
      for (const iterator of Array(300).keys()) {
        await sTree.nodeAddLiquidity(TOKENS_100);
      }
      console.log("after  add nextNode", (await sTree.nextNode()).toString());
      await sTree.remove(TOKENS_100);
      await sTree.add(TOKENS_100);
      await sTree.remove(TOKENS_100);
      await sTree.addLimit(tokens(100), (await sTree.nextNode())-3);
      let tx = await sTree.nodeWithdrawLiquidity((await sTree.nextNode())-2);
      console.log(await getWithdrawnAmount(tx));
      let tx2 = await sTree.nodeWithdrawLiquidity((await sTree.nextNode())-3);
      console.log(await getWithdrawnAmount(tx2));
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
        Segment tree structure after nodeAddLiquidity:
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
      expect(await getNodeAmount(sTree, 8)).to.be.equal(tokens(200));
      expect(await getNodeAmount(sTree, 9)).to.be.equal(tokens(200));
      expect(await getNodeAmount(sTree, 10)).to.be.equal(tokens(200));
      expect(await getNodeAmount(sTree, 11)).to.be.equal(tokens(100));

      await sTree.add(TOKENS_100);
      /*
        Segment tree structure after add(TOKENS_100) on top 1:
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
      expect((await sTree.treeNode(10)).amount).to.be.equal("228571428571371428571");
      expect((await sTree.treeNode(22)).amount).to.be.equal("114285714285685714285");

      await sTree.nodeWithdrawLiquidity(16);

      /*
        Segment tree structure after nodeWithdrawLiquidity(16):
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
        Segment tree structure after nodeAddLiquidity:
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
      expect(await getNodeAmount(sTree, 5)).to.be.equal(tokens(200));
      expect(await getNodeAmount(sTree, 8)).to.be.equal(tokens(200));
      expect(await getNodeAmount(sTree, 9)).to.be.equal(tokens(200));
      expect(await getNodeAmount(sTree, 10)).to.be.equal(tokens(200));

      await sTree.add(TOKENS_100);
      /*
        Segment tree structure after add:
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
      //console.log(1, (await sTree.treeNode(1)).amount.toString());
      /* for (const i of Array(SMALL_TREE_LEAFS * 2).keys()) {
        console.log(i, (await sTree.treeNode(i)).amount.toString());
      } */
      expect((await sTree.treeNode(4)).amount).to.be.equal("466666666666600000000");
      expect((await sTree.treeNode(10)).amount).to.be.equal("233333333333300000000");
      expect((await sTree.treeNode(22)).amount).to.be.equal("0");
    });
    it("add liquidity to 7 leafs, top remove 100, withdraw leaf #1 add by 7 leaves", async () => {
      for (const i of Array(7).keys()) {
        await sTree.nodeAddLiquidity(TOKENS_100);
      }
      /*
        Segment tree structure after nodeAddLiquidity:
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
      expect(await getNodeAmount(sTree, 8)).to.be.equal(tokens(200));
      expect(await getNodeAmount(sTree, 9)).to.be.equal(tokens(200));
      expect(await getNodeAmount(sTree, 10)).to.be.equal(tokens(200));
      expect(await getNodeAmount(sTree, 11)).to.be.equal(tokens(100));

      await sTree.remove(TOKENS_100);

      /*
        Segment tree structure after remove(100):
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
      expect(await getNodeAmount(sTree, 5)).to.be.equal("257142857142900000000");
      expect(await getNodeAmount(sTree, 8)).to.be.equal(tokens(200));
      expect(await getNodeAmount(sTree, 9)).to.be.equal(tokens(200));
      expect(await getNodeAmount(sTree, 10)).to.be.equal("171428571428628571429");
      expect(await getNodeAmount(sTree, 11)).to.be.equal("85714285714314285715");

      let tx = await sTree.nodeWithdrawLiquidity(16);
      
      /*
        Segment tree structure after nodeWithdrawLiquidity(16):
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

      expect(await getWithdrawnAmount(tx)).to.be.equal("85714285714300000000");


      // add liquidity
      await sTree.nodeAddLiquidity(TOKENS_100);

      /*
        Segment tree structure after nodeAddLiquidity(TOKENS_100):
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
      expect(await getNodeAmount(sTree, 5)).to.be.equal("357142857142900000000");
      expect(await getNodeAmount(sTree, 8)).to.be.equal("85714285714300000000");
      expect(await getNodeAmount(sTree, 9)).to.be.equal("171428571428600000000");
      expect(await getNodeAmount(sTree, 10)).to.be.equal("171428571428628571429");
      expect(await getNodeAmount(sTree, 11)).to.be.equal("185714285714314285715");
      expect(await getNodeAmount(sTree, 23)).to.be.equal(tokens(100));

      //addLimit only for leaves [16-22], 23 not included
      await sTree.addLimit(tokens(100), 22);

      /*
        Segment tree structure after addLimit(100, 22):
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
        23 not changed because it is excluded by addLimit(tokens(100), 22)
      */

      expect(await getNodeAmount(sTree, 1)).to.be.equal("714285714285700000000");
      expect(await getNodeAmount(sTree, 2)).to.be.equal("714285714285700000000");
      expect(await getNodeAmount(sTree, 4)).to.be.equal("307142857142900000000");
      expect(await getNodeAmount(sTree, 5)).to.be.equal("407142857142900000000");
      expect(await getNodeAmount(sTree, 8)).to.be.equal("85714285714300000000");
      expect(await getNodeAmount(sTree, 9)).to.be.equal("171428571428600000000");
      expect(await getNodeAmount(sTree, 10)).to.be.equal("204761904761928571429");
      expect(await getNodeAmount(sTree, 11)).to.be.equal("202380952380964285715");
      expect(await getNodeAmount(sTree, 22)).to.be.equal("102380952380964285715");
      expect(await getNodeAmount(sTree, 23)).to.be.equal(tokens(100));

      //await sTree.addLimit(tokens(100), 23);

      /* for (const i of Array(SMALL_TREE_LEAFS * 2).keys()) {
        console.log(i, (await sTree.treeNode(i)).amount.toString());
      } */
    })
  });
});