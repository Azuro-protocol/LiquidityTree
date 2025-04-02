// SPDX-License-Identifier: MIT

pragma solidity 0.8.27;

import "./interface/ILiquidityTree.sol";
import "./libraries/FixedMath.sol";

contract LiquidityTree is ILiquidityTree {
    using FixedMath for *;

    struct Node {
        uint64 updateId; // last update number
        uint128 amount; // node amount
    }

    uint48 immutable LIQUIDITYNODES; // = 1_099_511_627_776; // begining of data nodes (top at node #1)
    uint48 immutable LIQUIDITYMAXNODE; // the biggest possible size of the tree
    uint48 public liquidityLastNode; // current maximum usable leaf of the tree
    uint48 public root; // current root of the tree

    uint48 public nextNode; // next unused node number for adding liquidity

    uint64 public updateId; // update number, used instead of timestamp for splitting changes time on the same nodes

    // liquidity (segment) tree
    mapping(uint48 => Node) public treeNode;

    event Withdrawn(address wallet, uint128 amount);

    error IncorrectAmount();
    error IncorrectLeaf();
    error LeafNotExist();
    error IncorrectPercent();
    error LeafNumberRangeExceeded();
    error InsufficientTopNodeAmount();

    modifier checkAmount(uint128 amount) {
        _checkAmount(amount);
        _;
    }

    modifier checkLeaf(uint48 leaf) {
        _checkLeaf(leaf);
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
     * @param dynamicSize if true, the tree will initially have 1 leaf, and then double its size every time it's needed
     *                    if false, constant size always
     */
    constructor(uint48 liquidityNodes, bool dynamicSize) {
        LIQUIDITYNODES = liquidityNodes;
        LIQUIDITYMAXNODE = liquidityNodes * 2 - 1;
        nextNode = liquidityNodes;
        updateId++; // start from non zero

        if (dynamicSize) {
            // the tree starts to increase from the middle
            liquidityLastNode = liquidityNodes;
            root = liquidityNodes;
        } else {
            // the whole tree initialized
            liquidityLastNode = LIQUIDITYMAXNODE;
            root = 1;
        }
    }

    /**
     * @dev leaf withdraw preview, emulates push value from updated node to leaf
     * @param leaf - withdrawing leaf
     * @return withdrawAmount - withdrawal preview amount of the leaf
     */
    function nodeWithdrawView(
        uint48 leaf
    ) public view override returns (uint128 withdrawAmount) {
        if (leaf < LIQUIDITYNODES || leaf > liquidityLastNode) return 0;
        if (treeNode[leaf].updateId == 0) return 0;

        return
            _getPushView(
                root,
                LIQUIDITYNODES,
                liquidityLastNode,
                leaf,
                treeNode[root].amount
            );
    }

    /**
     * @dev add amount to whole tree (all used leaves), starting from top node #1
     * @param amount value to add
     */
    function _add(uint128 amount) internal checkAmount(amount) {
        // if no leaves, distribution to the whole tree
        uint48 leaf = nextNode > LIQUIDITYNODES
            ? nextNode - 1
            : liquidityLastNode;

        // push changes from top node down to the leaf
        if (treeNode[root].amount != 0)
            _push(root, LIQUIDITYNODES, liquidityLastNode, leaf, ++updateId);

        _pushLazy(
            root,
            LIQUIDITYNODES,
            liquidityLastNode,
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
    function _addLimit(
        uint128 amount,
        uint48 leaf
    ) internal checkLeaf(leaf) checkAmount(amount) {
        uint48 lastUsedNode = nextNode - 1;
        if (leaf > lastUsedNode) leaf = lastUsedNode;

        _push(root, LIQUIDITYNODES, liquidityLastNode, leaf, ++updateId);
        if (
            _isNeedUpdateWholeLeaves(
                root,
                LIQUIDITYNODES,
                liquidityLastNode,
                LIQUIDITYNODES,
                leaf,
                amount,
                false
            )
        ) {
            leaf = lastUsedNode; // push to the all used leaves [LIQUIDITYNODES, lastUsedNode]
            _push(root, LIQUIDITYNODES, liquidityLastNode, leaf, ++updateId);
        }

        _pushLazy(
            root,
            LIQUIDITYNODES,
            liquidityLastNode,
            LIQUIDITYNODES,
            leaf,
            amount,
            false,
            ++updateId
        );
    }

    /**
     * @dev change amount by adding value or reducing value if its sufficient.
     * @dev It can not sufficient for reduce because of not pushed changes.
     * @param node - node for changing
     * @param amount - amount value for changing
     * @param isSub - true - reduce by amount, false - add by amount
     * @param updateId_ - update number
     */
    function _changeAmount(
        uint48 node,
        uint128 amount,
        bool isSub,
        uint64 updateId_
    ) internal {
        // not reduce if node value is not sufficient
        if (isSub && treeNode[node].amount < amount) return;

        treeNode[node].updateId = updateId_;
        if (isSub) {
            treeNode[node].amount -= amount;
        } else {
            treeNode[node].amount += amount;
        }
    }

    /**
     * @dev add liquidity amount from the leaf up to top node
     * @param amount - adding amount
     * @return resNode - node (leaf) number of added liquidity
     */
    function _nodeAddLiquidity(
        uint128 amount
    ) internal checkAmount(amount) returns (uint48 resNode) {
        if (nextNode > LIQUIDITYMAXNODE) revert LeafNumberRangeExceeded();
        uint64 updateId_ = ++updateId;
        
        // when a tree leaves number limit is exceeded, it needs to become bigger
        if (nextNode > liquidityLastNode) {
            // double the number of leaves
            liquidityLastNode += nextNode - LIQUIDITYNODES;
            
            // initialize new root
            uint48 oldRoot_ = root;
            uint48 newRoot_ = oldRoot_ / 2;
            root = newRoot_;

            // update new root of the tree with the top amount
            treeNode[newRoot_].updateId = updateId_;
            treeNode[newRoot_].amount = treeNode[oldRoot_].amount;
        }
        _updateUp(nextNode, amount, false, updateId_);
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
    function _nodeWithdraw(
        uint48 leaf
    ) internal returns (uint128 withdrawAmount) {
        withdrawAmount = _nodeWithdrawPercent(leaf, uint40(FixedMath.ONE));
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
    function _nodeWithdrawPercent(
        uint48 leaf,
        uint40 percent
    ) internal checkLeaf(leaf) returns (uint128 withdrawAmount) {
        if (treeNode[leaf].updateId == 0) revert LeafNotExist();
        if (percent > FixedMath.ONE) revert IncorrectPercent();

        // push changes from top node down to the leaf, if leaf is not up to date
        _push(root, LIQUIDITYNODES, liquidityLastNode, leaf, ++updateId);

        // remove amount (percent of amount) from leaf to it's parents
        withdrawAmount = uint128(treeNode[leaf].amount.mul(percent));

        _updateUp(leaf, withdrawAmount, true, ++updateId);

        emit Withdrawn(msg.sender, withdrawAmount);
    }

    /**
     * @dev push changes from last "lazy update" down to leaf
     * @param node - last node from lazy update
     * @param start - leaf search start
     * @param end - leaf search end
     * @param leaf - last node to update
     * @param updateId_ update number
     */
    function _push(
        uint48 node,
        uint48 start,
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
        if (lAmount > 0) _setAmount(lChild, setLAmount, updateId_);
        if (rAmount > 0) _setAmount(rChild, amount - setLAmount, updateId_);

        uint48 mid = (start + end) / 2;

        if (start <= leaf && leaf <= mid) {
            _push(lChild, start, mid, leaf, updateId_);
        } else {
            _push(rChild, mid + 1, end, leaf, updateId_);
        }
    }

    /**
     * @dev push lazy (lazy propagation) amount value from top node to child nodes contained leafs from 0 to r
     * @param node - start from node
     * @param start - node left element
     * @param end - node right element
     * @param l - left leaf child
     * @param r - right leaf child
     * @param amount - amount to add/reduce stored amounts
     * @param isSub - true means negative to reduce
     * @param updateId_ update number
     */
    function _pushLazy(
        uint48 node,
        uint48 start,
        uint48 end,
        uint48 l,
        uint48 r,
        uint128 amount,
        bool isSub,
        uint64 updateId_
    ) internal {
        if (node == root && !isSub && treeNode[node].amount == 0) {
            _changeAmount(node, amount, isSub, updateId_);
            return;
        }
        if ((start == l && end == r) || (start == end)) {
            // if node leafs equal to leaf interval then stop
            // only for not zero node or add to top node
            if (treeNode[node].amount > 0)
                _changeAmount(node, amount, isSub, updateId_);
            return;
        }

        uint48 mid = (start + end) / 2;

        if (start <= l && l <= mid) {
            if (start <= r && r <= mid) {
                // [l,r] in [start,mid] - all leafs in left child
                _pushLazy(node * 2, start, mid, l, r, amount, isSub, updateId_);
            } else {
                uint256 lAmount = treeNode[node * 2].amount;
                // get right amount excluding unused leaves
                uint256 rAmount = treeNode[node * 2 + 1].amount -
                    _getLeavesAmount(node * 2 + 1, mid + 1, end, r + 1, end);
                uint256 sumAmounts = lAmount + rAmount;

                if (sumAmounts == 0) {
                    if (node == root || (treeNode[node].amount > 0))
                        _changeAmount(node, amount, isSub, updateId_);
                    return;
                }
                uint128 forLeftAmount = uint128(
                    (amount * lAmount).div(sumAmounts) / FixedMath.ONE
                );

                // l in [start,mid] - part in left child
                _pushLazy(
                    node * 2,
                    start,
                    mid,
                    l,
                    mid,
                    forLeftAmount,
                    isSub,
                    updateId_
                );

                // r in [mid+1,end] - part in right child
                _pushLazy(
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
            _pushLazy(
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
        if (node == root || (treeNode[node].amount > 0))
            _changeAmount(node, amount, isSub, updateId_);
    }

    /**
     * @dev remove amount from whole tree (all used leaves), starting from top node #1
     * @param amount value to removeamount
     */
    function _remove(uint128 amount) internal checkAmount(amount) {
        if (treeNode[root].amount < amount) revert InsufficientTopNodeAmount();

        uint48 leaf = nextNode - 1;
        // push changes from top node down to the leaf
        _push(root, LIQUIDITYNODES, liquidityLastNode, leaf, ++updateId);

        _pushLazy(
            root,
            LIQUIDITYNODES,
            liquidityLastNode,
            LIQUIDITYNODES,
            leaf,
            amount,
            true,
            ++updateId
        );
    }

    /**
     * @dev remove amount only for limited leaves in tree [first_leaf, leaf]
     * @param amount value to remove
     */
    function _removeLimit(
        uint128 amount,
        uint48 leaf
    ) internal checkLeaf(leaf) checkAmount(amount) {
        uint48 lastUsedNode = nextNode - 1;
        if (leaf > lastUsedNode) leaf = lastUsedNode;
        if (treeNode[root].amount < amount) revert InsufficientTopNodeAmount();

        _push(root, LIQUIDITYNODES, liquidityLastNode, leaf, ++updateId);
        if (
            _isNeedUpdateWholeLeaves(
                root,
                LIQUIDITYNODES,
                liquidityLastNode,
                LIQUIDITYNODES,
                leaf,
                amount,
                true
            )
        ) {
            leaf = lastUsedNode; // push to the all used leaves [LIQUIDITYNODES, lastUsedNode]
            _push(root, LIQUIDITYNODES, liquidityLastNode, leaf, ++updateId);
        }

        _pushLazy(
            root,
            LIQUIDITYNODES,
            liquidityLastNode,
            LIQUIDITYNODES,
            leaf,
            amount,
            true,
            ++updateId
        );
    }

    /**
     * @dev reset node amount, used in push
     * @param node for set
     * @param amount value
     * @param updateId_ update number
     */
    function _setAmount(
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
     * @dev update up amounts from leaf up to top node #1, used in adding/removing values on leaves
     * @param child node for update
     * @param amount value for update
     * @param isSub true - reduce, false - add
     * @param updateId_ update number
     */
    function _updateUp(
        uint48 child,
        uint128 amount,
        bool isSub,
        uint64 updateId_
    ) internal {
        _changeAmount(child, amount, isSub, updateId_);
        // if not top parent
        if (child != root) {
            _updateUp(_getParent(child), amount, isSub, updateId_);
        }
    }

    /**
     * @dev push lazy preview (lazy propagation) amount value from top node to child nodes contained leafs from 0 to r
     *      Returns `true` - means found exception and need to update whole leaves
     * @param node - start from node
     * @param start - node left element
     * @param end - node right element
     * @param l - left leaf child
     * @param r - right leaf child
     * @param amount - amount to add/reduce stored amounts
     * @param isSub - true means negative to reduce
     * @return isUpdateInsufficient - true - if can't increase/reduce value because of insufficient or zero value.
     */
    function _isNeedUpdateWholeLeaves(
        uint48 node,
        uint48 start,
        uint48 end,
        uint48 l,
        uint48 r,
        uint128 amount,
        bool isSub
    ) internal view returns (bool isUpdateInsufficient) {
        // if reducing and left node is insufficient in funds
        // of increasing and left node is ZERO run push scenario (left+right) without excluding for [start, r] leaves
        if (
            (isSub && treeNode[node].amount < amount) ||
            (!isSub && treeNode[node].amount == 0)
        ) return true;

        // if node leafs equal to leaf interval then stop
        if ((start == l && end == r) || (start == end)) return false;

        uint48 mid = (start + end) / 2;

        if (start <= l && l <= mid) {
            if (start <= r && r <= mid) {
                // [l,r] in [start,mid] - all leafs in left child
                if (treeNode[node * 2].amount == 0) return true;

                return
                    _isNeedUpdateWholeLeaves(
                        node * 2,
                        start,
                        mid,
                        l,
                        r,
                        amount,
                        isSub
                    );
            } else {
                uint48 lChild = node * 2;

                uint256 lAmount = treeNode[lChild].amount;
                uint256 rAmount = treeNode[lChild + 1].amount;
                uint256 sumAmounts = lAmount +
                    // get right amount excluding unused leaves
                    (rAmount -
                        _getLeavesAmount(lChild + 1, mid + 1, end, r + 1, end));
                if (sumAmounts == 0) return true;
                uint128 forLeftAmount = uint128(
                    (amount * lAmount).div(sumAmounts) / FixedMath.ONE
                );

                // if reduced amount is not sufficient for each child - need to update whole tree
                if (
                    (isSub &&
                        lAmount < forLeftAmount &&
                        (sumAmounts - lAmount < amount - forLeftAmount))
                ) return true;

                // l in [start,mid] - part in left child or
                // r in [mid+1,end] - part in right child
                // for "sub" case if one child need update then return true
                // for "add" both child need whole update for return true
                if (isSub) {
                    if (forLeftAmount > 0 && lAmount >= forLeftAmount)
                        return
                            _isNeedUpdateWholeLeaves(
                                lChild,
                                start,
                                mid,
                                l,
                                mid,
                                forLeftAmount,
                                isSub
                            );
                    if (rAmount >= amount - forLeftAmount)
                        return
                            _isNeedUpdateWholeLeaves(
                                lChild + 1,
                                mid + 1,
                                end,
                                mid + 1,
                                r,
                                amount - forLeftAmount,
                                isSub
                            );
                } else {
                    return
                        _isNeedUpdateWholeLeaves(
                            lChild,
                            start,
                            mid,
                            l,
                            mid,
                            forLeftAmount,
                            isSub
                        ) &&
                        _isNeedUpdateWholeLeaves(
                            lChild + 1,
                            mid + 1,
                            end,
                            mid + 1,
                            r,
                            amount - forLeftAmount,
                            isSub
                        );
                }
            }
        }
        // [l,r] in [mid+1,end] - all leafs in right child
        else
            return
                _isNeedUpdateWholeLeaves(
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
     * @dev for current node get sum amount of exact leaves list
     * @param node node to get sum amount
     * @param start - node left element
     * @param end - node right element
     * @param l - left leaf of the list
     * @param r - right leaf of the list
     * @return amount sum of leaves list
     */
    function _getLeavesAmount(
        uint48 node,
        uint48 start,
        uint48 end,
        uint48 l,
        uint48 r
    ) internal view returns (uint128 amount) {
        if ((start == l && end == r) || (start == end)) {
            // if node leafs equal to leaf interval then stop and return amount value
            return (treeNode[node].amount);
        }

        uint48 mid = (start + end) / 2;

        if (start <= l && l <= mid) {
            if (start <= r && r <= mid) {
                amount += _getLeavesAmount(node * 2, start, mid, l, r);
            } else {
                amount += _getLeavesAmount(node * 2, start, mid, l, mid);
                amount += _getLeavesAmount(
                    node * 2 + 1,
                    mid + 1,
                    end,
                    mid + 1,
                    r
                );
            }
        } else {
            amount += _getLeavesAmount(node * 2 + 1, mid + 1, end, l, r);
        }

        return amount;
    }

    /**
     * @dev parent N has left child 2N and right child 2N+1getLeavesAmount
     * @param fromNumber - get parent from some child
     * @return parentNumber - found parent
     */
    function _getParent(
        uint48 fromNumber
    ) internal view returns (uint48 parentNumber) {
        // if requested from top
        if (fromNumber == root) {
            return root;
        }
        return fromNumber / 2;
    }

    /**
     * @dev push changes from last "lazy update" down to leaf
     * @param node - last node from lazy update
     * @param start - leaf search start
     * @param end - leaf search end
     * @param leaf - last node to update
     * @param amount - pushed (calced) amount for the node
     * @return withdrawAmount - withdrawal preview amount of the leaf
     */
    function _getPushView(
        uint48 node,
        uint48 start,
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
        uint256 sumAmounts = lAmount + rAmount;
        uint128 setLAmount = sumAmounts == 0
            ? 0
            : uint128((amount * lAmount) / sumAmounts);

        uint48 mid = (start + end) / 2;

        if (start <= leaf && leaf <= mid) {
            return
                (lAmount == 0)
                    ? 0
                    : _getPushView(lChild, start, mid, leaf, setLAmount);
        } else {
            return
                (rAmount == 0)
                    ? 0
                    : _getPushView(
                        rChild,
                        mid + 1,
                        end,
                        leaf,
                        amount - setLAmount
                    );
        }
    }

    function _checkAmount(uint128 amount) internal pure {
        if (amount == 0) revert IncorrectAmount();
    }

    function _checkLeaf(uint48 leaf) internal view {
        if (leaf < LIQUIDITYNODES || leaf > liquidityLastNode)
            revert IncorrectLeaf();
    }
}
