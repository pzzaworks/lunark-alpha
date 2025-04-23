import { JsonRpcProvider } from 'ethers';
import { getChainRpcUrl } from '@/core/networks/chains';

export function createEthersPublicClient(chainId: number) {
    const rpcUrl = getChainRpcUrl(chainId);
    if (!rpcUrl) {
        throw new Error(`No RPC URL found for chain ID ${chainId}`);
    }
    return new JsonRpcProvider(rpcUrl);
}