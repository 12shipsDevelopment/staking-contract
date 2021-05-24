pragma solidity ^0.6.0;
//pragma experimental ABIEncoderV2;

import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';
import "@openzeppelin/contracts/proxy/Initializable.sol";

import './owner/Operator.sol';
import './utils/ContractGuard.sol';
import './TSHPWrapper.sol';


contract TSHPStaking is TSHPWrapper, ContractGuard, Operator {
    using SafeERC20 for IERC20;
    //using Address for address;
    using SafeMath for uint256;

    IERC20 private rewardToken;
    uint256 private _totalReward;
    uint256 private _winningRate;
    uint256 public _totalLocked;

    mapping(address => uint256) public rewardPaid;
    mapping(address => uint256) public tokenWithdrawn;

    uint public startAt;
    uint public closedAt;


    function initialize(IERC20 _rewardToken, IERC20 _tshp) public initializer {
        rewardToken = _rewardToken;
        tshp = _tshp;
        super.initialize_operator();
    }

    modifier subLocked(uint256 amount) {
        if (now < startAt && _totalLocked >= amount) {
            _totalLocked = _totalLocked.sub(amount);
        }
        _;
    }

    modifier addLocked(uint256 amount) {
        if (now < startAt) {
            _totalLocked = _totalLocked.add(amount);
        }
        _;
    }

    function isPoolClosed() public view returns (bool) {
        return now > closedAt;
    }

    function isPoolStart() public view returns (bool) {
        return now >= startAt;
    }

    function rewardPerToken() public view returns (uint256) {
        return _totalReward.mul(1e18).div(availableSupply());
    }

    function totalLocked() public view returns (uint256) {
        return _totalLocked;
    }

    function availableSupply() public view returns(uint256) {
        if (_totalLocked > maxTotalSupply) {
            return maxTotalSupply;
        }
        return _totalLocked;
    }

    function lockRate() public view returns (uint256) {
        if (_totalLocked <= 0) {
            return 0;
        }
        return availableSupply().mul(1e18).div(_totalLocked);
    }

    function duration() public view returns (uint) {
        return closedAt.sub(startAt);
    }

    function earned(address user) public view returns (uint256) {
        if (_totalReward <= 0 || _totalLocked <= 0) {
            return 0;
        } 
        uint256 balance = balanceOf(user).add(tokenWithdrawn[user]);
        return balance.mul(_totalReward).mul(1e18).div(_totalLocked).div(1e18).sub(rewardPaid[user]);
    }

    function locked(address user) public view returns (uint256) {
        uint256 withdrawn = tokenWithdrawn[user];
        return (balanceOf(user).add(withdrawn)).mul(lockRate()).div(1e18);
    }

    function stake(uint256 amount)
        public
        override
        onlyOneBlock
        addLocked(amount)
    {
        require(amount > 0, 'Cannot stake 0');
        require(now < startAt, 'Out of staking time');
        super.stake(amount);
        emit Staked(msg.sender, amount);
    }

    function available(address user) public view returns(uint256) {
        if (now > closedAt || now < startAt) {
            return balanceOf(user);
        }
        return balanceOf(user).sub(locked(user));
    }
 
    function withdraw(uint256 amount)
        public
        override
        onlyOneBlock
        subLocked(amount)
    {
        require(amount <= available(msg.sender), 'Available amount not enough');
        super.withdraw(amount);
        if (now > startAt) {
            tokenWithdrawn[msg.sender] = tokenWithdrawn[msg.sender].add(amount);
        } 
        emit Withdrawn(msg.sender, amount);
    }

    function exit() public {
        withdraw(available(msg.sender));
        claimReward();
    }

    function blockid() public view returns(uint) {
        return now;
    }

    function setMaxTotalSupply(uint256 _maxTotalSupply) public onlyOperator {
        maxTotalSupply = _maxTotalSupply;
    }

    function setMaxStaking(uint256 _maxStaking) public onlyOperator {
        maxStaking = _maxStaking;
    }

    function claimReward() public {
        uint256 reward = earned(msg.sender);
        if (reward > 0) {
            rewardPaid[msg.sender] = rewardPaid[msg.sender].add(reward);
            rewardToken.safeTransfer(msg.sender, reward);
            emit RewardPaid(msg.sender, reward);
        }
    }

    function start(uint _startAt, uint _duration, uint256 _maxStaking, uint256 _maxTotalSupply)
       public  
        onlyOperator
    {
        startAt = _startAt;
        closedAt = startAt.add(_duration);
        maxStaking = _maxStaking;
        maxTotalSupply = _maxTotalSupply;
        emit StartPool(_startAt, _duration);
    }

    function distributeReward(uint256 amount)
       public  
        onlyOneBlock
        onlyOperator
    {
        require(amount > 0, 'Cannot allocate 0');
        require(
            totalSupply() > 0,
            'Cannot allocate when totalSupply is 0'
        );

        require(
            now > startAt,
            'Cannot distribute reward before pool start'
        );

        _totalReward = _totalReward.add(amount);
        rewardToken.safeTransferFrom(msg.sender, address(this), amount);
        emit RewardAdded(msg.sender, amount);
    }

    event StartPool(uint start, uint duration);
    event Staked(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event RewardPaid(address indexed user, uint256 reward);
    event RewardAdded(address indexed user, uint256 reward);
}
