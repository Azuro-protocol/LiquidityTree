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

    error IncorrectLeaf();
    error LeafNotExist();
    error IncorrectPercent();

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
     */
    function nodeAddLiquidity(uint128 amount) public returns (uint48 resNode) {
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
     */
    function nodeWithdraw(uint48 leaf) public returns (uint128 withdrawAmount) {
        withdrawAmount = nodeWithdrawPercent(leaf, DECIMALS);
    }

    /**
     * @dev leaf withdraw preview, emulates push value from updated node to leaf
     * @param leaf - withdrawing leaf
     */
    function nodeWithdrawView(uint48 leaf)
        public
        view
        returns (uint128 withdrawAmount)
    {
        if (leaf < LIQUIDITYNODES || leaf > LIQUIDITYLASTNODE) return 0;
        if (treeNode[leaf].updateId == 0) return 0;

        // get last-updated top node
        (uint48 updatedNode, uint48 begin, uint48 end) = getUpdatedNode(
            1,
            treeNode[1].updateId,
            LIQUIDITYNODES,
            LIQUIDITYLASTNODE,
            1,
            LIQUIDITYNODES,
            LIQUIDITYLASTNODE,
            leaf
        );

        return
            pushView(
                updatedNode,
                begin,
                end,
                leaf,
                treeNode[updatedNode].amount
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
     */
    function nodeWithdrawPercent(uint48 leaf, uint40 percent)
        public
        returns (uint128 withdrawAmount)
    {
        if (treeNode[leaf].updateId == 0) revert LeafNotExist();
        if (leaf < LIQUIDITYNODES || leaf > LIQUIDITYLASTNODE)
            revert IncorrectLeaf();
        if (percent > DECIMALS) revert IncorrectPercent();

        // get last-updated top node
        (uint48 updatedNode, uint48 begin, uint48 end) = getUpdatedNode(
            1,
            treeNode[1].updateId,
            LIQUIDITYNODES,
            LIQUIDITYLASTNODE,
            1,
            LIQUIDITYNODES,
            LIQUIDITYLASTNODE,
            leaf
        );
        // push changes from last-updated node down to the leaf, if leaf is not up to date
        push(updatedNode, begin, end, leaf, ++updateId);

        // remove amount (percent of amount) from leaf to it's parents
        withdrawAmount = uint128(
            (uint256(treeNode[leaf].amount) * percent) / DECIMALS
        );

        updateUp(leaf, withdrawAmount, true, ++updateId);

        emit withdrawn(msg.sender, withdrawAmount);
    }

    /**
     * @dev top node is ever most updated, trying to find lower node not older then top node
     * @dev get nearest to leaf (lowest) last-updated node from the parents, runing down from top to leaf
     * @param parent top node
     * @param parentUpdate top node update
     * @param parentBegin top node most left leaf
     * @param parentEnd top node most right leaf
     * @param node node parent for the leaf
     * @param begin node most left leaf
     * @param end node most right leaf
     * @param leaf target leaf
     * @return resParent found most updated leaf parent
     * @return resBegin found parent most left leaf
     * @return resEnd found parent most right leaf
     */
    function getUpdatedNode(
        uint48 parent,
        uint64 parentUpdate,
        uint48 parentBegin,
        uint48 parentEnd,
        uint48 node,
        uint48 begin,
        uint48 end,
        uint48 leaf
    )
        internal
        view
        returns (
            uint48 resParent,
            uint48 resBegin,
            uint48 resEnd
        )
    {
        // if node is older than it's parent, stop and return parent
        if (treeNode[node].updateId < parentUpdate) {
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
                parentUpdate,
                begin,
                end,
                node * 2,
                begin,
                mid,
                leaf
            );
        } else {
            // work on right child
            (resParent, resBegin, resEnd) = getUpdatedNode(
                node,
                parentUpdate,
                begin,
                end,
                node * 2 + 1,
                mid + 1,
                end,
                leaf
            );
        }
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
     * @dev add amount to whole tree, starting from top node #1
     * @param amount value to add
     */
    function add(uint128 amount) public {
        pushLazy(
            1,
            LIQUIDITYNODES,
            LIQUIDITYLASTNODE,
            LIQUIDITYNODES,
            nextNode - 1,
            amount,
            false,
            ++updateId
        );
    }

    /**
     * @dev add amount only for limited leaves in tree [first_leaf, leaf]
     * @param amount value to add
     */
    function addLimit(uint128 amount, uint48 leaf) public {
        if (leaf < LIQUIDITYNODES || leaf > LIQUIDITYLASTNODE)
            revert IncorrectLeaf();
        // get last-updated top node
        (uint48 updatedNode, uint48 begin, uint48 end) = getUpdatedNode(
            1,
            treeNode[1].updateId,
            LIQUIDITYNODES,
            LIQUIDITYLASTNODE,
            1,
            LIQUIDITYNODES,
            LIQUIDITYLASTNODE,
            leaf
        );

        // push changes from last-updated node down to the leaf, if leaf is not up to date
        push(updatedNode, begin, end, leaf, ++updateId);

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
        ) leaf = nextNode - 1; // push to the [LIQUIDITYNODES, leaf]

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
    function removeLimit(uint128 amount, uint48 leaf) public {
        if (leaf < LIQUIDITYNODES || leaf > LIQUIDITYLASTNODE)
            revert IncorrectLeaf();
        if (treeNode[1].amount >= amount) {
            // get last-updated top node
            (uint48 updatedNode, uint48 begin, uint48 end) = getUpdatedNode(
                1,
                treeNode[1].updateId,
                LIQUIDITYNODES,
                LIQUIDITYLASTNODE,
                1,
                LIQUIDITYNODES,
                LIQUIDITYLASTNODE,
                leaf
            );

            // push changes from last-updated node down to the leaf, if leaf is not up to date
            push(updatedNode, begin, end, leaf, ++updateId);

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
            ) leaf = nextNode - 1; // push to the [LIQUIDITYNODES, leaf]

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
     * @dev remove amount from whole tree, starting from top node #1
     * @param amount value to removeamount
     */
    function remove(uint128 amount) public {
        if (treeNode[1].amount >= amount) {
            pushLazy(
                1,
                LIQUIDITYNODES,
                LIQUIDITYLASTNODE,
                LIQUIDITYNODES,
                nextNode - 1,
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
        uint256 sumAmounts = lAmount + treeNode[rChild].amount;
        uint128 setLAmount = sumAmounts == 0
            ? 0
            : uint128((amount * lAmount) / sumAmounts);

        // update left and right child
        setAmount(lChild, setLAmount, updateId_);
        setAmount(rChild, amount - setLAmount, updateId_);

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
        uint256 sumAmounts = lAmount + treeNode[rChild].amount;
        uint128 setLAmount = sumAmounts == 0
            ? 0
            : uint128((amount * lAmount) / sumAmounts);

        uint48 mid = (begin + end) / 2;

        if (begin <= leaf && leaf <= mid) {
            return pushView(lChild, begin, mid, leaf, setLAmount);
        } else {
            return pushView(rChild, mid + 1, end, leaf, amount - setLAmount);
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
        if ((begin == l && end == r) || (begin == end)) {
            // if node leafs equal to leaf interval then stop
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
                if (sumAmounts == 0) return;
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

        if ((node * 2) >= LIQUIDITYNODES) return false; // leaves level reached

        // if node leafs equal to leaf interval then stop
        if ((begin == l && end == r) || (begin == end)) return false;

        uint48 mid = (begin + end) / 2;

        if (begin <= l && l <= mid) {
            if (begin <= r && r <= mid) {
                // [l,r] in [begin,mid] - all leafs in left child
                if (isNeedUpdateWholeLeaves(node * 2, begin, mid, l, r, amount, isSub))
                    return true;
            } else {
                uint256 lAmount = treeNode[node * 2].amount;
                // get right amount excluding unused leaves
                uint256 rAmount = treeNode[node * 2 + 1].amount -
                    getLeavesAmount(node * 2 + 1, mid + 1, end, r + 1, end);
                uint256 sumAmounts = lAmount + rAmount;
                if (sumAmounts == 0) return true;
                uint128 forLeftAmount = uint128(
                    ((amount * lAmount * DECIMALS) / sumAmounts) / DECIMALS
                );

                // l in [begin,mid] - part in left child
                if (
                    isNeedUpdateWholeLeaves(
                        node * 2,
                        begin,
                        mid,
                        l,
                        mid,
                        forLeftAmount,
                        isSub
                    )
                ) return true;

                // r in [mid+1,end] - part in right child
                if (
                    isNeedUpdateWholeLeaves(
                        node * 2 + 1,
                        mid + 1,
                        end,
                        mid + 1,
                        r,
                        amount - forLeftAmount,
                        isSub
                    )
                ) return true;
            }
        } else {
            // [l,r] in [mid+1,end] - all leafs in right child
            if (
                isNeedUpdateWholeLeaves(node * 2 + 1, mid + 1, end, l, r, amount, isSub)
            ) return true;
        }
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
    ) public view returns (uint128 amount) {
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
}
