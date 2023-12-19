// SPDX-License-Identifier: MIT

pragma solidity 0.8.16;

contract LiquidityTree {
    struct Node {
        uint64 updateId; // last update number
        uint128 amount; // node amount
    }

    uint40 constant DECIMALS = 10**12;
    uint48 immutable LIQUIDITYNODES; // = 1_099_511_627_776; // begining of data nodes (top at node #1)
    uint48 immutable LIQUIDITYLASTNODE; // LIQUIDITYNODES * 2 - 1

    uint48 public nextNode; // next unused node number for adding liquidity

    uint64 public updateId; // update number, used instead of timestamp for splitting changes time on the same nodes

    // liquidity (segment) tree
    mapping(uint48 => Node) public treeNode;

    event withdrawn(address wallet, uint128 amount);

    error IncorrectAmount();
    error IncorrectLeaf();
    error LeafNotExist();
    error IncorrectPercent();
    error LeafNumberRangeExceeded();

    modifier checkLeaf(uint48 leaf) {
        _checkLeaf(leaf);
        _;
    }

    modifier checkAmount(uint128 amount) {
        _checkAmount(amount);
        _;
    }

    /**
     * @dev initializing LIQUIDITYNODES and nextNode. 
     * @dev LIQUIDITYNODES is count of liquidity (segment) tree leaves contains single liquidity addings
     * @dev liquidity (segment) tree build as array of 2*LIQUIDITYNODES count, top node has id #1 (id #0 not used)
     * @dev liquidity (segment) tree leaves is array [LIQUIDITYNODES, 2*LIQUIDITYNODES-1]
     * @dev liquidity (segment) tree node index N has left child index 2*N and right child index 2N+1
     * @dev +--------------------------------------------+
            |                  1 (top node)              |
            +------------------------+-------------------+
            |             2          |         3         |
            +-------------+----------+---------+---------+
            | 4 (nextNode)|     5    |    6    |    7    |
            +-------------+----------+---------+---------+
     * @param liquidityNodes count of leaves - possible single liquidity addings
     */
    constructor(uint48 liquidityNodes) {
        LIQUIDITYNODES = liquidityNodes;
        LIQUIDITYLASTNODE = liquidityNodes * 2 - 1;
        nextNode = liquidityNodes;
        updateId++; // start from non zero
    }

    /**
     * @dev add liquidity amount from the leaf up to top node
     * @param amount - adding amount
     * @return resNode - node (leaf) number of added liquidity
     */
    function nodeAddLiquidity(uint128 amount)
        public
        checkAmount(amount)
        returns (uint48 resNode)
    {
        if (nextNode > LIQUIDITYLASTNODE) revert LeafNumberRangeExceeded();
        updateUp(nextNode, amount, false, ++updateId);
        resNode = nextNode;
        nextNode++;
    }

    /**
     * @dev withdraw all liquidity from the leaf, due possible many changes in leafe's parent nodes
     * @dev it is needed firstly to update its amount and then withdraw
     * @dev used steps:
     * @dev 1 - get last updated parent most near to the leaf
     * @dev 2 - push all changes from found parent doen to the leaf - that updates leaf's amount
     * @dev 3 - execute withdraw of leaf amount and update amount changing up to top parents
     * @param leaf - leaf number to completely withdraw
     * @return withdrawAmount - withdrawn amount of the leaf
     */
    function nodeWithdraw(uint48 leaf) public returns (uint128 withdrawAmount) {
        withdrawAmount = nodeWithdrawPercent(leaf, DECIMALS);
    }

    /**
     * @dev leaf withdraw preview, emulates push value from updated node to leaf
     * @param leaf - withdrawing leaf
     * @return withdrawAmount - withdrawal preview amount of the leaf
     */
    function nodeWithdrawView(uint48 leaf)
        public
        view
        returns (uint128 withdrawAmount)
    {
        if (leaf < LIQUIDITYNODES || leaf > LIQUIDITYLASTNODE) return 0;
        if (treeNode[leaf].updateId == 0) return 0;

        return
            pushView(
                1,
                LIQUIDITYNODES,
                LIQUIDITYLASTNODE,
                leaf,
                treeNode[1].amount
            );
    }

    /**
     * @dev withdraw part of liquidity from the leaf, due possible many changes in leafe's parent nodes
     * @dev it is needed firstly to update its amount and then withdraw
     * @dev used steps:
     * @dev 1 - get last updated parent most near to the leaf
     * @dev 2 - push all changes from found parent doen to the leaf - that updates leaf's amount
     * @dev 3 - execute withdraw of leaf amount and update amount changing up to top parents
     * @param leaf - leaf number
     * @param percent - percent of leaf amount 1*10^12 is 100%, 5*10^11 is 50%
     * @return withdrawAmount - withdrawn amount of the leaf according percent share
     */
    function nodeWithdrawPercent(uint48 leaf, uint40 percent)
        public
        checkLeaf(leaf)
        returns (uint128 withdrawAmount)
    {
        if (treeNode[leaf].updateId == 0) revert LeafNotExist();
        if (percent > DECIMALS) revert IncorrectPercent();

        // push changes from top node down to the leaf, if leaf is not up to date
        push(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, leaf, ++updateId);

        // remove amount (percent of amount) from leaf to it's parents
        withdrawAmount = uint128(
            (uint256(treeNode[leaf].amount) * percent) / DECIMALS
        );

        updateUp(leaf, withdrawAmount, true, ++updateId);

        emit withdrawn(msg.sender, withdrawAmount);
    }

    /**
     * @dev update up amounts from leaf up to top node #1, used in adding/removing values on leaves
     * @param child node for update
     * @param amount value for update
     * @param isSub true - reduce, false - add
     * @param updateId_ update number
     */
    function updateUp(
        uint48 child,
        uint128 amount,
        bool isSub,
        uint64 updateId_
    ) internal {
        changeAmount(child, amount, isSub, updateId_);
        // if not top parent
        if (child != 1) {
            updateUp(getParent(child), amount, isSub, updateId_);
        }
    }

    /**
     * @dev add amount to whole tree (all used leaves), starting from top node #1
     * @param amount value to add
     */
    function add(uint128 amount) public checkAmount(amount) {
        // if no leaves, distribution to the whole tree
        uint48 leaf = nextNode > LIQUIDITYNODES
            ? nextNode - 1
            : LIQUIDITYLASTNODE;

        // push changes from top node down to the leaf
        if (treeNode[1].amount != 0)
            push(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, leaf, ++updateId);

        pushLazy(
            1,
            LIQUIDITYNODES,
            LIQUIDITYLASTNODE,
            LIQUIDITYNODES,
            leaf,
            amount,
            false,
            ++updateId
        );
    }

    /**
     * @dev add amount only for limited leaves in tree [first_leaf, leaf]
     * @param amount value to add
     */
    function addLimit(uint128 amount, uint48 leaf)
        public
        checkLeaf(leaf)
        checkAmount(amount)
    {
        uint48 lastUsedNode = nextNode - 1;
        if (leaf > lastUsedNode) leaf = lastUsedNode;

        push(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, leaf, ++updateId);
        if (
            isNeedUpdateWholeLeaves(
                1,
                LIQUIDITYNODES,
                LIQUIDITYLASTNODE,
                LIQUIDITYNODES,
                leaf,
                amount,
                false
            )
        ) leaf = lastUsedNode; // push to the all used leaves [LIQUIDITYNODES, lastUsedNode]

        pushLazy(
            1,
            LIQUIDITYNODES,
            LIQUIDITYLASTNODE,
            LIQUIDITYNODES,
            leaf,
            amount,
            false,
            ++updateId
        );
    }

    /**
     * @dev remove amount only for limited leaves in tree [first_leaf, leaf]
     * @param amount value to remove
     */
    function removeLimit(uint128 amount, uint48 leaf)
        public
        checkLeaf(leaf)
        checkAmount(amount)
    {
        uint48 lastUsedNode = nextNode - 1;
        if (leaf > lastUsedNode) leaf = lastUsedNode;

        if (treeNode[1].amount >= amount) {
            push(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, leaf, ++updateId);
            if (
                isNeedUpdateWholeLeaves(
                    1,
                    LIQUIDITYNODES,
                    LIQUIDITYLASTNODE,
                    LIQUIDITYNODES,
                    leaf,
                    amount,
                    true
                )
            ) leaf = lastUsedNode; // push to the all used leaves [LIQUIDITYNODES, lastUsedNode]

            pushLazy(
                1,
                LIQUIDITYNODES,
                LIQUIDITYLASTNODE,
                LIQUIDITYNODES,
                leaf,
                amount,
                true,
                ++updateId
            );
        }
    }

    /**
     * @dev remove amount from whole tree (all used leaves), starting from top node #1
     * @param amount value to removeamount
     */
    function remove(uint128 amount) public checkAmount(amount) {
        if (treeNode[1].amount >= amount) {
            uint48 leaf = nextNode - 1;
            // push changes from top node down to the leaf
            push(1, LIQUIDITYNODES, LIQUIDITYLASTNODE, leaf, ++updateId);

            pushLazy(
                1,
                LIQUIDITYNODES,
                LIQUIDITYLASTNODE,
                LIQUIDITYNODES,
                leaf,
                amount,
                true,
                ++updateId
            );
        }
    }

    /**
     * @dev push changes from last "lazy update" down to leaf
     * @param node - last node from lazy update
     * @param begin - leaf search start
     * @param end - leaf search end
     * @param leaf - last node to update
     * @param updateId_ update number
     */
    function push(
        uint48 node,
        uint48 begin,
        uint48 end,
        uint48 leaf,
        uint64 updateId_
    ) internal {
        // if node is leaf, stop
        if (node == leaf) {
            return;
        }
        uint48 lChild = node * 2;
        uint48 rChild = node * 2 + 1;
        uint128 amount = treeNode[node].amount;
        uint256 lAmount = treeNode[lChild].amount;
        uint256 rAmount = treeNode[rChild].amount;
        uint256 sumAmounts = lAmount + rAmount;
        uint128 setLAmount = sumAmounts == 0
            ? 0
            : uint128((amount * lAmount) / sumAmounts);

        // update left and right childs if non-zero
        if (lAmount > 0) setAmount(lChild, setLAmount, updateId_);
        if (rAmount > 0) setAmount(rChild, amount - setLAmount, updateId_);

        uint48 mid = (begin + end) / 2;

        if (begin <= leaf && leaf <= mid) {
            push(lChild, begin, mid, leaf, updateId_);
        } else {
            push(rChild, mid + 1, end, leaf, updateId_);
        }
    }

    /**
     * @dev push changes from last "lazy update" down to leaf
     * @param node - last node from lazy update
     * @param begin - leaf search start
     * @param end - leaf search end
     * @param leaf - last node to update
     * @param amount - pushed (calced) amount for the node
     * @return withdrawAmount - withdrawal preview amount of the leaf
     */
    function pushView(
        uint48 node,
        uint48 begin,
        uint48 end,
        uint48 leaf,
        uint128 amount
    ) internal view returns (uint128 withdrawAmount) {
        // if node is leaf, stop
        if (node == leaf) {
            return amount;
        }

        uint48 lChild = node * 2;
        uint48 rChild = node * 2 + 1;
        uint256 lAmount = treeNode[lChild].amount;
        uint256 rAmount = treeNode[rChild].amount;
        uint256 sumAmounts = lAmount + treeNode[rChild].amount;
        uint128 setLAmount = sumAmounts == 0
            ? 0
            : uint128((amount * lAmount) / sumAmounts);

        uint48 mid = (begin + end) / 2;

        if (begin <= leaf && leaf <= mid) {
            return
                (lAmount == 0)
                    ? 0
                    : pushView(lChild, begin, mid, leaf, setLAmount);
        } else {
            return
                (rAmount == 0)
                    ? 0
                    : pushView(rChild, mid + 1, end, leaf, amount - setLAmount);
        }
    }

    /**
     * @dev push lazy (lazy propagation) amount value from top node to child nodes contained leafs from 0 to r
     * @param node - start from node
     * @param begin - node left element
     * @param end - node right element
     * @param l - left leaf child
     * @param r - right leaf child
     * @param amount - amount to add/reduce stored amounts
     * @param isSub - true means negative to reduce
     * @param updateId_ update number
     */
    function pushLazy(
        uint48 node,
        uint48 begin,
        uint48 end,
        uint48 l,
        uint48 r,
        uint128 amount,
        bool isSub,
        uint64 updateId_
    ) internal {
        if (node == 1 && !isSub && treeNode[node].amount == 0) {
            changeAmount(node, amount, isSub, updateId_);
            return;
        }
        if ((begin == l && end == r) || (begin == end)) {
            // if node leafs equal to leaf interval then stop
            // only for not zero node or add to top node
            if (treeNode[node].amount > 0)
                changeAmount(node, amount, isSub, updateId_);
            return;
        }

        uint48 mid = (begin + end) / 2;

        if (begin <= l && l <= mid) {
            if (begin <= r && r <= mid) {
                // [l,r] in [begin,mid] - all leafs in left child
                pushLazy(node * 2, begin, mid, l, r, amount, isSub, updateId_);
            } else {
                uint256 lAmount = treeNode[node * 2].amount;
                // get right amount excluding unused leaves
                uint256 rAmount = treeNode[node * 2 + 1].amount -
                    getLeavesAmount(node * 2 + 1, mid + 1, end, r + 1, end);
                uint256 sumAmounts = lAmount + rAmount;

                if (sumAmounts == 0) {
                    if (node == 1 || (treeNode[node].amount > 0))
                        changeAmount(node, amount, isSub, updateId_);
                    return;
                }
                uint128 forLeftAmount = uint128(
                    ((amount * lAmount * DECIMALS) / sumAmounts) / DECIMALS
                );

                // l in [begin,mid] - part in left child
                pushLazy(
                    node * 2,
                    begin,
                    mid,
                    l,
                    mid,
                    forLeftAmount,
                    isSub,
                    updateId_
                );

                // r in [mid+1,end] - part in right child
                pushLazy(
                    node * 2 + 1,
                    mid + 1,
                    end,
                    mid + 1,
                    r,
                    amount - forLeftAmount,
                    isSub,
                    updateId_
                );
            }
        } else {
            // [l,r] in [mid+1,end] - all leafs in right child
            pushLazy(
                node * 2 + 1,
                mid + 1,
                end,
                l,
                r,
                amount,
                isSub,
                updateId_
            );
        }
        if (node == 1 || (treeNode[node].amount > 0))
            changeAmount(node, amount, isSub, updateId_);
    }

    /**
     * @dev push lazy preview (lazy propagation) amount value from top node to child nodes contained leafs from 0 to r
     *      Returns `true` - means found exception and need to update whole leaves
     * @param node - start from node
     * @param begin - node left element
     * @param end - node right element
     * @param l - left leaf child
     * @param r - right leaf child
     * @param amount - amount to add/reduce stored amounts
     * @param isSub - true means negative to reduce
     * @return isUpdateInsufficient - true - if can't increase/reduce value because of insufficient or zero value.
     */
    function isNeedUpdateWholeLeaves(
        uint48 node,
        uint48 begin,
        uint48 end,
        uint48 l,
        uint48 r,
        uint128 amount,
        bool isSub
    ) internal view returns (bool isUpdateInsufficient) {
        // if reducing and left node is insufficient in funds
        // of increasing and left node is ZERO run push scenario (left+right) without excluding for [begin, r] leaves
        if (
            (isSub && treeNode[node].amount < amount) ||
            (!isSub && treeNode[node].amount == 0)
        ) return true;

        // if node leafs equal to leaf interval then stop
        if ((begin == l && end == r) || (begin == end)) return false;

        uint48 mid = (begin + end) / 2;

        if (begin <= l && l <= mid) {
            if (begin <= r && r <= mid) {
                // [l,r] in [begin,mid] - all leafs in left child
                return
                    isNeedUpdateWholeLeaves(
                        node * 2,
                        begin,
                        mid,
                        l,
                        r,
                        amount,
                        isSub
                    );
            } else {
                uint48 lChild = node * 2;
                uint48 rChild = lChild + 1;
                uint256 lAmount = treeNode[lChild].amount;
                uint256 sumAmounts = lAmount +
                    // get right amount excluding unused leaves
                    (treeNode[rChild].amount -
                        getLeavesAmount(rChild, mid + 1, end, r + 1, end));
                if (sumAmounts == 0) return true;
                uint128 forLeftAmount = uint128(
                    ((amount * lAmount * DECIMALS) / sumAmounts) / DECIMALS
                );

                // l in [begin,mid] - part in left child or
                // r in [mid+1,end] - part in right child
                // for "sub" case if one child need update then return true
                // for "add" both child need whole update for return true
                return (
                    isSub
                        ? isNeedUpdateWholeLeaves(
                            lChild,
                            begin,
                            mid,
                            l,
                            mid,
                            forLeftAmount,
                            isSub
                        ) ||
                            isNeedUpdateWholeLeaves(
                                rChild,
                                mid + 1,
                                end,
                                mid + 1,
                                r,
                                amount - forLeftAmount,
                                isSub
                            )
                        : isNeedUpdateWholeLeaves(
                            lChild,
                            begin,
                            mid,
                            l,
                            mid,
                            forLeftAmount,
                            isSub
                        ) &&
                            isNeedUpdateWholeLeaves(
                                rChild,
                                mid + 1,
                                end,
                                mid + 1,
                                r,
                                amount - forLeftAmount,
                                isSub
                            )
                );
            }
        }
        // [l,r] in [mid+1,end] - all leafs in right child
        else
            return
                isNeedUpdateWholeLeaves(
                    node * 2 + 1,
                    mid + 1,
                    end,
                    l,
                    r,
                    amount,
                    isSub
                );
    }

    /**
     * @dev change amount by adding value or reducing value
     * @param node - node for changing
     * @param amount - amount value for changing
     * @param isSub - true - reduce by amount, false - add by amount
     * @param updateId_ - update number
     */
    function changeAmount(
        uint48 node,
        uint128 amount,
        bool isSub,
        uint64 updateId_
    ) internal {
        treeNode[node].updateId = updateId_;
        if (isSub) {
            if (treeNode[node].amount >= amount)
                treeNode[node].amount -= amount;
        } else {
            treeNode[node].amount += amount;
        }
    }

    /**
     * @dev reset node amount, used in push
     * @param node for set
     * @param amount value
     * @param updateId_ update number
     */
    function setAmount(
        uint48 node,
        uint128 amount,
        uint64 updateId_
    ) internal {
        if (treeNode[node].amount != amount) {
            treeNode[node].updateId = updateId_;
            treeNode[node].amount = amount;
        }
    }

    /**
     * @dev parent N has left child 2N and right child 2N+1getLeavesAmount
     * @param fromNumber - get parent from some child
     * @return parentNumber - found parent
     */
    function getParent(uint48 fromNumber)
        public
        pure
        returns (uint48 parentNumber)
    {
        // if requested from top
        if (fromNumber == 1) {
            return 1;
        }
        return fromNumber / 2;
    }

    /**
     * @dev for current node get sum amount of exact leaves list
     * @param node node to get sum amount
     * @param begin - node left element
     * @param end - node right element
     * @param l - left leaf of the list
     * @param r - right leaf of the list
     * @return amount sum of leaves list
     */
    function getLeavesAmount(
        uint48 node,
        uint48 begin,
        uint48 end,
        uint48 l,
        uint48 r
    ) internal view returns (uint128 amount) {
        if ((begin == l && end == r) || (begin == end)) {
            // if node leafs equal to leaf interval then stop and return amount value
            return (treeNode[node].amount);
        }

        uint48 mid = (begin + end) / 2;

        if (begin <= l && l <= mid) {
            if (begin <= r && r <= mid) {
                amount += getLeavesAmount(node * 2, begin, mid, l, r);
            } else {
                amount += getLeavesAmount(node * 2, begin, mid, l, mid);
                amount += getLeavesAmount(
                    node * 2 + 1,
                    mid + 1,
                    end,
                    mid + 1,
                    r
                );
            }
        } else {
            amount += getLeavesAmount(node * 2 + 1, mid + 1, end, l, r);
        }

        return amount;
    }

    function _checkAmount(uint128 amount) internal pure {
        if (amount == 0) revert IncorrectAmount();
    }

    function _checkLeaf(uint48 leaf) internal view {
        if (leaf < LIQUIDITYNODES || leaf > LIQUIDITYLASTNODE)
            revert IncorrectLeaf();
    }
}
