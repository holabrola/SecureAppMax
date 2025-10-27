import { ethers } from "ethers";
import type { FhevmInstance } from "@/fhevm/fhevmTypes";

export class FhevmDecryptionSignature {
  publicKey: string;
  privateKey: string;
  signature: string;
  startTimestamp: number;
  durationDays: number;
  userAddress: `0x${string}`;
  contractAddresses: `0x${string}`[];
  eip712: any;

  constructor(params: {
    publicKey: string;
    privateKey: string;
    signature: string;
    startTimestamp: number;
    durationDays: number;
    userAddress: `0x${string}`;
    contractAddresses: `0x${string}`[];
    eip712: any;
  }) {
    this.publicKey = params.publicKey;
    this.privateKey = params.privateKey;
    this.signature = params.signature;
    this.startTimestamp = params.startTimestamp;
    this.durationDays = params.durationDays;
    this.userAddress = params.userAddress;
    this.contractAddresses = params.contractAddresses;
    this.eip712 = params.eip712;
  }

  isValid(): boolean {
    return Date.now() / 1000 < this.startTimestamp + this.durationDays * 24 * 60 * 60;
  }

  static async new(
    instance: FhevmInstance,
    contractAddresses: string[],
    publicKey: string,
    privateKey: string,
    signer: ethers.Signer
  ): Promise<FhevmDecryptionSignature | null> {
    try {
      const userAddress = (await signer.getAddress()) as `0x${string}`;
      const startTimestamp = Math.floor(Date.now() / 1000);
      const durationDays = 365;
      const eip712 = instance.createEIP712(publicKey, contractAddresses, startTimestamp, durationDays);
      const signature = await signer.signTypedData(
        eip712.domain,
        { UserDecryptRequestVerification: eip712.types.UserDecryptRequestVerification },
        eip712.message
      );
      return new FhevmDecryptionSignature({ publicKey, privateKey, signature, startTimestamp, durationDays, userAddress, contractAddresses: contractAddresses as `0x${string}`[], eip712 });
    } catch {
      return null;
    }
  }
}


