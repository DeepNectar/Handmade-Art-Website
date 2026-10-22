// Cloudinary Image Upload Service
// Sign up for free at https://cloudinary.com

const CLOUDINARY_CLOUD_NAME = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME || 'your-cloud-name';
const CLOUDINARY_UPLOAD_PRESET = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET || 'your-upload-preset';
const CLOUDINARY_API_KEY = import.meta.env.VITE_CLOUDINARY_API_KEY || 'your-api-key';

export interface UploadResult {
  success: boolean;
  url?: string;
  publicId?: string;
  error?: string;
}

// Upload image to Cloudinary
export const uploadImage = async (file: File): Promise<UploadResult> => {
  try {
    // Validate file
    if (!file) {
      return { success: false, error: 'No file provided' };
    }

    // Check file size (max 10MB)
    if (file.size > 10 * 1024 * 1024) {
      return { success: false, error: 'File size must be less than 10MB' };
    }

    // Check file type
    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return { success: false, error: 'Only JPEG, PNG, WebP, and GIF images are allowed' };
    }

    // Create form data
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
    formData.append('cloud_name', CLOUDINARY_CLOUD_NAME);
    
    // Optional: Add folder
    formData.append('folder', 'resincraft/products');

    // Upload to Cloudinary
    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
      {
        method: 'POST',
        body: formData,
      }
    );

    if (!response.ok) {
      const errorData = await response.json();
      return { 
        success: false, 
        error: errorData.error?.message || 'Upload failed' 
      };
    }

    const data = await response.json();

    return {
      success: true,
      url: data.secure_url,
      publicId: data.public_id,
    };
  } catch (error) {
    console.error('Upload error:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Upload failed' 
    };
  }
};

// Delete image from Cloudinary
export const deleteImage = async (publicId: string): Promise<boolean> => {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await generateSignature(publicId, timestamp);
    
    const formData = new FormData();
    formData.append('public_id', publicId);
    formData.append('signature', signature);
    formData.append('api_key', CLOUDINARY_API_KEY);
    formData.append('timestamp', timestamp.toString());

    const response = await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/destroy`,
      {
        method: 'POST',
        body: formData,
      }
    );

    return response.ok;
  } catch (error) {
    console.error('Delete error:', error);
    return false;
  }
};

// Generate signature for Cloudinary API (simplified - in production, do this on backend)
const generateSignature = async (publicId: string, timestamp: number): Promise<string> => {
  // Note: In production, signature generation should be done on the backend
  // This is a simplified version for demo purposes
  const params = `public_id=${publicId}&timestamp=${timestamp}${CLOUDINARY_API_KEY}`;
  // In real implementation, use crypto to create SHA-1 hash with your API secret
  return btoa(params); // Placeholder - replace with proper signature generation
};

// Get optimized image URL
export const getOptimizedUrl = (url: string, options: {
  width?: number;
  height?: number;
  quality?: number;
  format?: 'auto' | 'webp' | 'jpg' | 'png';
} = {}): string => {
  if (!url || !url.includes('cloudinary.com')) return url;

  const { width, height, quality = 'auto', format = 'auto' } = options;
  
  // Build transformation string
  const transformations = [];
  if (width) transformations.push(`w_${width}`);
  if (height) transformations.push(`h_${height}`);
  if (quality) transformations.push(`q_${quality}`);
  if (format) transformations.push(`f_${format}`);
  
  if (transformations.length === 0) return url;

  // Insert transformations into URL
  const urlParts = url.split('/upload/');
  if (urlParts.length === 2) {
    return `${urlParts[0]}/upload/${transformations.join(',')}/${urlParts[1]}`;
  }
  
  return url;
};

// Upload multiple images
export const uploadMultipleImages = async (files: FileList): Promise<UploadResult[]> => {
  const results: UploadResult[] = [];
  
  for (let i = 0; i < files.length; i++) {
    const result = await uploadImage(files[i]);
    results.push(result);
  }
  
  return results;
};
