import '@openzeppelin/contracts/token/ERC20/IERC20.sol';
import '@openzeppelin/contracts/token/ERC20/SafeERC20.sol';

contract TSHPWrapper {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    IERC20 public tshp;

    uint256 private _totalSupply;
    mapping(address => uint256) private _balances;

    uint256 public maxTotalSupply;
    uint256 public maxStaking;

    function totalSupply() public view returns (uint256) {
        return _totalSupply;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _balances[account];
    }

    function stake(uint256 amount) public virtual {
        require(amount <= maxStaking, 'max stake amount limit');
        _totalSupply = _totalSupply.add(amount);
        _balances[msg.sender] = _balances[msg.sender].add(amount);
        tshp.safeTransferFrom(msg.sender, address(this), amount);
    }

    function withdraw(uint256 amount) public virtual {
        uint256 balance = _balances[msg.sender];
        require(
            balance >= amount,
            'withdraw request greater than staked amount'
        );
        _totalSupply = _totalSupply.sub(amount);
        _balances[msg.sender] = balance.sub(amount);
        tshp.safeTransfer(msg.sender, amount);
    }
}
