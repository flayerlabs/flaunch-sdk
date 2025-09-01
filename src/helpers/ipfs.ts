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

/**
 * Response interface for Flaunch API upload endpoints
 */
interface FlaunchUploadResponse {
  ipfsHash: string;
  [key: string]: any;
}

/**
 * Request interface for Flaunch API metadata upload
 */
interface FlaunchMetadataRequest {
  name: string;
  symbol: string;
  description: string;
  imageIpfs: string;
  websiteUrl?: string;
  discordUrl?: string;
  twitterUrl?: string;
  telegramUrl?: string;
}

/**
 * Uploads a base64 image to IPFS using the Flaunch API
 * @param base64Image Base64 encoded image data
 * @returns Upload response with IPFS hash
 */
export const uploadImageToFlaunchAPI = async (
  base64Image: string
): Promise<FlaunchUploadResponse> => {
  try {
    const response = await axios.post(
      "https://web2-api.flaunch.gg/api/v1/upload-image",
      { base64Image },
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return {
      ipfsHash: response.data.ipfsHash,
      ...response.data,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to upload image to Flaunch API: ${
          error.response?.data?.message || error.message
        }`
      );
    }
    throw error;
  }
};

/**
 * Uploads metadata to IPFS using the Flaunch API
 * @param metadata The metadata object to upload
 * @returns Upload response with IPFS hash
 */
export const uploadMetadataToFlaunchAPI = async (
  metadata: FlaunchMetadataRequest
): Promise<FlaunchUploadResponse> => {
  try {
    const response = await axios.post(
      "https://web2-api.flaunch.gg/api/v1/upload-metadata",
      metadata,
      {
        headers: {
          "Content-Type": "application/json",
        },
      }
    );

    return {
      ipfsHash: response.data.ipfsHash,
      ...response.data,
    };
  } catch (error) {
    if (axios.isAxiosError(error)) {
      throw new Error(
        `Failed to upload metadata to Flaunch API: ${
          error.response?.data?.message || error.message
        }`
      );
    }
    throw error;
  }
};

export const generateTokenUri = async (
  name: string,
  symbol: string,
  params: IPFSParams
) => {
  let imageHash: string;
  let metadataHash: string;

  if (params.pinataConfig) {
    // Use IPFS directly via Pinata
    // 1. upload image to IPFS
    const imageRes = await uploadImageToIPFS({
      pinataConfig: params.pinataConfig,
      base64Image: params.metadata.base64Image,
    });
    imageHash = imageRes.IpfsHash;

    // 2. upload metadata to IPFS
    const coinMetadata: CoinMetadata = {
      name,
      description: params.metadata.description,
      image: `ipfs://${imageHash}`,
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
    metadataHash = metadataRes.IpfsHash;
  } else {
    // Use Flaunch API
    // 1. upload image to Flaunch API
    const imageRes = await uploadImageToFlaunchAPI(params.metadata.base64Image);
    imageHash = imageRes.ipfsHash;

    // 2. upload metadata to Flaunch API
    const flaunchMetadata: FlaunchMetadataRequest = {
      name,
      symbol,
      description: params.metadata.description,
      imageIpfs: imageHash,
      websiteUrl: params.metadata.websiteUrl,
      discordUrl: params.metadata.discordUrl,
      twitterUrl: params.metadata.twitterUrl,
      telegramUrl: params.metadata.telegramUrl,
    };

    const metadataRes = await uploadMetadataToFlaunchAPI(flaunchMetadata);
    metadataHash = metadataRes.ipfsHash;
  }

  return `ipfs://${metadataHash}`;
};
