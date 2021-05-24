const { expect } = require('chai');
const chai = require('chai');
const { solidity } = require('ethereum-waffle');

chai.use(solidity);

describe('TSHPStaking', function () {

  const { provider, BigNumber, utils } = ethers;

  const ETH = utils.parseEther('1');
  const ZERO = BigNumber.from(0);
  const SUPPLY = ETH.mul(1000000);
  const STAKE_AMOUNT = ETH.mul(100);
  const MAX_SUPPLY = ETH.mul(120);
  const MAX_AMOUNT = ETH.mul(120);
  const FIL_AMOUNT = ETH.mul(100);

  let tshp;
  let filecoin;
  let pool;
  let owner, user;

  before(async function () {
      this.BEP20Token = await ethers.getContractFactory("BEP20TokenImplementation");
      this.TSHPStaking = await ethers.getContractFactory("TSHPStaking");
      [owner, user] = await ethers.getSigners();
  });

  beforeEach(async function () {
      tshp = await upgrades.deployProxy(this.BEP20Token, ["12ships", "TSHP", 18, SUPPLY.toString(), true, owner.address], {initializer: "initialize"})
      filecoin = await upgrades.deployProxy(this.BEP20Token, ["Filecoin", "FIL", 18, SUPPLY.toString(), true, owner.address], {initializer: "initialize"})
      pool = await this.TSHPStaking.deploy(filecoin.address, tshp.address)
  });

  describe('#stake', () => {

    beforeEach('stake', async () => {
      blocktime = await pool.connect(owner).blockid()
    });

    it('staking should work correctly', async () => {
      await pool.connect(owner).start(blocktime.add(86400), 86400, MAX_AMOUNT, MAX_SUPPLY);
      await tshp.connect(owner).transfer(user.address, STAKE_AMOUNT.mul(3))
      await tshp.connect(user).approve(pool.address, STAKE_AMOUNT.mul(3))
      await expect(pool.connect(user).stake(STAKE_AMOUNT))
        .to.emit(pool, 'Staked')
        .withArgs(user.address, STAKE_AMOUNT);
      const balance = await pool.balanceOf(user.address)
      expect(balance.toString()).to.equal(STAKE_AMOUNT.toString())
      let rate = await pool.lockRate()
      let total_supply = await pool.totalSupply()
      let max_supply = await pool.maxTotalSupply()
      expect(rate.toString()).to.equal(ETH.toString())
      await pool.connect(user).stake(STAKE_AMOUNT)
      rate = await pool.lockRate()
      expect(rate.toString()).to.equal(MAX_SUPPLY.mul(ETH).div(STAKE_AMOUNT.mul(2)).toString())
    });

    it('staking balance work correctly', async () => {
      await pool.connect(owner).start(blocktime.add(86400), 86400, MAX_AMOUNT, MAX_SUPPLY);
      await tshp.connect(owner).transfer(user.address, STAKE_AMOUNT.mul(3))
      await tshp.connect(user).approve(pool.address, STAKE_AMOUNT.mul(3))
      await expect(pool.connect(user).stake(STAKE_AMOUNT))
        .to.emit(pool, 'Staked')
        .withArgs(user.address, STAKE_AMOUNT);
      const balance = await pool.balanceOf(user.address)
      expect(balance.toString()).to.equal(STAKE_AMOUNT.toString())
      let rate = await pool.lockRate()
      let total_supply = await pool.totalSupply()
      let max_supply = await pool.maxTotalSupply()
      expect(rate.toString()).to.equal(ETH.toString())
      await pool.connect(user).stake(STAKE_AMOUNT)
      rate = await pool.lockRate()
      expect(rate.toString()).to.equal(MAX_SUPPLY.mul(ETH).div(STAKE_AMOUNT.mul(2)).toString())
    });

    it('should fail when user tries to stake after pool starting', async () => {
      await pool.connect(owner).start(blocktime.sub(1000), 86400, MAX_AMOUNT, MAX_SUPPLY);
      await expect(pool.connect(user).stake(STAKE_AMOUNT)).to.revertedWith("Out of staking time")
    });

    it('should fail when user tries to stake with zero amount', async () => {
      await expect(pool.connect(user).stake(ZERO)).to.revertedWith("Cannot stake 0")
    });

  }); 

  describe('#operator', () => {

    beforeEach('stake', async () => {
      await tshp.connect(owner).transfer(user.address, STAKE_AMOUNT)
      await tshp.connect(user).approve(pool.address, STAKE_AMOUNT)
      blocktime = await pool.connect(owner).blockid()
      await pool.connect(owner).start(blocktime.add(86400), 86400, MAX_AMOUNT, MAX_SUPPLY);
    });

    it('set limit should work', async () => {
      await pool.connect(owner).setMaxTotalSupply(STAKE_AMOUNT)
      const max_total_supply = await pool.maxTotalSupply()
      expect(max_total_supply.toString()).to.equal(STAKE_AMOUNT.toString())
      await pool.connect(owner).setMaxStaking(STAKE_AMOUNT)
      const max_staking = await pool.maxStaking()
      expect(max_staking.toString()).to.equal(STAKE_AMOUNT.toString())
    });

    it('should fail when user tries to stak amount that larger than max staking', async () => {
      await pool.connect(owner).setMaxStaking(STAKE_AMOUNT.sub(1))
      await expect(pool.connect(user).stake(STAKE_AMOUNT)).to.revertedWith(
        'max stake amount limit'
      );
    });

  }); 

  describe('#withdraw', () => {
    beforeEach('stake', async () => {
      blocktime = await pool.connect(owner).blockid()
      await tshp.connect(owner).transfer(user.address, STAKE_AMOUNT.mul(3))
      await tshp.connect(user).approve(pool.address, STAKE_AMOUNT.mul(3))
    });

    it('withdraw should work correctly before pool start', async () => {
      await pool.connect(owner).start(blocktime.add(86400), 86400, MAX_AMOUNT, MAX_SUPPLY);
      await pool.connect(user).stake(STAKE_AMOUNT)
      const before = await tshp.balanceOf(user.address)
      await expect(pool.connect(user).withdraw(STAKE_AMOUNT))
        .to.emit(pool, 'Withdrawn')
        .withArgs(user.address, STAKE_AMOUNT);
      const after = await tshp.balanceOf(user.address)
      expect(after.sub(before).toString()).to.equal(STAKE_AMOUNT.toString())
    });

    it('should fail when user tries to withdraw with zero amount', async () => {
      await expect(pool.connect(user).withdraw(ZERO)).to.revertedWith(
        'Cannot withdraw 0'
      );
    });

    it('should fail when user tries to withdraw more than staked amount', async () => {
      await pool.connect(owner).start(blocktime.add(86400), 86400, MAX_AMOUNT, MAX_SUPPLY);
      await pool.connect(user).stake(STAKE_AMOUNT)
      await expect(
        pool.connect(user).withdraw(STAKE_AMOUNT.add(1))
      ).to.revertedWith(
        'Available amount not enough'
      );
    });

    it('withdraw should work correctly when user withdraw available amount', async () => {
      await pool.connect(owner).start(blocktime.add(10), 86400, MAX_AMOUNT, MAX_SUPPLY);
      await pool.connect(user).stake(STAKE_AMOUNT)
      await expect(pool.connect(user).withdraw(ETH))
        .to.emit(pool, 'Withdrawn')
        .withArgs(user.address, ETH);
    });

    it('should fail when user tries to withdraw more than available amount', async () => {
      await pool.connect(owner).start(blocktime.add(1800), 86400, MAX_AMOUNT.mul(2), MAX_SUPPLY);
      await pool.connect(user).stake(STAKE_AMOUNT.mul(2))
      await pool.connect(owner).start(blocktime, 86400, MAX_AMOUNT.mul(2), MAX_SUPPLY);
      await expect(
        pool.connect(user).withdraw(STAKE_AMOUNT.div(4))
      ).to.emit(pool, 'Withdrawn')
        .withArgs(user.address, STAKE_AMOUNT.div(4));
      await expect(
        pool.connect(user).withdraw(STAKE_AMOUNT)
      ).to.revertedWith(
        'Available amount not enough'
      );
    });
   }); 


  describe('#distribute', () => {
    beforeEach('stake', async () => {
      blocktime = await pool.connect(owner).blockid()
      await tshp.connect(owner).transfer(user.address, STAKE_AMOUNT.mul(2))
      await tshp.connect(user).approve(pool.address, STAKE_AMOUNT.mul(2))
      await filecoin.connect(owner).approve(pool.address, FIL_AMOUNT)
    });

    it('distribute should work correctly', async () => {
          await pool.connect(owner).start(blocktime.add(10), 86400, MAX_AMOUNT.mul(2), MAX_SUPPLY);
          await pool.connect(user).stake(STAKE_AMOUNT);
          await pool.connect(user).stake(STAKE_AMOUNT);
          await pool.connect(owner).start(blocktime, 86400, MAX_AMOUNT.mul(2), MAX_SUPPLY);
          await expect(pool.connect(owner).distributeReward(FIL_AMOUNT))
            .to.emit(pool, 'RewardAdded')
            .withArgs(owner.address, FIL_AMOUNT);
          const balance = await filecoin.balanceOf(pool.address)
          expect(balance.toString()).to.equal(FIL_AMOUNT.toString())
          const rewardPerToken = await pool.connect(user).rewardPerToken()
          expect(rewardPerToken.toString()).to.equal((FIL_AMOUNT.mul(ETH)).div(MAX_SUPPLY).toString())
     });
  });

  describe('#claim', () => {
    beforeEach('stake', async () => {
      blocktime = await pool.connect(owner).blockid()
      await tshp.connect(owner).transfer(user.address, STAKE_AMOUNT.mul(2))
      await tshp.connect(user).approve(pool.address, STAKE_AMOUNT.mul(2))
      await pool.connect(owner).start(blocktime.add(100), 86400, MAX_AMOUNT.mul(2), MAX_SUPPLY);
      await pool.connect(user).stake(STAKE_AMOUNT.mul(2))
      await filecoin.connect(owner).approve(pool.address, FIL_AMOUNT)
      await pool.connect(owner).start(blocktime, 86400, MAX_AMOUNT.mul(2), MAX_SUPPLY);
      await pool.connect(owner).distributeReward(FIL_AMOUNT)
    });

    it('exit should work correctly', async () => {
          await pool.connect(owner).start(blocktime.sub(86400), 86400, MAX_AMOUNT.mul(2), MAX_SUPPLY);
          await pool.connect(user).withdraw(ETH.mul(20))
          let earn = await pool.earned(user.address)
          await expect(pool.connect(user).exit())
            .to.emit(pool, 'RewardPaid')
            .withArgs(user.address, FIL_AMOUNT);
          const fbalance = await filecoin.balanceOf(user.address)
          const tbalance = await tshp.balanceOf(user.address)
          expect(fbalance.toString()).to.equal(FIL_AMOUNT.toString())
          expect(tbalance.toString()).to.equal(STAKE_AMOUNT.mul(2).toString())
     });

  });

  // Test case
  it('test supply', async function () {
      const balance = await tshp.balanceOf(owner.address);
      expect(balance.toString()).to.equal(SUPPLY.toString());
  });
});
