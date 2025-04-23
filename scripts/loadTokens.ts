import { PrismaClient } from '../src/infrastructure/database/prisma-client';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { chains } from '../src/core/networks/chains';
import { ethers } from 'ethers';

const prisma = new PrismaClient();

const SHOULD_CLEAN_DATABASE = process.env.CLEAN_DATABASE === 'true' || true;
const DELAY_BETWEEN_REQUESTS = 250; 

const ERC20_ABI = [
    "function decimals() view returns (uint8)"
];

const CHAIN_RPC_URLS: { [chainId: number]: string } = {
    1: "https://eth.llamarpc.com",
    56: "https://bsc.publicnode.com",
    137: "https://polygon.llamarpc.com",
    43114: "https://avalanche.public-rpc.com",
    42161: "https://arb1.arbitrum.io/rpc",
    10: "https://mainnet.optimism.io",
    250: "https://rpc.ftm.tools",
    8453: "https://mainnet.base.org",
    1088: "https://andromeda.metis.io/?owner=1088",
    42220: "https://forno.celo.org",
    25: "https://evm.cronos.org",
    100: "https://rpc.gnosischain.com",
    2222: "https://evm.kava.io",
    5000: "https://rpc.mantle.xyz"
};

async function getTokenDecimals(address: string, chainId: number): Promise<number> {
    try {
        const rpcUrl = CHAIN_RPC_URLS[chainId];
        if (!rpcUrl) {
            console.log(`No RPC URL for chain ${chainId}, defaulting to 18 decimals`);
            return 18;
        }

        const provider = new ethers.JsonRpcProvider(rpcUrl);
        const contract = new ethers.Contract(address, ERC20_ABI, provider);
        
        const decimals = await contract.decimals();
        return Number(decimals);
    } catch (error) {
        console.log(`Error fetching decimals for ${address} on chain ${chainId}, defaulting to 18:`, error);
        return 18;
    }
}

const PLATFORM_TO_CHAIN_ID: { [key: string]: number } = {
    'Ethereum': chains[1].chainId,
    'BNB Smart Chain (BEP20)': chains[56].chainId,
    'BNB Smart Chain': chains[56].chainId,
    'BNB': chains[56].chainId,
    'BSC': chains[56].chainId,
    'Polygon': chains[137].chainId,
    'Avalanche C-Chain': chains[43114].chainId,
    'Avalanche': chains[43114].chainId,
    'Arbitrum One': chains[42161].chainId,
    'Arbitrum': chains[42161].chainId,
    'Optimism': chains[10].chainId,
    'Fantom': chains[250].chainId,
    'Fantom Opera': chains[250].chainId,
    'Base': chains[8453].chainId,
    'Metis Andromeda': chains[1088].chainId,
    'Metis': chains[1088].chainId,
    'Celo': chains[42220].chainId,
    'Cronos': chains[25].chainId,
    'Gnosis': chains[100].chainId,
    'Gnosis Chain': chains[100].chainId,
    'xDai': chains[100].chainId,
    'Kava EVM': chains[2222].chainId,
    'Kava': chains[2222].chainId,
    'Mantle': chains[5000].chainId
};

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

interface CMCToken {
    id: string;
    symbol: string;
    name: string;
    platform: string;
    platformName: string;
    address: string;
    decimals: number;
    logoUrl: string;
    websiteUrl: string;
}

interface CMCContractAddress {
    contract_address: string;
    platform: {
        name: string;
        coin: {
            id: string;
            name: string;
            symbol: string;
            slug: string;
        }
    }
}

const DEFAULT_TOOL_NAMES = ['transfer'];

async function fetchCMCTokens(): Promise<CMCToken[]> {
    const CMC_API_KEY = process.env.CMC_API_KEY;
    if (!CMC_API_KEY) {
        throw new Error('CMC_API_KEY environment variable is required');
    }

    console.log('Starting CMC token fetch...');
    
    const response = await axios.get('https://pro-api.coinmarketcap.com/v1/cryptocurrency/listings/latest', {
        headers: {
            'X-CMC_PRO_API_KEY': CMC_API_KEY
        },
        params: {
            limit: 400,
            convert: 'USD'
        }
    });

    const tokens = response.data.data;
    const tokenDetails: CMCToken[] = [];

    for (let i = 0; i < tokens.length; i++) {
        try {
            const token = tokens[i];
            console.log(`Fetching details for ${token.symbol}...`);
            
            await delay(DELAY_BETWEEN_REQUESTS);
            
            const detailsResponse = await axios.get(`https://pro-api.coinmarketcap.com/v2/cryptocurrency/info`, {
                headers: {
                    'X-CMC_PRO_API_KEY': CMC_API_KEY
                },
                params: {
                    id: token.id
                }
            });

            const tokenInfo = detailsResponse.data.data[token.id];
            
            if (tokenInfo.contract_address && Array.isArray(tokenInfo.contract_address)) {
                for (const contractInfo of tokenInfo.contract_address) {
                    const chainId = PLATFORM_TO_CHAIN_ID[contractInfo.platform.name];
                    if (chainId) {
                        const decimals = await getTokenDecimals(contractInfo.contract_address, chainId);
                        tokenDetails.push({
                            id: token.id.toString(),
                            symbol: token.symbol,
                            name: token.name,
                            platform: contractInfo.platform.coin.id.toString(),
                            platformName: contractInfo.platform.name,
                            address: contractInfo.contract_address,
                            decimals,
                            logoUrl: tokenInfo.logo,
                            websiteUrl: tokenInfo.urls.website[0] || ''
                        });
                    }
                }
            }
        } catch (error: any) {
            if (error.response?.status === 429) {
                console.log('Rate limit hit, waiting for 5 seconds...');
                await delay(5000); 
                i--;
                continue;
            }
            console.error(`Error fetching details for ${tokens[i].symbol}:`, error.message);
        }
    }

    return tokenDetails;
}

async function cleanDatabase() {
    console.log('Cleaning database...');
    
    await prisma.tokenToolSupport.deleteMany({});
    console.log('Cleaned token tool supports');
    
    await prisma.tokenDeployment.deleteMany({});
    console.log('Cleaned token deployments');
    
    await prisma.token.deleteMany({});
    console.log('Cleaned tokens');
    
    console.log('Database cleaned successfully');
}

function isNativeToken(symbol: string, chainId: number): boolean {
    const chain = chains[chainId];
    if (!chain) return false;
    return chain.nativeCurrency.symbol === symbol;
}

async function loadTokens(): Promise<void> {
    try {
        console.log('Starting token loading process...');
        
        if (SHOULD_CLEAN_DATABASE) {
            await cleanDatabase();
        }
        
        const cmcDataPath = path.join(__dirname, 'build', 'cmc_data.json');
        let cmcData: CMCToken[];

        if (fs.existsSync(cmcDataPath)) {
            console.log('Loading tokens from cached cmc_data.json...');
            cmcData = JSON.parse(fs.readFileSync(cmcDataPath, 'utf-8'));
        } else {
            console.log('No cached token data found, fetching from CMC...');
            const buildDir = path.join(__dirname, 'build');
            if (!fs.existsSync(buildDir)) {
                fs.mkdirSync(buildDir, { recursive: true });
            }

            cmcData = await fetchCMCTokens();
            fs.writeFileSync(cmcDataPath, JSON.stringify(cmcData, null, 2));
            console.log('Token data fetched and cached successfully');
        }
        const tokenGroups = new Map<string, CMCToken[]>();
        for (const token of cmcData) {
            if (!tokenGroups.has(token.id)) {
                tokenGroups.set(token.id, []);
            }
            tokenGroups.get(token.id)!.push(token);
        }
        
        console.log(`Found ${tokenGroups.size} unique tokens with ${cmcData.length} deployments`);
        
        for (const [tokenId, deployments] of tokenGroups) {
            const baseToken = deployments[0];
            
            let token = await prisma.token.findUnique({
                where: {
                    symbol_name: {
                        symbol: baseToken.symbol,
                        name: baseToken.name
                    }
                }
            });

            if (!token) {
                token = await prisma.token.create({
                    data: {
                        symbol: baseToken.symbol,
                        name: baseToken.name,
                        commonNames: [baseToken.symbol.toLowerCase(), baseToken.name.toLowerCase()],
                        logoURI: baseToken.logoUrl
                    }
                });
                console.log(`Created new token: ${token.symbol}`);
            } else {
                console.log(`Token already exists: ${token.symbol}`);
            }
            
            for (const deployment of deployments) {
                const chainId = PLATFORM_TO_CHAIN_ID[deployment.platformName];
                
                if (!chainId) {
                    console.log(`Skipping deployment for platform ${deployment.platformName} as it's not in our supported chains`);
                    continue;
                }

                // Skip native tokens based on chain configuration
                if (isNativeToken(baseToken.symbol, chainId)) {
                    console.log(`Skipping native token ${baseToken.symbol} for chain ${chainId}`);
                    continue;
                }
                
                let tokenDeployment = await prisma.tokenDeployment.findUnique({
                    where: {
                        address_chainId: {
                            address: deployment.address.toLowerCase(),
                            chainId: chainId
                        }
                    }
                });

                if (!tokenDeployment) {
                    tokenDeployment = await prisma.tokenDeployment.create({
                        data: {
                            address: deployment.address.toLowerCase(),
                            chainId: chainId,
                            decimals: deployment.decimals,
                            isNative: false,
                            tokenId: token.id
                        }
                    });
                    console.log(`Created new deployment: ${deployment.address} on chain ${chainId}`);
                } else {
                    console.log(`Deployment already exists: ${deployment.address} on chain ${chainId}`);
                }
                
                for (const toolName of DEFAULT_TOOL_NAMES) {
                    try {
                        const toolSupport = await prisma.tokenToolSupport.upsert({
                            where: {
                                toolName_deploymentId: {
                                    toolName: toolName,
                                    deploymentId: tokenDeployment.id
                                }
                            },
                            create: {
                                toolName: toolName,
                                deploymentId: tokenDeployment.id,
                                tokenId: token.id,
                                isEnabled: true
                            },
                            update: {
                                tokenId: token.id
                            }
                        });
                        console.log(`Processed tool support for deployment ${deployment.address} with token ${token.symbol}`);
                    } catch (error) {
                        console.error(`Error adding tool support for deployment ${deployment.address}:`, error);
                        throw error;
                    }
                }
            }
        }
        
        console.log('Token loading completed successfully');
    } catch (error) {
        console.error('Token loading failed:', error);
        throw error;
    } finally {
        await prisma.$disconnect();
    }
}

loadTokens()
    .catch((error) => {
        console.error('Unhandled error:', error);
        process.exit(1);
    }); 