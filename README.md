# Segment tree project

This project demonstrates the "segment tree" approach for accounting additions and withdrawals liquidity and fair profit/loose distribution for bet (stake) protocol

## General concept
A segment tree is a data structure that allows efficient finding and changing amounts in elements of the segment.
The segment tree is used to account for provided liquidity.
Each deposit is represented as a separate "leaf" element on the segment tree.
Leaves are the outermost elements in the segment tree.

Two leaves (left and right) are merged into one parent node. Two nodes (left and right) are merged into the parent node, and so on until the segment tree root.
The segment tree root node has the most up-to-date value of the sum of its child elements (leaves).
The root has no parent, and the leaves have no children.

In liquidity accounting, the root node contains the most updated current liquidity.

## Segment tree representation
All segment tree nodes are presented as array elements.
To store data in **K** elements, you need an array of **K*2+1** elements.
Element number **0** is not used, root node is number **1**, first leaf is number **K**
Children of the root node: **2** - left child **3** - right child

Segment tree navigation is done by node number calculation:
- left child of the node **X** has the number **2*X**
- right child has the number **2*X+1**
  

*4 elements segment tree example:*
```shell
+--------------------------------------------+
|                  1 (top node)              |
+------------------------+-------------------+
|             2          |         3         |
+-------------+----------+---------+---------+
|   4 (leaf)  |     5    |    6    |    7    |
+-------------+----------+---------+---------+
```

## Adding liquidity
With each liquidity addition, the following is done:
1. initialization of the next leaf in order (next unused).
2. adding the sum to the leaf's parent
3. adding the sum to the parent ancestor and so on up to the segment tree root, recursively.
   
Method for adding liquidity: **```function nodeAddLiquidity(uint128 amount) public```**

Thus, after adding, the **```amount```** will be added to the leaf and to all its parent nodes, including the root node.
Leaf initialization can be done only once.
In the future, leaf's amount can only change as a result of the distribution of profit / loss or the withdrawal of liquidity (total) from the leaf.

*Segment tree state after adding liquidity, updated nodes **4**, **5**, **2**, **1***

```shell
nodeAddLiquidity(100$)
+--------------------------------------------+
|                    1 (100$)                |
+------------------------+-------------------+
|         2 (100$)       |         3         |
+-------------+----------+---------+---------+
|   4 (100$)  |     5    |    6    |    7    |
+-------------+----------+---------+---------+
     +100$

nodeAddLiquidity(200$)
+--------------------------------------------+
|                    1 (300$)                |
+------------------------+-------------------+
|         2 (300$)       |         3         |
+-------------+----------+---------+---------+
|   4 (100$)  | 5 (200$) |    6    |    7    |
+-------------+----------+---------+---------+
                  +200$
```

## Taking liquidity for "game" reinforcement
For "game" reinforcement, liquidity took according to segment tree current state: root node **1** current amount and for further fair distribution, you must "remember" the last initialized leaf.
Liquidity is taken using method **```function remove(uint128 amount) public```**.
The **```remove```** method uses "lazy updating" of child nodes so that if the updated list of leaves lies entirely in the parent node, then only this parent node is updated and further changes to child nodes are not made and postponed.

*Segment tree state that after taking liquidity for the "game" ($10), the nodes **1** and **2** have been updated, because the changes affect only the list of leaves [4, 5], and the entire list is included in the node **2**, you only need to update the sum of the node **1** and **2***

```shell
remove(10$)
+--------------------------------------------+
|                    1 (290$)                |
+------------------------+-------------------+
|         2 (290$)       |         3         |
+-------------+----------+---------+---------+
|   4 (100$)  | 5 (200$) |    6    |    7    |
+-------------+----------+---------+---------+
```

*after that, for example, liquidity was added (to the next leaf **6**), nodes **6**, **3**, **1*** were updated

```shell
nodeAddLiquidity(300$)
+--------------------------------------------+
|                    1 (590$)                |
+------------------------+-------------------+
|         2 (290$)       |    3 (300$)       |
+-------------+----------+---------+---------+
|   4 (100$)  | 5 (200$) | 6 (300$)|    7    |
+-------------+----------+---------+---------+
                            +300$
```

## Adding liquidity
Made by passing the return amount and the leaf number, indicating the range of distribution of the returned amount from the first element to "leaf number" at the time of "taking liquidity".
Called with **```function addLimit(uint128 amount, uint48 leaf) public```**

*In the example, nodes **1**, **2** are updated. Amount in **4**, **5** not changed, because **4**, **5** enter node **2** and lazy update stopped at **2***

```shell
addLimit(13$, 5)
+13$  [4, 5]
+--------------------------------------------+
|                    1 (603$)                |
+------------------------+-------------------+
|         2 (303$)       |    3 (300$)       |
+-------------+----------+---------+---------+
|   4 (100$)  | 5 (200$) | 6 (300$)|    7    |
+-------------+----------+---------+---------+
```

## Liquidity withdrawal
Called by **```function nodeWithdraw(uint48 leaf) public```**
Under the hood:
1. Search for "most updated parent" of the leaf
2. leaf's amount value updating from the "most updated parent" (recursively from parent to child)
3. full liquidity withdrawal from the leaf, updating all parent nodes from the leaf to the root node.

```shell
nodeWithdraw(4) 
+--------------------------------------------+
|                     1 (502$)               |
+------------------------+-------------------+
|         2 (202$)       |    3 (300$)       |
+-------------+----------+---------+---------+
|    4 (0$)   | 5 (200$) | 6 (300$)|    7    |
+-------------+----------+---------+---------+
     -101$


nodeWithdraw(5) 
+--------------------------------------------+
|                     1 (300$)               |
+------------------------+-------------------+
|           2 (0$)       |    3 (300$)       |
+-------------+----------+---------+---------+
|    4 (0$)   |  5 (0$)  | 6 (300$)|    7    |
+-------------+----------+---------+---------+
                  -202$
```

## compile and test tasks:

```shell
npx hardhat compile
npx hardhat test
```