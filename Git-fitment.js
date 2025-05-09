// Netlify Function for Vehicle Fitment Tool
// This function calls the OpenAI API to get fitment data for a vehicle

const { Configuration, OpenAIApi } = require('openai');

// Initialize OpenAI configuration with API key from environment variable
const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

exports.handler = async function(event, context) {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight OPTIONS request
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ message: 'Preflight call successful' })
    };
  }

  // Only accept POST requests
  if (event.httpMethod !== 'POST') {
    return { 
      statusCode: 405, 
      headers,
      body: JSON.stringify({ error: 'Method Not Allowed' }) 
    };
  }

  try {
    // Parse the request body
    const requestBody = JSON.parse(event.body);
    const { year, make, model, trim } = requestBody;

    // Validate input
    if (!year || !make || !model) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'Missing required vehicle information' })
      };
    }

    // Construct the prompt for OpenAI
    const prompt = `
      Generate detailed wheel and tire fitment information for a ${year} ${make} ${model} ${trim || ''}. 
      Include OEM (factory) specs and possible upgrades for 20", 22", and 24" wheels.
      
      Format the response as a JSON object with the following structure:
      {
        "oem": {
          "wheelSize": "string (e.g., '17x7.5')",
          "tireSize": "string (e.g., '245/70R17')",
          "boltPattern": "string (e.g., '6x135mm')",
          "hubSize": "string (e.g., '87.1mm')",
          "offset": "string (e.g., '+44mm')",
          "tpms": "string (e.g., 'Required')"
        },
        "upgrades": {
          "20": [
            {
              "wheelSize": "string (e.g., '20x9.0')",
              "tireSize": "string (e.g., '275/55R20')",
              "offset": "string (e.g., '+18mm to +25mm')",
              "notes": "string (e.g., 'No rubbing or modifications required')"
            },
            // Additional 20" options...
          ],
          "22": [
            // 22" options with same structure as 20"
          ],
          "24": [
            // 24" options with same structure as 20"
          ]
        }
      }
      
      Only provide fitment options that will work without major modifications to the vehicle.
      For each wheel size upgrade, provide at least 2-3 tire size options that maintain a similar overall diameter to the OEM setup (within 3%).
      If a particular wheel size upgrade is not recommended or not possible, provide an empty array for that wheel size.
    `;

    // Call OpenAI API
    const completion = await openai.createChatCompletion({
      model: "gpt-4",  // You can change this to a different model if needed
      messages: [
        {
          role: "system", 
          content: "You are a vehicle fitment expert specializing in wheel and tire upgrades. Provide accurate, detailed information about OEM specifications and safe upgrade options."
        },
        {role: "user", content: prompt}
      ],
      temperature: 0.2,  // Low temperature for more deterministic results
      max_tokens: 2000   // Adjust as needed
    });

    // Parse the OpenAI response
    const responseText = completion.data.choices[0].message.content;
    let fitmentData;
    
    try {
      // Try to parse the JSON response
      fitmentData = JSON.parse(responseText);
    } catch (error) {
      console.error('Error parsing OpenAI response as JSON:', error);
      
      // If JSON parsing fails, use a regex approach to find the JSON object
      const jsonMatch = responseText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          fitmentData = JSON.parse(jsonMatch[0]);
        } catch (innerError) {
          console.error('Error parsing extracted JSON:', innerError);
          throw new Error('Failed to parse fitment data from response');
        }
      } else {
        throw new Error('Could not extract JSON from response');
      }
    }

    // Return the fitment data
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(fitmentData)
    };

  } catch (error) {
    console.error('Function error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ error: 'Internal Server Error', message: error.message })
    };
  }
};
[build]
  functions = "netlify/functions"
  publish = "."

[dev]
  functions = "netlify/functions"
  publish = "."
  
[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200
