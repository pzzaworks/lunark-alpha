import { ethers } from 'ethers'
import { chains } from '@/core/networks/chains'

let currentProvider: ethers.JsonRpcProvider
let currentSigner: ethers.Wallet

export async function getProvider(chainId: number): Promise<ethers.JsonRpcProvider> {
  if (currentProvider) {
    const network = await currentProvider.getNetwork()
    if (Number(network.chainId) === chainId) {
      return currentProvider
    }
  }

  const rpcUrl = chains[chainId].rpcUrls[0]
  const chain = chains[chainId]

  currentProvider = new ethers.JsonRpcProvider(rpcUrl, {
    chainId: chain.chainId,
    name: chain.name
  })

  return currentProvider
}

export async function getSigner(chainId: number): Promise<ethers.Wallet> {
  const provider = await getProvider(chainId)
  
  if (currentSigner?.provider === provider) {
    return currentSigner
  }

  if (!process.env.AGENT_PRIVATE_KEY) {
    throw new Error('AGENT_PRIVATE_KEY not found in environment')
  }

  currentSigner = new ethers.Wallet(process.env.AGENT_PRIVATE_KEY, provider)
  return currentSigner
}