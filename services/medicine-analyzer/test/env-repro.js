
import { env } from '../src/config/env.js';

console.log('--- Environment Variable Check ---');
console.log('NODE_ENV:', env.NODE_ENV);
console.log('PORT:', env.PORT);

if (env.GEMINI_API_KEY && env.GEMINI_API_KEY.length > 0) {
    console.log('GEMINI_API_KEY: Set');
} else {
    console.log('GEMINI_API_KEY: Not Set');
}

if (env.PINECONE_INDEX === 'medicine-knowledgebase') {
    console.log('PINECONE_INDEX: Correct');
} else {
    console.log('PINECONE_INDEX: Incorrect or Not Set');
}
