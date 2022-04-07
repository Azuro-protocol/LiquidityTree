// SPDX-License-Identifier: MIT

pragma solidity 0.8.3;

contract SegmentTree {
    uint40 constant decimals = 10**12;
    uint48 immutable LIQUIDITYNODES; // = 1_099_511_627_776; // begining of data nodes, top at node #1

    uint48 public nextNode; // next node number for adding liquidity

    struct Node {
        uint64 timestamp;
        uint128 amount;
    }

    mapping(uint48 => Node) public treeNode;

    constructor(uint48 liquidityNodes) {
        LIQUIDITYNODES = liquidityNodes;
        nextNode = liquidityNodes;
    }

    function nodeAddLiquidity(uint128 _amount) public {
        updateUp(nextNode, _amount, false);
        nextNode++;
    }

    function nodeWithdrawLiquidity(uint48 leaf) public {
        require(treeNode[leaf].timestamp != 0, "Leaf not exist");
        // get last-updated top node
        (uint48 updatedNode, uint48 begin, uint48 end) = getUpdatedNode(
            1,
            LIQUIDITYNODES,
            LIQUIDITYNODES * 2 - 1,
            1,
            LIQUIDITYNODES,
            LIQUIDITYNODES * 2 - 1,
            leaf,
            treeNode[1].timestamp
        );
        // push changes from last-updated node down to the leaf, if leaf is not up to date
        push(updatedNode, begin, end, leaf);
        // remove amount from leaf to it's parents
        updateUp(leaf, treeNode[leaf].amount, true);
    }

    /**
     * @dev get nearest to leaf (lowest) last-updated node from the parents, runs down from top 1 to leaf

     */
    function getUpdatedNode(
        uint48 parent,
        uint48 parentBegin,
        uint48 parentEnd,
        uint48 node,
        uint48 begin,
        uint48 end,
        uint48 leaf,
        uint64 timestamp
    )
        public
        view
        returns (
            uint48 resParent,
            uint48 resBegin,
            uint48 resEnd
        )
    {
        // if node is older than it's parent or node is leaf, stop and return parent
        if (treeNode[node].timestamp < timestamp) {
            return (parent, parentBegin, parentEnd);
        }
        if (node == leaf) {
            return (leaf, begin, end);
        }

        uint48 mid = (begin + end) / 2;

        if (begin <= leaf && leaf <= mid) {
            // work on left child
            (resParent, resBegin, resEnd) = getUpdatedNode(
                node,
                begin,
                end,
                node * 2,
                begin,
                mid,
                leaf,
                timestamp
            );
        } else {
            // work on right child
            (resParent, resBegin, resEnd) = getUpdatedNode(
                node,
                begin,
                end,
                node * 2 + 1,
                mid + 1,
                end,
                leaf,
                timestamp
            );
        }
    }

    /**
     * @dev update up amounts from leaf up to top node #1, used in adding/removing values on leaves
     * @param child node for update
     * @param amount value for update
     * @param isSub true - reduce, false - add
     */
    function updateUp(
        uint48 child,
        uint128 amount,
        bool isSub
    ) internal {
        changeAmount(child, amount, isSub);
        // if not top parent
        if (child != 1) {
            updateUp(getParent(child), amount, isSub);
        }
    }

    /**
     * @dev add amount to whole tree, starting from top node #1
     * @param amount value to add
     */
    function add(uint128 amount) public {
        pushLazy(
            1,
            LIQUIDITYNODES,
            LIQUIDITYNODES * 2 - 1,
            LIQUIDITYNODES,
            nextNode - 1,
            amount,
            false
        );
    }

    /**
     * @dev remove amount from whole tree, starting from top node #1
     * @param amount value to remove
     */
    function remove(uint128 amount) public {
        if (treeNode[1].amount >= amount) {
            pushLazy(
                1,
                LIQUIDITYNODES,
                LIQUIDITYNODES * 2 - 1,
                LIQUIDITYNODES,
                nextNode - 1,
                amount,
                true
            );
        }
    }

    /**
     * @dev push changes from last "lazy update" down to leaf
     * @param node - last node from lazy update
     * @param begin - leaf search start
     * @param end - leaf search end
     * @param leaf - last node to update
     */
    function push(
        uint48 node,
        uint48 begin,
        uint48 end,
        uint48 leaf
    ) internal {
        // if node is leaf, stop
        if (node == leaf) {
            return;
        }
        uint48 lChild = node * 2;
        uint48 rChild = node * 2 + 1;
        uint128 amount = treeNode[node].amount;
        uint128 lAmount = treeNode[lChild].amount;
        uint128 rAmount = treeNode[rChild].amount;
        uint128 sumAmounts = lAmount + rAmount;

        // update left and right child
        setAmount(
            lChild,
            (amount * ((lAmount * decimals) / sumAmounts)) / decimals
        );
        setAmount(
            rChild,
            (amount * ((rAmount * decimals) / sumAmounts)) / decimals
        );

        uint48 mid = (begin + end) / 2;

        if (begin <= leaf && leaf <= mid) {
            push(lChild, begin, mid, leaf);
        } else {
            push(rChild, mid + 1, end, leaf);
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
     */
    function pushLazy(
        uint48 node,
        uint48 begin,
        uint48 end,
        uint48 l,
        uint48 r,
        uint128 amount,
        bool isSub
    ) internal {
        if ((begin == l && end == r) || (begin == end)) {
            // if node leafs equal to leaf interval then stop
            changeAmount(node, amount, isSub);
            return;
        }

        uint48 mid = (begin + end) / 2;

        if (begin <= l && l <= mid) {
            if (begin <= r && r <= mid) {
                // [l,r] in [begin,mid] - all leafs in left child
                pushLazy(node * 2, begin, mid, l, r, amount, isSub);
            } else {
                uint128 lAmount = treeNode[node * 2].amount;
                uint128 rAmount = treeNode[node * 2 + 1].amount;
                uint128 sumAmounts = lAmount + rAmount;

                // l in [begin,mid] - part in left child
                pushLazy(
                    node * 2,
                    begin,
                    mid,
                    l,
                    mid,
                    (amount * ((lAmount * decimals) / sumAmounts)) / decimals,
                    isSub
                );
                // r in [mid+1,end] - part in right child
                pushLazy(
                    node * 2 + 1,
                    mid + 1,
                    end,
                    mid + 1,
                    r,
                    (amount * ((rAmount * decimals) / sumAmounts)) / decimals,
                    isSub
                );
            }
        } else {
            // [l,r] in [mid+1,end] - all leafs in right child
            pushLazy(node * 2 + 1, mid + 1, end, l, r, amount, isSub);
        }
        changeAmount(node, amount, isSub);
    }

    function changeAmount(
        uint48 node,
        uint128 amount,
        bool isSub
    ) internal {
        treeNode[node].timestamp = uint64(block.timestamp);
        if (isSub) {
            treeNode[node].amount -= amount;
        } else {
            treeNode[node].amount += amount;
        }
    }

    /**
     * @dev reset node amount, used in push
     * @param node for set
     * @param amount value
     */
    function setAmount(uint48 node, uint128 amount) internal {
        if (treeNode[node].amount != amount) {
            treeNode[node].timestamp = uint64(block.timestamp);
            treeNode[node].amount = amount;
        }
    }

    /**
     * @dev parent N has left child 2N and right child 2N+1
     *      odd number is left child node
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
        return (fromNumber % 2 == 0 ? fromNumber : fromNumber - 1) / 2;
    }
}
