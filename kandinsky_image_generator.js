/**
 * Kandinsky Image Generator
 * JavaScript client for the Fusion Brain API to generate images using Kandinsky 3.1 model.
 */

class KandinskyAPI {
    /**
     * Initialize the API client with authentication credentials.
     * 
     * @param {string} apiKey - Your API key
     * @param {string} secretKey - Your secret key
     * @param {string} url - API endpoint URL (default: 'https://api-key.fusionbrain.ai/')
     */
    constructor(apiKey, secretKey, url = 'https://api-key.fusionbrain.ai/') {
        this.URL = url;
        this.AUTH_HEADERS = {
            'X-Key': `Key ${apiKey}`,
            'X-Secret': `Secret ${secretKey}`
        };
    }

    /**
     * Get the pipeline ID for Kandinsky model.
     * 
     * @returns {Promise<string>} Pipeline ID
     */
    async getPipeline() {
        try {
            const response = await fetch(`${this.URL}key/api/v1/pipelines`, {
                method: 'GET',
                headers: this.AUTH_HEADERS
            });

            if (!response.ok) {
                throw new Error(`Failed to get pipeline: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (!data || data.length === 0) {
                throw new Error('No pipelines available');
            }

            return data[0].id;
        } catch (error) {
            throw new Error(`Failed to get pipeline ID: ${error.message}`);
        }
    }

    /**
     * Generate an image based on the text prompt.
     * 
     * @param {string} prompt - Text description of the image to generate
     * @param {string} pipelineId - Pipeline ID for Kandinsky model
     * @param {Object} options - Additional options
     * @param {number} options.width - Width of the output image (multiple of 64 recommended)
     * @param {number} options.height - Height of the output image (multiple of 64 recommended)
     * @param {number} options.numImages - Number of images to generate (max 1)
     * @param {string} options.style - Style preset to use
     * @param {string} options.negativePrompt - Negative prompt to guide generation
     * @returns {Promise<string>} UUID of the generation request
     */
    async generate(prompt, pipelineId, options = {}) {
        try {
            const { 
                width = 1024, 
                height = 576, 
                numImages = 1, 
                style = null, 
                negativePrompt = null 
            } = options;

            const params = {
                type: 'GENERATE',
                numImages: numImages,
                width: width,
                height: height,
                generateParams: {
                    query: prompt
                }
            };

            if (style) {
                params.style = style;
            }

            if (negativePrompt) {
                params.negativePromptDecoder = negativePrompt;
            }

            const formData = new FormData();
            formData.append('pipeline_id', pipelineId);

            // Create a Blob with the JSON data
            const paramsBlob = new Blob([JSON.stringify(params)], {
                type: 'application/json'
            });
            formData.append('params', paramsBlob);

            const response = await fetch(`${this.URL}key/api/v1/pipeline/run`, {
                method: 'POST',
                headers: this.AUTH_HEADERS,
                body: formData
            });

            if (!response.ok) {
                throw new Error(`Failed to generate image: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            if (data.pipeline_status) {
                throw new Error(`Service unavailable: ${data.pipeline_status}`);
            }

            return data.uuid;
        } catch (error) {
            throw new Error(`Failed to generate image: ${error.message}`);
        }
    }

    /**
     * Check the status of an image generation request.
     * 
     * @param {string} requestId - UUID of the generation request
     * @param {Object} options - Additional options
     * @param {number} options.attempts - Number of attempts to check status
     * @param {number} options.delay - Delay between attempts in milliseconds
     * @param {Function} options.onProgress - Callback function for progress updates
     * @returns {Promise<Array<string>>} List of base64-encoded image data
     */
    async checkGeneration(requestId, options = {}) {
        const { 
            attempts = 20, 
            delay = 5000,
            onProgress = null
        } = options;

        let attemptsLeft = attempts;

        while (attemptsLeft > 0) {
            try {
                const response = await fetch(`${this.URL}key/api/v1/pipeline/status/${requestId}`, {
                    method: 'GET',
                    headers: this.AUTH_HEADERS
                });

                if (!response.ok) {
                    throw new Error(`Failed to check generation status: ${response.status} ${response.statusText}`);
                }

                const data = await response.json();

                if (data.status === 'DONE') {
                    return data.result.files;
                } else if (data.status === 'FAIL') {
                    const errorMsg = data.errorDescription || 'Unknown error';
                    throw new Error(`Generation failed: ${errorMsg}`);
                }

                if (onProgress) {
                    onProgress({
                        status: data.status,
                        attemptsLeft,
                        totalAttempts: attempts
                    });
                }

                attemptsLeft--;
                await new Promise(resolve => setTimeout(resolve, delay));
            } catch (error) {
                throw new Error(`Error checking generation: ${error.message}`);
            }
        }

        throw new Error('Generation timed out');
    }

    /**
     * Save base64-encoded images to files.
     * In browser context, this triggers downloads for each image.
     * 
     * @param {Array<string>} base64Images - List of base64-encoded image data
     * @param {Object} options - Additional options
     * @param {string} options.prefix - Prefix for image filenames
     * @returns {Array<string>} List of image filenames
     */
    saveImages(base64Images, options = {}) {
        const { prefix = 'kandinsky' } = options;
        const filenames = [];

        base64Images.forEach((imgData, i) => {
            // Remove the data URL prefix if present
            let processedData = imgData;
            if (!processedData.startsWith('data:image')) {
                processedData = 'data:image/png;base64,' + processedData;
            }

            const filename = `${prefix}_${i}.png`;
            filenames.push(filename);

            // Create a download link
            const link = document.createElement('a');
            link.href = processedData;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
        });

        return filenames;
    }
}

// Export the class for use in other scripts
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { KandinskyAPI };
} else {
    // For browser environments
    window.KandinskyAPI = KandinskyAPI;
}