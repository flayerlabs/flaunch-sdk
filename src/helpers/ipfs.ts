import axios from "axios";
import { CoinMetadata, IPFSParams } from "../types";

// List of public IPFS gateways to cycle through
const IPFS_GATEWAYS = [
  "https://gateway.pinata.cloud/ipfs/",
  "https://ipfs.io/ipfs/",
  "https://dweb.link/ipfs/",
];

// Counter to track the current gateway index
let currentGatewayIndex = 0;

export const resolveIPFS = (value: string): string => {
  if (value.startsWith("ipfs://")) {
    const cid = value.slice(7);
    // Get the next gateway and increment the counter
    const gateway = IPFS_GATEWAYS[currentGatewayIndex];
    // Update the counter, cycling back to 0 when we reach the end
    currentGatewayIndex = (currentGatewayIndex + 1) % IPFS_GATEWAYS.length;
    return `${gateway}${cid}`;
  }
  return value;
};

export interface PinataConfig {
  jwt: string;
}

interface UploadResponse {
  IpfsHash: string;
  PinSize: number;
  Timestamp: string;
  isDuplicate: boolean;
}

/**
 * Uploads a file to IPFS using Pinata
 * @param params Configuration and file data
 * @returns Upload response with CID and other details
 */
export const uploadFileToIPFS = async (params: {
  pinataConfig: PinataConfig;
  file: File;
  name?: string;
  metadata?: Record<string, string>;
}): Promise<UploadResponse> => {
  try {
    const formData = new FormData();
    formData.append("file", params.file);

    const pinataMetadata = {
      name: params.name || null,
      keyvalues: params.metadata || {},
    };
    formData.append("pinataMetadata", JSON.stringify(pinataMetadata));

    const pinataOptions = {
      cidVersion: 1,
    };
    formData.append("pinataOptions", JSON.stringify(pinataOptions));

    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      formData,
      {
        headers: {
          Authorization: `Bearer ${params.pinataConfig.jwt}`,
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return {
      IpfsHash: response.data.IpfsHash,
      PinSize: response.data.PinSize,
      Timestamp: response.data.Timestamp,
      isDuplicate: response.data.isDuplicate || false,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to upload file to IPFS: ${
          error.response?.data?.message || error.message
        }`
      );
    }
    throw error;
  }
};

/**
 * Uploads JSON data to IPFS using Pinata
 * @param params Configuration and JSON data
 * @returns Upload response with CID and other details
 */
export const uploadJsonToIPFS = async (params: {
  pinataConfig: PinataConfig;
  json: Record<string, any>;
  name?: string;
  metadata?: Record<string, string>;
}): Promise<UploadResponse> => {
  try {
    const requestBody = {
      pinataOptions: {
        cidVersion: 1,
      },
      pinataMetadata: {
        name: params.name || null,
        keyvalues: params.metadata || {},
      },
      pinataContent: params.json,
    };

    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinJSONToIPFS",
      requestBody,
      {
        headers: {
          Authorization: `Bearer ${params.pinataConfig.jwt}`,
          "Content-Type": "application/json",
        },
      }
    );

    return {
      IpfsHash: response.data.IpfsHash,
      PinSize: response.data.PinSize,
      Timestamp: response.data.Timestamp,
      isDuplicate: response.data.isDuplicate || false,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to upload JSON to IPFS: ${
          error.response?.data?.message || error.message
        }`
      );
    }
    throw error;
  }
};

/**
 * Uploads a base64 image to IPFS using Pinata
 * @param params Configuration and base64 image data
 * @returns Upload response with CID and other details
 */
export const uploadImageToIPFS = async (params: {
  pinataConfig: PinataConfig;
  base64Image: string;
  name?: string;
  metadata?: Record<string, string>;
}): Promise<UploadResponse> => {
  try {
    const formData = new FormData();

    // Convert base64 to Blob and then to File
    // Remove data URL prefix if present (e.g., "data:image/jpeg;base64,")
    const base64Data = params.base64Image.split(",")[1] || params.base64Image;
    const byteCharacters = atob(base64Data);
    const byteArrays = [];

    for (let offset = 0; offset < byteCharacters.length; offset += 1024) {
      const slice = byteCharacters.slice(offset, offset + 1024);
      const byteNumbers = new Array(slice.length);
      for (let i = 0; i < slice.length; i++) {
        byteNumbers[i] = slice.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      byteArrays.push(byteArray);
    }

    // Detect mime type from base64 string
    let mimeType = "image/png"; // default
    if (params.base64Image.startsWith("data:")) {
      mimeType = params.base64Image.split(";")[0].split(":")[1];
    }

    const blob = new Blob(byteArrays, { type: mimeType });
    const fileName = params.name || `image.${mimeType.split("/")[1]}`;
    const file = new File([blob], fileName, { type: mimeType });

    formData.append("file", file);

    const pinataMetadata = {
      name: params.name || null,
      keyvalues: params.metadata || {},
    };
    formData.append("pinataMetadata", JSON.stringify(pinataMetadata));

    const pinataOptions = {
      cidVersion: 1,
    };
    formData.append("pinataOptions", JSON.stringify(pinataOptions));

    const response = await axios.post(
      "https://api.pinata.cloud/pinning/pinFileToIPFS",
      formData,
      {
        headers: {
          Authorization: `Bearer ${params.pinataConfig.jwt}`,
          "Content-Type": "multipart/form-data",
        },
      }
    );

    return {
      IpfsHash: response.data.IpfsHash,
      PinSize: response.data.PinSize,
      Timestamp: response.data.Timestamp,
      isDuplicate: response.data.isDuplicate || false,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to upload image to IPFS: ${
          error.response?.data?.message || error.message
        }`
      );
    }
    throw error;
  }
};

export const generateTokenUri = async (name: string, params: IPFSParams) => {
  // 1. upload image to IPFS
  const imageRes = await uploadImageToIPFS({
    pinataConfig: params.pinataConfig,
    base64Image: params.metadata.base64Image,
  });

  // 2. upload metadata to IPFS
  const coinMetadata: CoinMetadata = {
    name,
    description: params.metadata.description,
    image: `ipfs://${imageRes.IpfsHash}`,
    external_link: params.metadata.websiteUrl || "",
    collaborators: [],
    discordUrl: params.metadata.discordUrl || "",
    twitterUrl: params.metadata.twitterUrl || "",
    telegramUrl: params.metadata.telegramUrl || "",
  };

  const metadataRes = await uploadJsonToIPFS({
    pinataConfig: params.pinataConfig,
    json: coinMetadata,
  });

  return `ipfs://${metadataRes.IpfsHash}`;
};
