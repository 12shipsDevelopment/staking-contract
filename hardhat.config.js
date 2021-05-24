/**
 * @type import('hardhat/config').HardhatUserConfig
 */
require('@nomiclabs/hardhat-ethers');
require('@openzeppelin/hardhat-upgrades');

const { projectId, mnemonic } = require('./secret.json');

module.exports = {
  solidity: "0.6.12",
    networks: {
     rinkeby: {
       url: `https://rinkeby.infura.io/v3/${projectId}`,
       accounts: {mnemonic: mnemonic},
       networkId: 4
     },
     testnet: {
       url: `https://data-seed-prebsc-1-s1.binance.org:8545`,
       blockGasLimit: 10000000,
       accounts: {mnemonic: mnemonic},
       networkId: 97
     },
     bsc: {
       url: `https://bsc-dataseed.binance.org`,
       accounts: {mnemonic: mnemonic},
       networkId: 1
     }
  },
};
