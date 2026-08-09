import '@nomicfoundation/hardhat-toolbox'
import 'dotenv/config'
import { HardhatUserConfig } from 'hardhat/config'

const privateKey = process.env.PRIVATE_KEY || ''

const config: HardhatUserConfig = {
  solidity: '0.8.24',
  paths: {
    sources: '.',
    tests: 'test',
    cache: 'cache',
    artifacts: 'artifacts',
  },
  networks: {
    amoy: {
      url: process.env.BLOCKCHAIN_RPC || '',
      chainId: 80002,
      accounts: privateKey ? [privateKey] : [],
    },
  },
}

export default config
