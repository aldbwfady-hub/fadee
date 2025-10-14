// This is the Netlify serverless function that acts as a proxy.
// It receives requests from our frontend, adds the secret API key,
// and forwards them to the OpenRouter API.

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

  const apiUrl = 'https://openrouter.ai/api/v1/chat/completions';

  // --- Transform Gemini-style request to OpenRouter/OpenAI-style ---
  const messages = [];

  // 1. Add system instruction if it exists
  if (config.systemInstruction) {
    messages.push({
      role: 'system',
      content: config.systemInstruction
    });
  }

  // 2. Transform the `contents` array into the `messages` array
  for (const content of contents) {
    // Map 'model' role to 'assistant'
    const role = content.role === 'model' ? 'assistant' : 'user';

    // Handle multimodal content (with images)
    if (content.parts.some(part => part.inlineData)) {
      const messageContent = content.parts.map(part => {
        if (part.text) {
          return { type: 'text', text: part.text };
        }
        if (part.inlineData) {
          const { mimeType, data } = part.inlineData;
          return {
            type: 'image_url',
            image_url: {
              url: `data:${mimeType};base64,${data}`
            }
          };
        }
        return null;
      }).filter(Boolean);
      
      messages.push({ role, content: messageContent });
    } else { // Handle text-only content
      const textContent = content.parts.map(part => part.text).join('\n');
      messages.push({ role, content: textContent });
    }
  }
  
  // 3. Construct the final request body for OpenRouter
  const requestBody = {
    model: model,
    messages: messages,
  };
  
  // 4. Handle JSON mode if requested
  if (config.responseMimeType === 'application/json') {
    requestBody.response_format = { type: 'json_object' };
  }

  try {
    const openRouterResponse = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        // These headers are recommended by OpenRouter for analytics
        'HTTP-Referer': `https://syrian-student-ai.netlify.app`,
        'X-Title': `Syrian Student AI Assistant`
      },
      body: JSON.stringify(requestBody),
    });

    const responseData = await openRouterResponse.json();

    if (!openRouterResponse.ok) {
       console.error('OpenRouter API Error:', responseData);
       return {
         statusCode: openRouterResponse.status,
         body: JSON.stringify(responseData),
       };
    }

    // Extract the text from the OpenRouter/OpenAI-compatible response
    const text = responseData.choices?.[0]?.message?.content || '';
    
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
