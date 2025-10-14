// netlify/functions/chat.js

export async function handler(event) {
  try {
    const body = JSON.parse(event.body);
    const userMessage = body.message;

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": "Bearer " + process.env.OPENROUTER_API_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    const data = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify({
        reply: data.choices[0].message.content,
      }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "حدث خطأ أثناء الاتصال بـ OpenRouter API." }),
    };
  }
}
