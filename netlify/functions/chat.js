// netlify/functions/chat.js

export async function handler(event) {
  try {
    const body = JSON.parse(event.body);
    const userMessage = body.message;

    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=" +
        process.env.GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: userMessage }] }],
        }),
      }
    );

    const data = await response.json();
    return {
      statusCode: 200,
      body: JSON.stringify({
        reply: data.candidates[0].content.parts[0].text,
      }),
    };
  } catch (error) {
    console.error(error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "حدث خطأ أثناء الاتصال بـ Gemini API." }),
    };
  }
}
