import type { ethers } from "ethers";

export interface FhevmInstanceConfigPublicKey {
  id: string;
  data: string;
}

export interface FhevmStoredPublicKey {
  publicKeyId: string;
  publicKey: string;
}

export interface FhevmStoredPublicParams {
  degree: number;
  lweDimension: number;
  polynomialSize: number;
  glweDimension: number;
  level: number;
  baseLog: number;
  ciphertextModulus: number;
}

export interface FhevmInstanceConfigPublicParams {
  [key: string]: FhevmStoredPublicParams;
}

export type FhevmInstance = {
  createEncryptedInput: (contractAddress: string, userAddress: string) => {
    add32: (value: number | bigint) => void;
    add64: (value: number | bigint) => void;
    addBool: (value: boolean) => void;
    encrypt: () => Promise<{ handles: string[]; inputProof: string }>;
  };
  userDecrypt: (
    pairs: { handle: string; contractAddress: string }[],
    privateKey: string,
    publicKey: string,
    signature: string,
    contractAddresses: `0x${string}`[],
    userAddress: `0x${string}`,
    startTimestamp: number,
    durationDays: number
  ) => Promise<Record<string, string | bigint | boolean>>;
  getPublicKey: () => FhevmStoredPublicKey | null;
  getPublicParams: (size: number) => FhevmStoredPublicParams | null;
  generateKeypair: () => { publicKey: string; privateKey: string };
  createEIP712: (
    publicKey: string,
    contracts: string[],
    start: number,
    durationDays: number
  ) => { domain: any; types: Record<string, any>; message: any };
};

export type Eip1193Provider = ethers.Eip1193Provider;

