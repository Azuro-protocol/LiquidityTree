# Liquidity tree project

This project demonstrates the "segment tree" approach for accounting additions and withdrawals liquidity and fair profit/loose distribution for bet (stake) protocol

## General concept
A segment tree is a data structure that allows for efficient finding and changing of data in a range of elements.
Each deposit is represented as a separate "leaf" element in the segment tree.
Leaves are the most remote elements in the segment tree.

Two leaves (left and right) are combined into one parent node. Two nodes (left and right) are combined into an parent node and so on up to the single root of the entire segment tree.
The root node of the segment tree represents the most up-to-date value of the sum of its child elements (leaves).
The root has no parents, and the leaves have no children.

The Liquidity Tree is a data structure used to track provided liquidity, based on a segment tree.
In the task of liquidity accounting, the root node contains the most up-to-date liquidity value.

## Liquidity Tree Organization
All Liquidity Tree nodes are stored as elements of an array.
To store data in **K** elements, an array of size **K*2+1** is required.
Element number **0** is not used, the root node has number **1**, and the first leaf has number **K**.
The children of the root node are: **2** - left child **3** - right child

Navigation inside the Liquidity Tree is performed through the relation of node numbers:
- The left child of node **X** has the number **2X**
- The right child has the number **2X+1**.
  

*Example of a Liquidity Tree for storing 4 elements:*
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
Each time liquidity is added, the following steps are performed:
1. Initialization of the next sequential leaf (the next unused one).
2. Adding the sum to the parent of the leaf
3. Adding the sum to the higher parent and so on up to the root of the Liquidity Tree, recursively.
   
Method for adding liquidity: **```nodeAddLiquidity(uint128 amount)```**

Thus, after adding, the **```amount```** will be added to the leaf and all parent nodes, including the root node.
Leaf initialization can only be done once.
In the future, the amount in the leaf can only change as a result of profit/loss distribution or full liquidity withdrawal from the leaf.

*Example of the Liquidity Tree state after adding liquidity - nodes **4**, **5**, **2**, **1** have been updated:*

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
For "game" reinforcement, liquidity took according to the current state of the Liquidity Tree: the current sum in the root node **1** and to ensure further fair distribution, it is necessary to "remember" the last relevant leaf.
Taking liquidity occurs using the method **```remove(uint128 amount)```**.
The **```remove```** method uses "lazy updating" of child nodes so that if the updated leaf list is completely within a parent node, only the parent node is updated and further changes to child nodes are not made and postponed.

*An example of the state of the Liquidity Tree after taking liquidity for "game" (30$), nodes **1** and **2** are updated, since the changes affect only the leaf list [4, 5], and the entire list is within node **2**, only the sum of nodes **1** and **2** needs to be updated:*

```shell
remove(30$)
+--------------------------------------------+
|                    1 (270$)                |
+------------------------+-------------------+
|         2 (270$)       |         3         |
+-------------+----------+---------+---------+
|   4 (100$)  | 5 (200$) |    6    |    7    |
+-------------+----------+---------+---------+
```

*After this, for example, liquidity was added (to the next leaf **6**), nodes **6**, **3**, **1** are updated.

```shell
nodeAddLiquidity(300$)
+--------------------------------------------+
|                    1 (570$)                |
+------------------------+-------------------+
|         2 (270$)       |    3 (300$)       |
+-------------+----------+---------+---------+
|   4 (100$)  | 5 (200$) | 6 (300$)|    7    |
+-------------+----------+---------+---------+
                            +300$
```

## Returning liquidity
It is done by specifying the amount to be returned and the leaf number indicating the range of the returned sum from the first element to the actual one at the time of "taking liquidity".
It is performed using the method **```addLimit(uint128 amount, uint48 leaf)```**

*In the example, first nodes **4** and **5** are updated according to the previous change (remove(30$)), then nodes **1** and **2** are updated. The data in **4** and **5** does not change, because **4** and **5** are within node **2** and lazy updating stopped at **2**.*

```shell
addLimit(15$, 5)
+15$  [4, 5]
+--------------------------------------------+
|                    1 (585$)                |
+------------------------+-------------------+
|         2 (285$)       |    3 (300$)       |
+-------------+----------+---------+---------+
|    4 (90$)  | 5 (180$) | 6 (300$)|    7    |
+-------------+----------+---------+---------+
```

## Withdrawing liquidity
It is done using the method **```nodeWithdraw(uint48 leaf)```**
Under the hood:
1. Find the "most recently updated parent" from the leaf.
2. Update (actualize) the data on the sum in the leaf from the "most recently updated parent", so that the sum in the leaf is updated. (also updated leaves **4** and **5**).
3. Then, the entire liquidity is withdrawn from the leaf, updating all parent nodes from the leaf to the root.

```shell
nodeWithdraw(4) 
+--------------------------------------------+
|                     1 (490$)               |
+------------------------+-------------------+
|         2 (190$)       |    3 (300$)       |
+-------------+----------+---------+---------+
|    4 (0$)   | 5 (190$) | 6 (300$)|    7    |
+-------------+----------+---------+---------+
     -95$


nodeWithdraw(5) 
+--------------------------------------------+
|                     1 (300$)               |
+------------------------+-------------------+
|           2 (0$)       |    3 (300$)       |
+-------------+----------+---------+---------+
|    4 (0$)   |  5 (0$)  | 6 (300$)|    7    |
+-------------+----------+---------+---------+
                  -190$
```

## compile and test tasks:

```shell
npx hardhat compile
npx hardhat test
```
