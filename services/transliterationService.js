// const { GoogleGenAI } = require("@google/genai");

// const ai = new GoogleGenAI({
//     apiKey: process.env.GEMINI_API_KEY
// });

// async function transliterateHindi(text) {
//     try {

//         const prompt = `
// You are a Hindi-to-Roman-Hindi transliterator.

// Convert Hindi written in Devanagari into natural Roman Hindi.

// IMPORTANT RULES:
// - Do NOT translate Hindi into English.
// - Convert Hindi sounds/words into English alphabet.
// - Keep existing English words unchanged.
// - Keep technical terms unchanged.
// - Preserve the meaning and sentence structure.
// - Return ONLY the transliterated text.
// - Do NOT return Devanagari/Hindi script.
// - Do NOT add explanations.
// - Do NOT add quotes.

// Examples:

// Hindi:
// आज हम मीटिंग शुरू करेंगे।

// Output:
// Aaj hum meeting shuru karenge.

// Hindi:
// आप backend पर काम कर रहे हैं।

// Output:
// Aap backend par kaam kar rahe hain.

// Hindi:
// आज हम project का backend complete करेंगे।

// Output:
// Aaj hum project ka backend complete karenge.

// Text:
// ${text}
// `;

//         const response =
//             await ai.models.generateContent({
//                 model: "gemini-3.5-flash",
//                 contents: prompt
//             });

//         let result =
//             response.text
//                 ? response.text.trim()
//                 : "";

//         // Safety check:
//         // If Gemini still returns Devanagari,
//         // reject it instead of displaying Hindi.
//         if (/[\u0900-\u097F]/.test(result)) {

//             console.error(
//                 "Gemini returned Devanagari. Rejecting transcript:",
//                 result
//             );

//             return "";
//         }

//         return result;

//     } catch (error) {

//         console.error(
//             "Hindi transliteration failed:",
//             error.message
//         );

//         // IMPORTANT:
//         // Do not return original Hindi text.
//         return "";
//     }
// }

// module.exports = {
//     transliterateHindi
// };