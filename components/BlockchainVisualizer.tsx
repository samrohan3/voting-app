
import React from 'react';
import { Block } from '../types';

interface Props {
  blocks: Block[];
}

const BlockchainVisualizer: React.FC<Props> = ({ blocks }) => {
  return (
    <div className="mt-8 space-y-4">
      <h3 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
        Live Blockchain Ledger
      </h3>
      <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
        {Array.isArray(blocks) && blocks.map((block, idx) => (
          <div 
            key={block.hash}
            className="flex-shrink-0 w-64 p-4 rounded-xl border border-gray-200 bg-white shadow-sm hover:shadow-md transition-shadow relative"
          >
            <div className="flex justify-between items-center mb-2">
              <span className="text-xs font-bold text-blue-600 px-2 py-0.5 bg-blue-50 rounded-full">
                BLOCK #{block.index}
              </span>
              <span className="text-[10px] text-gray-400">
                {new Date(block.timestamp).toLocaleTimeString()}
              </span>
            </div>
            
            <div className="space-y-2">
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Current Hash</p>
                <p className="text-[10px] font-mono break-all text-gray-600 bg-gray-50 p-1 rounded">
                  {block.hash.substring(0, 32)}...
                </p>
              </div>
              
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Prev Hash</p>
                <p className="text-[10px] font-mono break-all text-gray-400">
                  {block.previousHash.substring(0, 24)}...
                </p>
              </div>

              <div className="pt-2 border-t border-dashed border-gray-100">
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Voter ID (Hashed)</p>
                <p className="text-[10px] font-mono text-blue-500 break-all truncate">
                  {block.voterId}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Nonce (PoW)</p>
                <p className="text-[10px] font-mono text-gray-500">
                  {block.nonce}
                </p>
              </div>
            </div>

            {idx < blocks.length - 1 && (
              <div className="absolute -right-3 top-1/2 -translate-y-1/2 z-10">
                <div className="w-6 h-0.5 bg-blue-200"></div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default BlockchainVisualizer;
