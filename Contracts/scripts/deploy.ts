import { ethers } from 'hardhat'

async function main() {
  const ledger = await ethers.deployContract('CyberShieldLedger')
  await ledger.waitForDeployment()
  console.log(`CyberShieldLedger deployed at ${await ledger.getAddress()}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
