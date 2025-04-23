export interface Chain {
    id: string
    chainId: number
    name: string
    nativeCurrency: {
      name: string
      symbol: string
      decimals: number
    }
    rpcUrls: string[]
    blockExplorerUrls: string[]
}

export const chains: Record<number, Chain> = {
    1: {
      id: 'eth',
      chainId: 1,
      name: 'Ethereum',
      nativeCurrency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18
      },
      rpcUrls: [
        'https://eth.llamarpc.com',
        'https://rpc.ankr.com/eth'
      ],
      blockExplorerUrls: ['https://etherscan.io']
    },
    17000: {
      id: 'holesky',
      chainId: 17000,
      name: 'Holesky',
      nativeCurrency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18
      },
      rpcUrls: [
        'https://ethereum-holesky.publicnode.com'
      ],
      blockExplorerUrls: ['https://holesky.etherscan.io']
    },
    56: {
      id: 'bnb',
      chainId: 56,
      name: 'BNB Chain',
      nativeCurrency: {
        name: 'BNB',
        symbol: 'BNB',
        decimals: 18
      },
      rpcUrls: [
        'https://bsc-dataseed.binance.org',
        'https://rpc.ankr.com/bsc'
      ],
      blockExplorerUrls: ['https://bscscan.com']
    },
    137: {
      id: 'polygon',
      chainId: 137,
      name: 'Polygon',
      nativeCurrency: {
        name: 'MATIC',
        symbol: 'MATIC',
        decimals: 18
      },
      rpcUrls: [
        'https://polygon-rpc.com',
        'https://rpc.ankr.com/polygon'
      ],
      blockExplorerUrls: ['https://polygonscan.com']
    },
    43114: {
      id: 'avalanche',
      chainId: 43114,
      name: 'Avalanche',
      nativeCurrency: {
        name: 'Avalanche',
        symbol: 'AVAX',
        decimals: 18
      },
      rpcUrls: [
        'https://api.avax.network/ext/bc/C/rpc',
        'https://rpc.ankr.com/avalanche'
      ],
      blockExplorerUrls: ['https://snowtrace.io']
    },
    42161: {
      id: 'arbitrum',
      chainId: 42161,
      name: 'Arbitrum One',
      nativeCurrency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18
      },
      rpcUrls: [
        'https://arb1.arbitrum.io/rpc',
        'https://rpc.ankr.com/arbitrum'
      ],
      blockExplorerUrls: ['https://arbiscan.io']
    },
    10: {
      id: 'optimism',
      chainId: 10,
      name: 'Optimism',
      nativeCurrency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18
      },
      rpcUrls: [
        'https://mainnet.optimism.io',
        'https://rpc.ankr.com/optimism'
      ],
      blockExplorerUrls: ['https://optimistic.etherscan.io']
    },
    250: {
      id: 'fantom',
      chainId: 250,
      name: 'Fantom',
      nativeCurrency: {
        name: 'Fantom',
        symbol: 'FTM',
        decimals: 18
      },
      rpcUrls: [
        'https://rpc.ftm.tools',
        'https://rpc.ankr.com/fantom'
      ],
      blockExplorerUrls: ['https://ftmscan.com']
    },
    8453: {
      id: 'base',
      chainId: 8453,
      name: 'Base',
      nativeCurrency: {
        name: 'Ethereum',
        symbol: 'ETH',
        decimals: 18
      },
      rpcUrls: [
        'https://mainnet.base.org',
        'https://rpc.ankr.com/base'
      ],
      blockExplorerUrls: ['https://basescan.org']
    },
    // 324: {
    //   id: 'zksync',
    //   chainId: 324,
    //   name: 'zkSync Era',
    //   nativeCurrency: {
    //     name: 'Ethereum',
    //     symbol: 'ETH',
    //     decimals: 18
    //   },
    //   rpcUrls: [
    //     'https://mainnet.era.zksync.io'
    //   ],
    //   blockExplorerUrls: ['https://explorer.zksync.io']
    // },
    1088: {
      id: 'metis',
      chainId: 1088,
      name: 'Metis',
      nativeCurrency: {
        name: 'Metis',
        symbol: 'METIS',
        decimals: 18
      },
      rpcUrls: [
        'https://andromeda.metis.io/?owner=1088'
      ],
      blockExplorerUrls: ['https://andromeda-explorer.metis.io']
    },
    42220: {
      id: 'celo',
      chainId: 42220,
      name: 'Celo',
      nativeCurrency: {
        name: 'Celo',
        symbol: 'CELO',
        decimals: 18
      },
      rpcUrls: [
        'https://forno.celo.org',
        'https://rpc.ankr.com/celo'
      ],
      blockExplorerUrls: ['https://celoscan.io']
    },
    25: {
      id: 'cronos',
      chainId: 25,
      name: 'Cronos',
      nativeCurrency: {
        name: 'Cronos',
        symbol: 'CRO',
        decimals: 18
      },
      rpcUrls: [
        'https://evm.cronos.org'
      ],
      blockExplorerUrls: ['https://cronoscan.com']
    },
    100: {
      id: 'gnosis',
      chainId: 100,
      name: 'Gnosis',
      nativeCurrency: {
        name: 'xDAI',
        symbol: 'xDAI',
        decimals: 18
      },
      rpcUrls: [
        'https://rpc.gnosischain.com',
        'https://rpc.ankr.com/gnosis'
      ],
      blockExplorerUrls: ['https://gnosisscan.io']
    },
    2222: {
      id: 'kava',
      chainId: 2222,
      name: 'Kava',
      nativeCurrency: {
        name: 'Kava',
        symbol: 'KAVA',
        decimals: 18
      },
      rpcUrls: [
        'https://evm.kava.io'
      ],
      blockExplorerUrls: ['https://explorer.kava.io']
    },
    5000: {
      id: 'mantle',
      chainId: 5000,
      name: 'Mantle',
      nativeCurrency: {
        name: 'Mantle',
        symbol: 'MNT',
        decimals: 18
      },
      rpcUrls: [
        'https://rpc.mantle.xyz'
      ],
      blockExplorerUrls: ['https://explorer.mantle.xyz']
    }
}

export const getChainById = (chainId: number): Chain => {
  const chain = chains[chainId]
  if (!chain) {
    throw new Error(`Chain with id ${chainId} not found`)
  }
  return chain
}

export const getSupportedChainIds = (): number[] => {
  return Object.keys(chains).map(id => parseInt(id))
}

export const getChainByNetworkId = (networkId: string): Chain => {
  const chain = Object.values(chains).find(chain => chain.id === networkId)
  if (!chain) {
    throw new Error(`Chain with network id ${networkId} not found`)
  }
  return chain
}

export const getChainRpcUrl = (chainId: number): string => {
  const chain = getChainById(chainId)
  return chain.rpcUrls[0]
}

export const isChainSupported = (chainId: number): boolean => {
  return chainId in chains
} 