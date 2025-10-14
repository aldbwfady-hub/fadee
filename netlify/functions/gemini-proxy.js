// This is the Netlify serverless function that acts as a proxy.
// It receives requests from our frontend, adds the secret API key,
// and forwards them to the Google Gemini API.

exports.handler = async function(event) {
  // Only allow POST requests
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  // Get the API key from Netlify's environment variables
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: 'API_KEY environment variable not set in Netlify.' }) 
    };
  }
  
  // Get the request body from the frontend
  const { model, contents, config = {} } = JSON.parse(event.body);

  const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  // **FIX:** Structure the request body according to the Gemini REST API specification.
  const requestBody = { contents };
  const generationConfig = {};

  if (config.systemInstruction) {
    requestBody.systemInstruction = {
      parts: [{ text: config.systemInstruction }]
    };
  }

  if (config.responseMimeType) {
    generationConfig.responseMimeType = config.responseMimeType;
  }
  
  if (Object.keys(generationConfig).length > 0) {
    requestBody.generationConfig = generationConfig;
  }

  try {
    const geminiResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // This client header can help bypass regional restrictions
        'x-goog-api-client': 'genai-js/1.22.0'
      },
      body: JSON.stringify(requestBody),
    });

    const responseData = await geminiResponse.json();

    if (!geminiResponse.ok) {
       console.error('Gemini API Error:', responseData);
       return {
         statusCode: geminiResponse.status,
         body: JSON.stringify(responseData),
       };
    }

    // Extract the text from the response, similar to how the SDK does it.
    // This provides a consistent response structure for the frontend.
    const text = responseData.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ text: text }),
    };

  } catch (error) {
    console.error('Proxy Function Error:', error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: 'An error occurred in the proxy function.', details: error.message }),
    };
  }
};
